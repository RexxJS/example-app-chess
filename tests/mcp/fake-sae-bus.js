#!/usr/bin/env node
// A stand-in for sae's sae-bus, for mcp/'s protocol tests: `fake-sae-bus.js
// <app> <command>` answers as sae-bus does (one line of JSON, or a reason on
// stderr and a non-zero exit), from canned answers chosen by the command.
// Each call's arguments are appended to $FAKE_BUS_LOG, one JSON array a line.
'use strict';
const fs = require('fs');

const [app, command] = process.argv.slice(2);
if (process.env.FAKE_BUS_LOG) fs.appendFileSync(process.env.FAKE_BUS_LOG, JSON.stringify([app, command]) + '\n');

const answer = (result) => process.stdout.write(JSON.stringify({ success: true, result, errorCode: 0, error: '' }) + '\n');
const refuse = (error) => process.stdout.write(JSON.stringify({ success: false, result: null, errorCode: 1, error }) + '\n');
const stem = (xs) => Object.fromEntries([[0, xs.length], ...xs.map((x, i) => [i + 1, x])]);
const param = (name, type, optional = 0, about = '', variadic = 0) => ({ name, type, optional, variadic, about });
const described = (name, signature, does, gives, params) => ({ name, signature, does, gives, params: stem(params) });

// What LISTCOMMANDS(1) gives, for a few of the app's functions.
const FUNCTIONS = [
  described('MOVE', 'MOVE(from, to, [promotion])', 'Makes a move, from a square to a square, for the side to move', 'the move in SAN',
    [param('from', 'square'), param('to', 'square'), param('promotion', 'piece', 1, 'queen if left out, when the move promotes')]),
  described('MOVESAN', 'MOVESAN(move)', 'Makes a move named in algebraic notation', 'the move in SAN', [param('move', 'san')]),
  described('UNDO', 'UNDO()', 'Takes back the last move', 'how many moves came back', []),
  described('SETPOSITION', 'SETPOSITION(fen)', 'Sets up a position', 'its FEN', [param('fen', 'fen')]),
  described('SETAIDIFFICULTY', 'SETAIDIFFICULTY(level)', "Sets the computer player's level", 'the level', [param('level', 'level')]),
  described('RESIGN', 'RESIGN([side])', 'Resigns', 'the result', [param('side', 'side', 1)]),
  described('GETMOVEHISTORYSAN', 'GETMOVEHISTORYSAN()', 'The moves made so far, in SAN', 'a stem', []),
];

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const info = (fen, toPlay, moves) => ({ status: 'in_progress', toPlay, isCheck: 0, legalMoveCount: 20, halfMoveClock: 0, fullMoveNumber: 1, result: '*', fen, lastMove: '', moves: stem(moves), canUndo: 0, canRedo: 0, aiLevel: 2, aiSide: 'none', flipped: 0, board: '  a b c d e f g h\n...' });

// BATCH_EXECUTE(BASE64_DECODE('<json, base64>'), 1): each call's canned
// result. A MOVE from e7 (white's turn, as the fake has it) fails, which
// stops it, as the app's does.
function batch(json) {
  const calls = JSON.parse(json);
  const results = [];
  for (const [index, c] of calls.entries()) {
    if (c.command === 'MOVE' && c.args[0] === 'e7') return refuse(`command ${index + 1} (MOVE): e7 to e5 is not a legal move for white (nothing it did was kept)`);
    let result = 'OK';
    if (c.command === 'MOVE') result = c.args[0] === 'e2' ? 'e4' : 'a8=' + String(c.args[2] || 'q').charAt(0).toUpperCase();
    else if (c.command === 'MOVESAN') result = c.args[0];
    else if (c.command === 'GETGAMEINFO') result = info('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', 'black', ['e4']);
    else if (c.command === 'LISTLEGALMOVES') result = stem([{ from: 'e7', to: 'e5', piece: 'P', capture: 0, promotion: '', san: 'e5', coordinate: 'e7e5' }, { from: 'g8', to: 'f6', piece: 'N', capture: 0, promotion: '', san: 'Nf6', coordinate: 'g8f6' }]);
    else if (c.command === 'GETMOVEHISTORYSAN') result = stem(['e4', 'e5']);
    else if (c.command === 'UNDO') result = 1;
    results.push({ index, command: c.command, success: true, result });
  }
  answer(JSON.stringify(results));
}

const BATCH = /^BATCH_EXECUTE\(BASE64_DECODE\('([A-Za-z0-9+/=]*)'\), 1\)$/;
const PROGRAM = /^RUN_PROGRAM\(BASE64_DECODE\('([A-Za-z0-9+/=]*)'\), "json"\)$/;

// RUN_PROGRAM(BASE64_DECODE('<json string, base64>'), "json"): its SAY lines
// said back, RESULT from a `LET RESULT =` line; one with BOOM in it fails.
function program(json) {
  const text = JSON.parse(json);
  if (text.includes('BOOM')) return refuse("Subroutine 'BOOM' not found (nothing it did was kept)");
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  const said = lines.filter((l) => l.trim().startsWith('SAY ')).map((l) => l.trim().slice(4).replace(/^"|"$/g, ''));
  const m = /LET RESULT = (.*)/.exec(text);
  answer({ said: stem(said), result: m ? m[1].trim() : '' });
}

if (process.env.FAKE_BUS_NO_APP) {
  process.stderr.write('sae-bus: no courier file at /nonexistent/.control-bus\n');
  process.exit(1);
} else if (process.env.FAKE_BUS_GARBLED) {
  process.stdout.write('not json\n');
} else if (PROGRAM.test(command)) {
  program(Buffer.from(PROGRAM.exec(command)[1], 'base64').toString('latin1'));
} else if (BATCH.test(command)) {
  batch(Buffer.from(BATCH.exec(command)[1], 'base64').toString('latin1'));
} else if (command === 'LISTCOMMANDS(1)') {
  answer(stem(FUNCTIONS));
} else if (command === 'GETMOVES()') {
  answer(stem(['e2e4', 'd2d4']));
} else if (command.startsWith('BOGUS')) {
  refuse('Function BOGUS is not available');
} else if (command.startsWith('MOVE')) {
  answer('e4');
} else if (command === 'GETFEN()') {
  answer(START);
} else {
  answer(null);
}
