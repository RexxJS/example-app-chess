#!/usr/bin/env node
/*!
 * chess-mcp | MIT License (../LICENSE)
 */
/**
 * An MCP server for the sae chess app (../app/): an AI client (Claude, or
 * any MCP client) plays and drives a running game through its control bus.
 * The shape of the spreadsheet's (aether-lang-dev/spraedsheet, mcp/).
 *
 *   claude mcp add chess -- node /path/to/mcp/chess-mcp.js
 *
 * MCP over stdio: one JSON-RPC message a line in, one a line out. Each tool
 * call is one control-bus request. Which tools a client is offered is set
 * when the server starts, by --tools=json|rexx|all (or CHESS_MCP_TOOLS):
 *
 *   json (the default)  arguments as JSON, the server writing the app's
 *                       commands from them: nothing for a model to escape
 *     chess_move           a move: from and to, or SAN
 *     chess_board          the diagram, FEN, legal moves, status, moves made
 *     chess_call           one function, or several as one step, its
 *                          arguments checked before it is sent
 *     chess_run_program    a whole REXX program, one step of undo
 *     chess_list_commands  the functions, each with its parameters
 *   rexx                for those who would write the app's REXX themselves
 *     chess_run            a command, a string of REXX the app runs
 *     chess_run_program, chess_board, chess_list_commands
 *   all                 all six
 *
 * The bus is sae's: the app started with `--control-bus`, a port chosen at
 * random and a key fresh for every launch, in a courier file only this user
 * can read, and every message sealed (sae's docs/control-bus.md). This
 * server does none of that itself: it runs sae's `sae-bus` for each call,
 * as rexx/chess-address.js does.
 *
 *   SAE_BUS            the sae-bus to run (default: ../sae/target/sae-bus,
 *                      beside this repository's sae link)
 *   CHESS_APP          the app's name, which finds its courier file
 *                      (default "Chess", app/app.json's name)
 *   SAE_APPDATA_DIR    the app's data folder, when the app was started
 *                      with one (sae-bus reads it)
 */
'use strict';

const { execFile } = require('child_process');
const path = require('path');
const readline = require('readline');

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER = { name: 'chess', version: '1.0.0' };
// sae-bus waits up to 10 s for the app's answer; a little more here, so its
// own reason is what comes back.
const BUS_DEADLINE_MS = 12000;
const SURFACES = ['json', 'rexx', 'all'];

const LIMITS =
  'Each call is one request to the running app and one step of its undo (the person takes it back with one Undo); ' +
  'one that fails is taken back whole. ' +
  'Request and reply only: you are not told when the person moves on the board, so read the board again before relying on what you read earlier. ' +
  'One call at a time, each answered within 10 seconds. The app must be running with its control bus on (sae --app app --control-bus).';

// ---- the tools -------------------------------------------------------------

const MOVE = {
  name: 'chess_move',
  title: 'Make a move',
  description:
    'Make a move for the side to move: {"from": "e2", "to": "e4"} (with "promotion": "queen", "rook", "bishop" or "knight" when a pawn ' +
    'reaches the last rank; queen if left out), or {"san": "Nf3"} in standard algebraic notation ("O-O", "exd5", "e8=Q"; ' +
    'coordinate notation "e2e4" too). Gives the move in SAN and the position after it: FEN, whose turn, the status ' +
    '(in_progress, check, checkmate, stalemate, or a draw) and the result. An illegal move is refused with why, and changes nothing. ' + LIMITS,
  inputSchema: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'The square the piece is on, e.g. "e2"' },
      to: { type: 'string', description: 'The square it goes to, e.g. "e4"' },
      promotion: { type: 'string', description: 'queen, rook, bishop or knight, for a pawn on the last rank' },
      san: { type: 'string', description: 'Instead of from and to: the move in SAN, e.g. "Nf3", "O-O", "exd5"' },
    },
    additionalProperties: false,
  },
};

const BOARD = {
  name: 'chess_board',
  title: 'Read the board',
  description:
    'Read the game: the board as a diagram (white at the bottom, Unicode pieces, "." for an empty square), the FEN, whose turn, ' +
    'the status and result, the moves made so far in SAN, and every legal move with its from, to, piece, capture, promotion and SAN. ' +
    'Read it before choosing a move. ' + LIMITS,
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
};

