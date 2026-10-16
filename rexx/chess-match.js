/*!
 * chess-match | MIT License (../LICENSE)
 * @rexxjs-meta=CHESS_MATCH_META
 */
/**
 * ADDRESS MATCH: several running chess apps at once, from one REXX
 * program, each named by the command's first word (TODO.md 6.1):
 *
 *   REQUIRE "./chess-match.js"
 *   ADDRESS MATCH
 *   'white AIMOVE()'            to the app called white
 *   'black MOVESAN("e4")'       to the app called black
 *
 * An app's name finds its data folder in the environment: CHESS_WHITE_DIR
 * for "white", CHESS_BLACK_DIR for "black" (CHESS_<NAME>_DIR, the name in
 * capitals): the SAE_APPDATA_DIR it was started with, where its control
 * bus wrote its courier file. The rest of the command is as ADDRESS CHESS
 * takes it (chess-address.js): a control function's call, or an old
 * ADDRESS CHESS line. RC 0 and RESULT when it worked; 1 and ERRORTEXT when
 * the app refused; 2 when there was no such app to ask.
 */

function CHESS_MATCH_META() {
  return {
    type: 'address-target',
    name: 'sae chess apps, several at once',
    version: '1.0.0',
    description: 'ADDRESS MATCH: "<app> <command>" to one of several sae chess apps over their control buses',
    provides: { addressTarget: 'match', commandSupport: true, methodSupport: false },
    dependencies: {},
    loaded: true,
    requirements: { environment: 'nodejs' }
  };
}

function ADDRESS_MATCH_HANDLER(command, context, sourceContext) {
  const path = require('path');
  const { execFile } = require('child_process');
  const { chessRequest } = require(path.join(__dirname, 'chess-address.js'));
  const text = String(command).trim();
  const space = text.search(/\s/);
  const name = space < 0 ? text : text.slice(0, space);
  const rest = space < 0 ? '' : text.slice(space + 1).trim();
  const dir = process.env['CHESS_' + name.toUpperCase() + '_DIR'];
  if (!/^[A-Za-z][\w-]*$/.test(name) || !rest) {
    return Promise.resolve({ success: false, errorCode: 2, errorMessage: 'ADDRESS MATCH takes "<app> <command>", not "' + text + '"', output: '' });
  }
  if (!dir) {
    return Promise.resolve({ success: false, errorCode: 2, errorMessage: 'no app called ' + name + ': set CHESS_' + name.toUpperCase() + '_DIR to its data folder', output: '' });
  }
  const bus = process.env.SAE_BUS || path.join(__dirname, '..', 'sae', 'target', 'sae-bus');
  return new Promise((resolve) => {
    execFile(bus, ['--courier', path.join(dir, '.control-bus'), chessRequest(rest)], { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, errorCode: 2, errorMessage: name + ': ' + ((stderr || '').trim() || error.message), output: '' });
        return;
      }
      let answer;
      try {
        answer = JSON.parse(stdout);
      } catch (e) {
        resolve({ success: false, errorCode: 2, errorMessage: name + ': sae-bus answered with something other than JSON', output: '' });
        return;
      }
      if (answer.success) resolve({ success: true, output: answer.result === null ? '' : answer.result });
      else resolve({ success: false, errorCode: 1, errorMessage: name + ': ' + answer.error, output: '' });
    });
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CHESS_MATCH_META, ADDRESS_MATCH_HANDLER };
}
if (typeof global !== 'undefined') {
  global.CHESS_MATCH_META = CHESS_MATCH_META;
  global.ADDRESS_MATCH_HANDLER = ADDRESS_MATCH_HANDLER;
}
