// mcp/chess-mcp.js spoken to as an MCP client does, over stdio, with
// tests/mcp/fake-sae-bus.js in place of sae's sae-bus: the handshake, the
// tools each --tools setting offers, each tool's request on the bus and its
// answer, the arguments checked before anything is sent, and what a client
// is told when a call fails or there is no app to ask.
//   node --test tests/mcp/
// The app itself is driven through this server by tests/specs/spec_app_chess_mcp.ae.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SERVER = path.join(__dirname, '..', '..', 'mcp', 'chess-mcp.js');
const FAKE = path.join(__dirname, 'fake-sae-bus.js');

// A server with the fake bus; `talk(messages)` sends them one a line and
// gives back the replies to those with ids, in order, and the bus's calls.
async function talk(messages, env = {}, argv = []) {
  const log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'chess-mcp-')), 'bus.log');
  const child = spawn(process.execPath, [SERVER, ...argv], {
    env: { ...process.env, SAE_BUS: FAKE, FAKE_BUS_LOG: log, CHESS_MCP_TOOLS: '', ...env },
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  for (const m of messages) child.stdin.write((typeof m === 'string' ? m : JSON.stringify(m)) + '\n');
  child.stdin.end();
  const code = await new Promise((resolve) => child.on('close', resolve));
  const replies = out.split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
  const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter((l) => l).map((l) => JSON.parse(l)) : [];
  return { code, replies, calls };
}

const INIT = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } } };
const INITIALIZED = { jsonrpc: '2.0', method: 'notifications/initialized' };
const LIST = { jsonrpc: '2.0', id: 2, method: 'tools/list' };
const call = (id, name, args) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });
const REXX = ['--tools=rexx'];
// The calls a BATCH_EXECUTE request carried, as the app reads them.
const batched = (command) => JSON.parse(Buffer.from(/^BATCH_EXECUTE\(BASE64_DECODE\('([A-Za-z0-9+/=]*)'\), 1\)$/.exec(command)[1], 'base64').toString('latin1'));
const names = (r) => r.result.tools.map((t) => t.name);

// ---- the handshake, and the tools each setting offers

test('the handshake: the version asked for, tools offered, and the notification left unanswered', async () => {
  const { code, replies } = await talk([INIT, INITIALIZED, { jsonrpc: '2.0', id: 2, method: 'ping' }]);
  assert.equal(code, 0);
  assert.equal(replies.length, 2, 'two requests, two replies: none to the notification');
  assert.equal(replies[0].result.protocolVersion, '2025-06-18');
  assert.deepEqual(replies[0].result.capabilities, { tools: { listChanged: false } });
  assert.equal(replies[0].result.serverInfo.name, 'chess');
  assert.deepEqual(replies[1], { jsonrpc: '2.0', id: 2, result: {} });
});

test('a protocol version it does not know is answered with the newest it does', async () => {
  const { replies } = await talk([{ ...INIT, params: { ...INIT.params, protocolVersion: '1999-01-01' } }]);
  assert.equal(replies[0].result.protocolVersion, '2025-06-18');
});

test('json, the default: the tools that take JSON, and no REXX command to escape', async () => {
  const { replies } = await talk([INIT, LIST]);
  assert.deepEqual(names(replies[1]), ['chess_move', 'chess_board', 'chess_call', 'chess_run_program', 'chess_list_commands']);
  for (const t of replies[1].result.tools) {
    assert.equal(t.inputSchema.type, 'object', t.name);
    assert.match(t.description, /one step of its undo/, t.name);
    assert.match(t.description, /not told when the person moves/, t.name);
  }
  assert.match(replies[1].result.tools[4].description, /Every function chess_call or a program may call/);
});

test('--tools=rexx: chess_run, with REXX\'s quoting said, a program and the two that read', async () => {
  const { replies } = await talk([INIT, LIST], {}, REXX);
  assert.deepEqual(names(replies[1]), ['chess_run', 'chess_run_program', 'chess_board', 'chess_list_commands']);
  assert.match(replies[1].result.tools[0].description, /a quote inside one is written twice/);
});