const CALL = {
  name: 'chess_call',
  title: 'Call a chess function',
  description:
    'Call one of the app\'s functions by name, its arguments as a JSON list: {"function": "SETPOSITION", "args": ["8/8/8/4k3/8/8/4P3/4K3 w - - 0 1"]}. ' +
    'Or several in turn as one step of undo, all or nothing: {"calls": [{"function": "NEWGAME"}, {"function": "MOVESAN", "args": ["e4"]}]}. ' +
    'chess_list_commands lists the functions and what each takes; the arguments are checked against that before anything is sent. ' +
    'Common ones: MOVE(from, to, [promotion]), MOVESAN(move), UNDO(), REDO(), NEWGAME(), SETPOSITION(fen), GETFEN(), PIECEAT(square), ' +
    'GETSTATUS(), GETMOVEHISTORYSAN(), RESIGN([side]), OFFERDRAW(), FLIPBOARD(). ' + LIMITS,
  inputSchema: {
    type: 'object',
    properties: {
      function: { type: 'string', description: 'A function\'s name, e.g. "MOVESAN"' },
      args: { type: 'array', description: 'Its arguments, in order', items: {} },
      calls: {
        type: 'array',
        description: 'Instead of function and args: several calls, done in turn as one step',
        items: {
          type: 'object',
          properties: { function: { type: 'string' }, args: { type: 'array', items: {} } },
          required: ['function'],
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  },
};

const RUN = {
  name: 'chess_run',
  title: 'Run a chess command (REXX)',
  description:
    'Run one command in the chess app: a REXX expression calling its functions, as text. ' +
    'Values go inside the command as REXX strings in double quotes, and a quote inside one is written twice. Common ones:\n' +
    '  MOVE("e2", "e4")           a move from a square to a square\n' +
    '  MOVESAN("Nf3")             a move in SAN\n' +
    '  GETBOARD() / GETFEN() / GETSTATUS() / GETMOVES() / LISTLEGALMOVES()\n' +
    '  UNDO() / REDO() / NEWGAME() / SETPOSITION("<fen>")\n' +
    '  CHESSCOMMAND("move from=e2 to=e4")   an old ADDRESS CHESS line\n' +
    'Several can go in one command, separated by ";": they are one step of undo, and the answer is the FIRST one\'s.\n' +
    'chess_list_commands lists every function with its parameters. ' + LIMITS,
  inputSchema: {
    type: 'object',
    properties: { command: { type: 'string', description: 'The REXX to run, e.g. MOVE("e2", "e4")' } },
    required: ['command'],
    additionalProperties: false,
  },
};

const RUN_PROGRAM = {
  name: 'chess_run_program',
  title: 'Run a REXX program',
  description:
    'Run a whole REXX program in the chess app, as one step of undo, all or nothing: lines, DO i = 1 TO n, DO WHILE and DO FOREVER ' +
    'loops with LEAVE, IF/THEN/ELSE, SELECT, your own routines, and SAY. It calls the same functions ' +
    'as chess_call: r = MOVESAN("e4"), fen = GETFEN(), m = LISTLEGALMOVES() (a stem: m.0 moves, m.1.san ...). Set RESULT to give a value back; what it ' +
    'SAYs comes back too. The program is sent as it is, so nothing in it needs escaping on the way; inside it, REXX rules hold. It runs in the ' +
    'app, sandboxed: the game\'s functions and nothing else (no files, no shell, no network). It is stopped if one stretch of work runs past 5 s, ' +
    'or the whole past 10 s, and then taken back whole. ' + LIMITS,
  inputSchema: {
    type: 'object',
    properties: { program: { type: 'string', description: 'The REXX program, lines separated by new lines' } },
    required: ['program'],
    additionalProperties: false,
  },
};

const listCommands = (via) => ({
  name: 'chess_list_commands',
  title: 'List the chess functions',
  description:
    'Every function ' + via + ' may call (about thirty), each as its signature, what it does and what it gives: ' +
    'MOVE(from, to, [promotion]): optional parameters in brackets. Give a name for one function in full, with what ' +
    'each parameter takes. ' + LIMITS,
  inputSchema: {
    type: 'object',
    properties: { name: { type: 'string', description: 'One function, e.g. "SETPOSITION"; left out: all of them' } },
    additionalProperties: false,
  },
});

function toolsFor(surface) {
  if (surface === 'rexx') return [RUN, RUN_PROGRAM, BOARD, listCommands('chess_run or a program')];
  if (surface === 'all') return [MOVE, BOARD, CALL, RUN_PROGRAM, listCommands('chess_call, a program, or chess_run'), RUN];
  return [MOVE, BOARD, CALL, RUN_PROGRAM, listCommands('chess_call or a program')];
}

// --tools=X, or CHESS_MCP_TOOLS; json when neither.
function surfaceOf(argv, env) {
  const flag = argv.find((a) => a.startsWith('--tools='));
  const asked = (flag ? flag.slice('--tools='.length) : env.CHESS_MCP_TOOLS || 'json').trim().toLowerCase();
  if (!SURFACES.includes(asked)) throw new Error('--tools is json, rexx or all, not ' + JSON.stringify(asked));
  return asked;
}

// ---- the bus ---------------------------------------------------------------

// One request over the bus: { ok, result } or { ok: false, error }.
function bus(command) {
  const saeBus = process.env.SAE_BUS || path.join(__dirname, '..', 'sae', 'target', 'sae-bus');
  const app = process.env.CHESS_APP || 'Chess';
  return new Promise((resolve) => {
    execFile(saeBus, [app, command], { encoding: 'utf8', timeout: BUS_DEADLINE_MS, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const why = (stderr || '').trim() || (error.killed ? 'no answer within ' + BUS_DEADLINE_MS / 1000 + ' s' : error.message);
        resolve({ ok: false, error: 'no chess app to ask: ' + why });
        return;
      }
      let answer;
      try {
        answer = JSON.parse(stdout);
      } catch (e) {
        resolve({ ok: false, error: 'sae-bus answered with something other than JSON: ' + stdout.slice(0, 200) });
        return;
      }
      if (answer.success) resolve({ ok: true, result: answer.result === undefined ? null : answer.result });
      else resolve({ ok: false, error: answer.error || 'the command failed (error ' + (answer.errorCode || 1) + ')' });
    });
  });
}

// A REXX stem ({0: count, 1: ..., n: ...}) as an array; anything else as is.
function unstem(v) {
  if (!isStem(v)) return v;
  const out = [];
  for (let i = 1; i <= Number(v['0']); i++) out.push(v[String(i)]);
  return out;
}

function isStem(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v) || !('0' in v)) return false;
  const n = Number(v['0']);
  if (!Number.isInteger(n) || n < 0) return false;
  for (let i = 1; i <= n; i++) if (!(String(i) in v)) return false;
  return true;
}

// Stems as arrays, all the way down.
function plain(v) {
  if (Array.isArray(v)) return v.map(plain);
  if (isStem(v)) return unstem(v).map(plain);
  if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
}

// ---- the functions, described by the app (LISTCOMMANDS(1)) -----------------

// Asked for once a server: the app's functions do not change while it runs.
let catalogue = null;

async function functions() {
  if (catalogue) return { ok: true, list: catalogue };
  const a = await bus('LISTCOMMANDS(1)');
  if (!a.ok) return a;
  const listed = unstem(a.result);
  const list = (Array.isArray(listed) ? listed : [])
    .filter((c) => c && typeof c === 'object')
    .map((c) => ({ ...c, params: (unstem(c.params) || []).map((x) => ({ ...x, optional: x.optional === 1, variadic: x.variadic === 1 })) }))
    .sort((x, y) => String(x.name).localeCompare(String(y.name)));
  catalogue = list;
  return { ok: true, list };
}

const isNumberish = (v) => (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)));
const PIECES = ['q', 'r', 'b', 'n', 'queen', 'rook', 'bishop', 'knight'];
const SIDES = ['white', 'black', 'both', 'none'];

// One argument as the app takes it, or { error }. `where` names it.
function argument(param, v, where) {
  const bad = (wanted) => ({ error: where + ' (' + param.name + ') must be ' + wanted + ', not ' + JSON.stringify(v) });
  switch (param.type) {
    case 'square':
      return typeof v === 'string' && /^[a-h][1-8]$/i.test(v.trim()) ? { value: v.trim().toLowerCase() } : bad('a square, "a1" to "h8"');
    case 'piece':
      return typeof v === 'string' && PIECES.includes(v.trim().toLowerCase()) ? { value: v.trim().toLowerCase() } : bad('queen, rook, bishop or knight');
    case 'side':
      return typeof v === 'string' && SIDES.includes(v.trim().toLowerCase()) ? { value: v.trim().toLowerCase() } : bad('white or black (or, for the computer, both or none)');
    case 'level':
      return isNumberish(v) && [1, 2, 3, 4].includes(Number(v)) ? { value: Number(v) } : bad('a level, 1 to 4');
    case 'number':
      return isNumberish(v) ? { value: Number(v) } : bad('a number');
    case 'flag':
      if (v === true || v === 1 || v === '1') return { value: 1 };
      if (v === false || v === 0 || v === '0') return { value: 0 };
      return bad('1 or 0 (or true or false)');
    case 'stem':
      return Array.isArray(v) ? { value: v } : bad('a list');
    case 'json':
      return typeof v === 'string' ? { value: v } : v !== null && typeof v === 'object' ? { value: JSON.stringify(v) } : bad('JSON, as text or an object');
    case 'san':
    case 'fen':
    case 'text':
      return typeof v === 'string' || typeof v === 'number' ? { value: String(v) } : bad('text');
    default:
      return { value: v };
  }
}