test('--tools=all, or CHESS_MCP_TOOLS=all: all six; the flag wins over the environment', async () => {
  for (const { replies } of [await talk([INIT, LIST], {}, ['--tools=all']), await talk([INIT, LIST], { CHESS_MCP_TOOLS: 'ALL' })]) {
    assert.deepEqual(names(replies[1]), ['chess_move', 'chess_board', 'chess_call', 'chess_run_program', 'chess_list_commands', 'chess_run']);
  }
  const { replies } = await talk([INIT, LIST], { CHESS_MCP_TOOLS: 'all' }, REXX);
  assert.equal(names(replies[1]).length, 4);
});

test('a setting it does not know: said on stderr, exit 2, before any client is answered', () => {
  const r = spawnSync(process.execPath, [SERVER, '--tools=everything'], { input: JSON.stringify(INIT) + '\n', encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /--tools is json, rexx or all, not "everything"/);
});

test('a tool the setting does not offer is no tool at all', async () => {
  const json = await talk([INIT, call(2, 'chess_run', { command: 'GETFEN()' })]);
  assert.equal(json.replies[1].error.code, -32602);
  assert.deepEqual(json.calls, []);
  const rexx = await talk([INIT, call(2, 'chess_move', { san: 'e4' })], {}, REXX);
  assert.equal(rexx.replies[1].error.code, -32602);
});

// ---- chess_move and chess_board

test('chess_move by from and to: MOVE and GETGAMEINFO as one request, the SAN and the position after', async () => {
  const { replies, calls } = await talk([INIT, call(2, 'chess_move', { from: 'E2', to: 'e4' })]);
  assert.equal(calls.length, 1, 'one request, no LISTCOMMANDS needed');
  assert.deepEqual(batched(calls[0][1]), [{ command: 'MOVE', args: ['e2', 'e4'] }, { command: 'GETGAMEINFO', args: [] }]);
  assert.equal(replies[1].result.isError, false);
  assert.deepEqual(replies[1].result.structuredContent, { move: 'e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', turn: 'black', status: 'in_progress', result: '*', check: false });
  assert.equal(replies[1].result.content[0].text, 'played e4; black to move, in_progress\nFEN: rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
});

test('chess_move with a promotion, and by SAN', async () => {
  const { calls } = await talk([INIT, call(2, 'chess_move', { from: 'a7', to: 'a8', promotion: 'Knight' }), call(3, 'chess_move', { san: ' Nf3 ' })]);
  assert.deepEqual(batched(calls[0][1])[0], { command: 'MOVE', args: ['a7', 'a8', 'knight'] });
  assert.deepEqual(batched(calls[1][1])[0], { command: 'MOVESAN', args: ['Nf3'] });
});

test('chess_move: an illegal move is a tool error with the app\'s reason', async () => {
  const { replies } = await talk([INIT, call(2, 'chess_move', { from: 'e7', to: 'e5' })]);
  assert.equal(replies[1].result.isError, true);
  assert.equal(replies[1].result.content[0].text, 'command 1 (MOVE): e7 to e5 is not a legal move for white (nothing it did was kept)');
});

test('chess_move: refused before anything is sent', async () => {
  const cases = [
    [{}, /from and to \(with a promotion\), or san: one of the two/],
    [{ from: 'e2', to: 'e4', san: 'e4' }, /one of the two/],
    [{ from: 'e2', to: 'e9' }, /from and to must be squares, "a1" to "h8", not "e2" and "e9"/],
    [{ from: 'e7', to: 'e8', promotion: 'king' }, /promotion must be queen, rook, bishop or knight, not "king"/],
    [{ san: 'e8=Q', promotion: 'queen' }, /a promotion goes in the SAN/],
    [{ san: '  ' }, /san must be a move/],
  ];
  for (const [args, why] of cases) {
    const { replies, calls } = await talk([INIT, call(2, 'chess_move', args)]);
    assert.equal(replies[1].result.isError, true, JSON.stringify(args));
    assert.match(replies[1].result.content[0].text, why);
    assert.deepEqual(calls, []);
  }
});

test('chess_board: the diagram, FEN, status, moves and legal moves, as structured content', async () => {
  const { replies, calls } = await talk([INIT, call(2, 'chess_board', {})]);
  assert.deepEqual(batched(calls[0][1]), [{ command: 'GETGAMEINFO', args: [] }, { command: 'LISTLEGALMOVES', args: [] }]);
  const s = replies[1].result.structuredContent;
  assert.equal(s.board, '  a b c d e f g h\n...');
  assert.deepEqual([s.fen, s.turn, s.status, s.result, s.check, s.moves], ['rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', 'black', 'in_progress', '*', false, ['e4']]);
  assert.deepEqual(s.legalMoves[1], { from: 'g8', to: 'f6', piece: 'N', capture: false, promotion: '', san: 'Nf6', coordinate: 'g8f6' });
  assert.match(replies[1].result.content[0].text, /Moves: e4\nLegal: e5 Nf6$/);
});

// ---- chess_call

test('chess_call: the function checked against LISTCOMMANDS(1), then sent as BATCH_EXECUTE that stops at a failure', async () => {
  const { replies, calls } = await talk([INIT, call(2, 'chess_call', { function: 'setaidifficulty', args: ['3'] })]);
  assert.deepEqual(calls.map((c) => c[1].slice(0, 29)), ['LISTCOMMANDS(1)', 'BATCH_EXECUTE(BASE64_DECODE(\'']);
  assert.deepEqual(batched(calls[1][1]), [{ command: 'SETAIDIFFICULTY', args: [3] }]);
  assert.deepEqual(replies[1].result.structuredContent, { result: 'OK' });
});

test('chess_call: a FEN goes in as it is, nothing for the model to escape; a stem comes back as a list', async () => {
  const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
  const { replies, calls } = await talk([INIT, call(2, 'chess_call', { function: 'SETPOSITION', args: [fen] }), call(3, 'chess_call', { function: 'GETMOVEHISTORYSAN' })]);
  assert.deepEqual(batched(calls[1][1]), [{ command: 'SETPOSITION', args: [fen] }]);
  assert.deepEqual(replies[2].result.structuredContent, { result: ['e4', 'e5'] });
  assert.equal(calls.filter((c) => c[1] === 'LISTCOMMANDS(1)').length, 1, 'the functions asked for once');
});

test('chess_call with calls: in turn, as one request, each one\'s result', async () => {
  const { replies, calls } = await talk([INIT, call(2, 'chess_call', { calls: [{ function: 'MOVESAN', args: ['e4'] }, { function: 'MOVESAN', args: ['e5'] }, { function: 'UNDO' }] })]);
  assert.deepEqual(batched(calls[1][1]), [{ command: 'MOVESAN', args: ['e4'] }, { command: 'MOVESAN', args: ['e5'] }, { command: 'UNDO', args: [] }]);
  assert.deepEqual(replies[1].result.structuredContent, { results: ['e4', 'e5', 1] });
});

test('chess_call: one that fails in the app is a tool error saying which, and that nothing was kept', async () => {
  const { replies } = await talk([INIT, call(2, 'chess_call', { calls: [{ function: 'MOVESAN', args: ['e4'] }, { function: 'MOVE', args: ['e7', 'e5'] }] })]);
  assert.equal(replies[1].result.isError, true);
  assert.match(replies[1].result.content[0].text, /^command 2 \(MOVE\): .*\(nothing it did was kept\)$/);
});

const refused = async (args) => {
  const { replies, calls } = await talk([INIT, call(2, 'chess_call', args)]);
  assert.equal(replies[1].result.isError, true, JSON.stringify(args));
  assert.deepEqual(calls.filter((c) => c[1].startsWith('BATCH')), [], 'nothing sent');
  return replies[1].result.content[0].text;
};

test('chess_call: arguments checked before anything is sent, each refusal naming what is wrong', async () => {
  assert.equal(await refused({ function: 'NOPE' }), 'no function "NOPE"; chess_list_commands lists them');
  assert.equal(await refused({ function: 'MOVE', args: ['e2'] }), 'MOVE(from, to, [promotion]) takes 2 to 3 arguments, not 1');
  assert.equal(await refused({ function: 'MOVESAN', args: [] }), 'MOVESAN(move) takes 1 argument, not 0');
  assert.equal(await refused({ function: 'MOVE', args: ['e2', 'e9'] }), 'MOVE\'s argument 2 (to) must be a square, "a1" to "h8", not "e9"');
  assert.equal(await refused({ function: 'MOVE', args: ['e7', 'e8', 'king'] }), 'MOVE\'s argument 3 (promotion) must be queen, rook, bishop or knight, not "king"');
  assert.equal(await refused({ function: 'SETAIDIFFICULTY', args: [5] }), 'SETAIDIFFICULTY\'s argument 1 (level) must be a level, 1 to 4, not 5');
  assert.equal(await refused({ function: 'RESIGN', args: ['red'] }), 'RESIGN\'s argument 1 (side) must be white or black (or, for the computer, both or none), not "red"');
  assert.equal(await refused({ function: 'SETPOSITION', args: [{ fen: 'x' }] }), 'SETPOSITION\'s argument 1 (fen) must be text, not {"fen":"x"}');
  assert.equal(await refused({ function: 'UNDO', args: [], calls: [] }), 'chess_call takes a function (with its args) or calls, one of the two');
  assert.equal(await refused({ calls: [] }), 'chess_call: calls must be a list of at least one');
  assert.equal(await refused({ calls: [{ function: 'UNDO' }, { function: 'MOVESAN', args: [] }] }), 'call 2, MOVESAN(move) takes 1 argument, not 0 (nothing was sent)');
});

// ---- chess_run_program and chess_run

const carriedProgram = (command) => JSON.parse(Buffer.from(/^RUN_PROGRAM\(BASE64_DECODE\('([A-Za-z0-9+/=]*)'\), "json"\)$/.exec(command)[1], 'base64').toString('latin1'));

test('chess_run_program: the program carried whole as base64 JSON to RUN_PROGRAM; its SAY lines and RESULT back', async () => {
  const program = 'm = LISTLEGALMOVES()\nr = MOVESAN(m.1.san)\nSAY "played ""it"" ♞"\nLET RESULT = r';
  const { replies, calls } = await talk([INIT, call(2, 'chess_run_program', { program })]);
  assert.equal(calls.length, 1);
  assert.equal(carriedProgram(calls[0][1]), program, 'as it was, quotes and all');
  assert.deepEqual(replies[1].result.structuredContent, { said: ['played ""it"" ♞'], result: 'r' });
  assert.equal(replies[1].result.content[0].text, 'played ""it"" ♞\nRESULT: r');
});

test('chess_run_program: a failing program is a tool error; an empty one is refused before the bus', async () => {
  const bad = await talk([INIT, call(2, 'chess_run_program', { program: 'CALL BOOM' })]);
  assert.equal(bad.replies[1].result.content[0].text, "Subroutine 'BOOM' not found (nothing it did was kept)");
  const empty = await talk([INIT, call(2, 'chess_run_program', { program: ' \n ' })]);
  assert.equal(empty.replies[1].result.isError, true);
  assert.deepEqual(empty.calls, []);
});

test('chess_run: the command goes to the bus as it is, for the app named; a stem comes back as a list', async () => {
  const { replies, calls } = await talk([INIT, call(2, 'chess_run', { command: 'MOVE("e2", "e4")' }), call(3, 'chess_run', { command: 'GETMOVES()' })], { CHESS_APP: 'Chess Two' }, REXX);
  assert.deepEqual(calls, [['Chess Two', 'MOVE("e2", "e4")'], ['Chess Two', 'GETMOVES()']]);
  assert.deepEqual(replies[1].result.structuredContent, { result: 'e4' });
  assert.deepEqual(replies[2].result.structuredContent, { result: ['e2e4', 'd2d4'] });
});

test('chess_run: a refused command is a tool error with the app\'s reason, not a protocol error', async () => {
  const { replies } = await talk([INIT, call(2, 'chess_run', { command: 'BOGUS()' })], {}, REXX);
  assert.equal(replies[1].error, undefined);
  assert.equal(replies[1].result.isError, true);
  assert.equal(replies[1].result.content[0].text, 'Function BOGUS is not available');
});

// ---- chess_list_commands

test('chess_list_commands: each function a line of signature, does and gives, sorted', async () => {
  const { replies, calls } = await talk([INIT, call(2, 'chess_list_commands', {})]);
  assert.deepEqual(calls.map((c) => c[1]), ['LISTCOMMANDS(1)']);
  const lines = replies[1].result.content[0].text.split('\n');
  assert.equal(lines[0], 'GETMOVEHISTORYSAN(): The moves made so far, in SAN; gives a stem');
  const move = replies[1].result.structuredContent.commands.find((c) => c.name === 'MOVE');
  assert.deepEqual(move.params.map((x) => [x.name, x.type, x.optional]), [['from', 'square', false], ['to', 'square', false], ['promotion', 'piece', true]]);
});

test('chess_list_commands with a name: that one in full; one it does not have, a tool error', async () => {
  const { replies } = await talk([INIT, call(2, 'chess_list_commands', { name: 'move' }), call(3, 'chess_list_commands', { name: 'NOPE' })]);
  assert.equal(replies[1].result.content[0].text, [
    'MOVE(from, to, [promotion])',
    'Makes a move, from a square to a square, for the side to move; gives the move in SAN.',
    '  from: square',
    '  to: square',
    '  promotion: piece, optional (queen if left out, when the move promotes)',
  ].join('\n'));
  assert.equal(replies[2].result.isError, true);
});

// ---- failures and the protocol

test('no app to ask: a tool error carrying sae-bus\'s reason', async () => {
  const { replies } = await talk([INIT, call(2, 'chess_board', {})], { FAKE_BUS_NO_APP: '1' });
  assert.equal(replies[1].result.isError, true);
  assert.equal(replies[1].result.content[0].text, 'no chess app to ask: sae-bus: no courier file at /nonexistent/.control-bus');
});

test('an answer that is not JSON is said so, not thrown', async () => {
  const { replies } = await talk([INIT, call(2, 'chess_board', {})], { FAKE_BUS_GARBLED: '1' });
  assert.equal(replies[1].result.isError, true);
  assert.match(replies[1].result.content[0].text, /something other than JSON: not json/);
});

test('protocol errors: an unknown tool, an unknown method, a line that is not JSON', async () => {
  const { replies } = await talk([INIT, call(2, 'chess_nope', {}), { jsonrpc: '2.0', id: 3, method: 'resources/list' }, '{not json']);
  assert.equal(replies[1].error.code, -32602);
  assert.equal(replies[2].error.code, -32601);
  assert.equal(replies[3].error.code, -32700);
  assert.equal(replies[3].id, null);
});

test('requests are answered in the order they came, one bus call at a time', async () => {
  const msgs = [INIT];
  for (let i = 0; i < 6; i++) msgs.push(call(10 + i, 'chess_run', { command: `MOVESAN("m${i}")` }));
  const { replies, calls } = await talk(msgs, {}, REXX);
  assert.deepEqual(replies.slice(1).map((r) => r.id), [10, 11, 12, 13, 14, 15]);
  assert.deepEqual(calls.map((c) => c[1]), msgs.slice(1).map((m) => m.params.arguments.command));
});