// A call checked against the function's description: { command, args } as
// BATCH_EXECUTE takes it, or { error }.
function checked(list, call, which) {
  const name = String(call && call.function || '').trim().toUpperCase();
  const where = which ? 'call ' + which + ', ' : '';
  if (!name) return { error: where + 'no function named; chess_list_commands lists them' };
  const fn = list.find((c) => c.name === name);
  if (!fn) return { error: where + 'no function ' + JSON.stringify(call.function) + '; chess_list_commands lists them' };
  const args = call.args === undefined ? [] : call.args;
  if (!Array.isArray(args)) return { error: where + name + '\'s args must be a list' };
  const fixed = fn.params.filter((x) => !x.variadic);
  const rest = fn.params.find((x) => x.variadic);
  const needed = fixed.filter((x) => !x.optional).length;
  if (args.length < needed || (!rest && args.length > fixed.length)) {
    const takes = rest ? 'at least ' + needed : needed === fixed.length ? String(needed) : needed + ' to ' + fixed.length;
    return { error: where + fn.signature + ' takes ' + takes + ' argument' + (takes === '1' ? '' : 's') + ', not ' + args.length };
  }
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const param = i < fixed.length ? fixed[i] : rest;
    const a = argument(param, args[i], where + name + '\'s argument ' + (i + 1));
    if (a.error) return { error: a.error };
    out.push(a.value);
  }
  return { command: name, args: out };
}

// Calls as one request, BATCH_EXECUTE's, stopping at the first that fails
// (so the request is taken back whole): each one's result, or { error }.
async function batch(calls) {
  const a = await bus(batchCommand(calls));
  if (!a.ok) return { error: a.error };
  let results;
  try {
    results = typeof a.result === 'string' ? JSON.parse(a.result) : a.result;
  } catch (e) {
    return { error: 'the app answered with something other than its results: ' + String(a.result).slice(0, 200) };
  }
  return { results: (Array.isArray(results) ? results : []).map((r) => plain(r.result === undefined ? null : r.result)) };
}

// The REXX that carries calls to the app with nothing in it to escape: the
// calls as JSON in base64, which RexxJS's BASE64_DECODE gives back (it reads
// bytes as Latin-1, so the JSON is first made ASCII: \uXXXX for the rest,
// which JSON.parse in the app turns back). A value's text never appears in
// a REXX string.
function batchCommand(calls) {
  return 'BATCH_EXECUTE(' + carried(calls) + ', 1)';
}

// A whole program, the same way: RUN_PROGRAM(<its JSON in base64>, "json").
function programCommand(text) {
  return 'RUN_PROGRAM(' + carried(text) + ', "json")';
}

function carried(value) {
  const ascii = JSON.stringify(value).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  return "BASE64_DECODE('" + Buffer.from(ascii, 'ascii').toString('base64') + "')";
}

// ---- answers ---------------------------------------------------------------

function text(value) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function ok(value, structured) {
  const r = { content: [{ type: 'text', text: text(value) }], isError: false };
  if (structured !== undefined) r.structuredContent = structured;
  return r;
}

function failed(message) {
  return { content: [{ type: 'text', text: message }], isError: true };
}

// GETGAMEINFO's answer, as a position after a move is told.
function position(info) {
  return { fen: info.fen, turn: info.toPlay, status: info.status, result: info.result, check: info.isCheck === 1 };
}

async function callTool(name, args, surface = 'all') {
  args = args || {};
  if (!toolsFor(surface).some((t) => t.name === name)) return null;
  if (name === 'chess_move') {
    const bySan = args.san !== undefined;
    if (bySan === (args.from !== undefined || args.to !== undefined)) return failed('chess_move takes from and to (with a promotion), or san: one of the two');
    let call;
    if (bySan) {
      if (typeof args.san !== 'string' || args.san.trim() === '') return failed('chess_move: san must be a move, e.g. "Nf3"');
      if (args.promotion !== undefined) return failed('chess_move: a promotion goes in the SAN ("e8=Q"), or with from and to');
      call = { command: 'MOVESAN', args: [args.san.trim()] };
    } else {
      const sq = (v) => (typeof v === 'string' && /^[a-h][1-8]$/i.test(v.trim()) ? v.trim().toLowerCase() : null);
      const from = sq(args.from), to = sq(args.to);
      if (!from || !to) return failed('chess_move: from and to must be squares, "a1" to "h8", not ' + JSON.stringify(args.from) + ' and ' + JSON.stringify(args.to));
      if (args.promotion !== undefined && !(typeof args.promotion === 'string' && PIECES.includes(args.promotion.trim().toLowerCase()))) {
        return failed('chess_move: promotion must be queen, rook, bishop or knight, not ' + JSON.stringify(args.promotion));
      }
      call = { command: 'MOVE', args: args.promotion === undefined ? [from, to] : [from, to, args.promotion.trim().toLowerCase()] };
    }
    const b = await batch([call, { command: 'GETGAMEINFO', args: [] }]);
    if (b.error) return failed(b.error);
    const after = position(b.results[1] || {});
    const said = 'played ' + b.results[0] + '; ' + after.turn + ' to move, ' + after.status + (after.result !== '*' ? ' (' + after.result + ')' : '') + '\nFEN: ' + after.fen;
    return ok(said, { move: b.results[0], ...after });
  }
  if (name === 'chess_board') {
    const b = await batch([{ command: 'GETGAMEINFO', args: [] }, { command: 'LISTLEGALMOVES', args: [] }]);
    if (b.error) return failed(b.error);
    const info = b.results[0] || {};
    const legal = (Array.isArray(b.results[1]) ? b.results[1] : []).map((m) => ({ ...m, capture: m.capture === 1 }));
    const structured = { board: info.board, ...position(info), moves: info.moves || [], legalMoves: legal };
    const lines = [info.board, 'FEN: ' + info.fen, info.toPlay + ' to move, ' + info.status + (info.result !== '*' ? ' (' + info.result + ')' : ''),
      'Moves: ' + ((info.moves || []).join(' ') || 'none yet'), 'Legal: ' + (legal.map((m) => m.san).join(' ') || 'none')];
    return ok(lines.join('\n'), structured);
  }
  if (name === 'chess_run') {
    if (typeof args.command !== 'string' || args.command.trim() === '') return failed('chess_run needs a command, e.g. MOVE("e2", "e4")');
    const a = await bus(args.command);
    if (!a.ok) return failed(a.error);
    const result = plain(a.result);
    return ok(result === null ? '(done; no result)' : result, { result });
  }
  if (name === 'chess_call') {
    const many = args.calls !== undefined;
    if (many === (args.function !== undefined)) return failed('chess_call takes a function (with its args) or calls, one of the two');
    if (many && args.args !== undefined) return failed('chess_call: args go inside each of the calls');
    const calls = many ? args.calls : [{ function: args.function, args: args.args }];
    if (!Array.isArray(calls) || calls.length === 0) return failed('chess_call: calls must be a list of at least one');
    const f = await functions();
    if (!f.ok) return failed(f.error);
    const sent = [];
    for (let i = 0; i < calls.length; i++) {
      const c = checked(f.list, calls[i], many ? i + 1 : 0);
      if (c.error) return failed(c.error + (many ? ' (nothing was sent)' : ''));
      sent.push(c);
    }
    const b = await batch(sent);
    if (b.error) return failed(b.error);
    if (!many) {
      const result = b.results[0] === undefined ? null : b.results[0];
      return ok(result === null || result === '' ? '(done; no result)' : result, { result });
    }
    return ok(b.results, { results: b.results });
  }
  if (name === 'chess_run_program') {
    if (typeof args.program !== 'string' || args.program.trim() === '') return failed('chess_run_program needs a program: lines of REXX');
    const a = await bus(programCommand(args.program));
    if (!a.ok) return failed(a.error);
    const got = plain(a.result) || {};
    const said = Array.isArray(got.said) ? got.said.map(String) : [];
    const result = got.result === undefined || got.result === null ? '' : got.result;
    const lines = said.slice();
    if (result !== '') lines.push('RESULT: ' + text(result));
    return ok(lines.length ? lines.join('\n') : '(ran; said nothing, no RESULT)', { said, result });
  }
  if (name === 'chess_list_commands') {
    const f = await functions();
    if (!f.ok) return failed(f.error);
    const commands = f.list;
    if (args.name !== undefined) {
      const one = commands.find((c) => c.name === String(args.name).trim().toUpperCase());
      if (!one) return failed('no function ' + JSON.stringify(args.name) + '; chess_list_commands with no name lists them');
      const lines = [one.signature, one.does + '; gives ' + one.gives + '.'];
      for (const x of one.params) lines.push('  ' + x.name + ': ' + x.type + (x.optional ? ', optional' : '') + (x.variadic ? ', any number' : '') + (x.about ? ' (' + x.about + ')' : ''));
      return ok(lines.join('\n'), one);
    }
    return ok(commands.map((c) => c.signature + ': ' + c.does + '; gives ' + c.gives).join('\n'), { commands });
  }
  return null;
}

// ---- JSON-RPC over stdio -------------------------------------------------

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function error(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handle(msg, surface) {
  const isRequest = msg.id !== undefined && msg.id !== null;
  switch (msg.method) {
    case 'initialize': {
      const asked = msg.params && msg.params.protocolVersion;
      reply(msg.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions:
          'Plays and drives a running sae chess game over its control bus. Read the board before you move, ' +
          'and tell the person what you did: each call is one Undo for them.',
      });
      return;
    }
    case 'ping':
      if (isRequest) reply(msg.id, {});
      return;
    case 'tools/list':
      reply(msg.id, { tools: toolsFor(surface) });
      return;
    case 'tools/call': {
      const p = msg.params || {};
      const result = await callTool(p.name, p.arguments, surface);
      if (result === null) error(msg.id, -32602, 'no tool named ' + JSON.stringify(p.name));
      else reply(msg.id, result);
      return;
    }
    default:
      // Notifications (initialized, cancelled) need no answer; an unknown
      // request does.
      if (isRequest) error(msg.id, -32601, 'no method ' + JSON.stringify(msg.method));
  }
}

if (require.main === module) {
  let surface;
  try {
    surface = surfaceOf(process.argv.slice(2), process.env);
  } catch (e) {
    process.stderr.write('chess-mcp: ' + e.message + '\n');
    process.exit(2);
  }
  // Requests are answered in order: the bus takes one command at a time.
  let queue = Promise.resolve();
  const lines = readline.createInterface({ input: process.stdin });
  lines.on('line', (line) => {
    if (line.trim() === '') return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch (e) {
      queue = queue.then(() => error(null, -32700, 'not JSON: ' + e.message));
      return;
    }
    queue = queue.then(() => handle(msg, surface)).catch((e) => {
      if (msg.id !== undefined && msg.id !== null) error(msg.id, -32603, String(e && e.message || e));
    });
  });
  lines.on('close', () => queue.then(() => process.exit(0)));
}

module.exports = { toolsFor, surfaceOf, batchCommand, programCommand, unstem, plain, checked, callTool, handle };
