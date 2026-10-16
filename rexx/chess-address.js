/*!
 * chess-address | MIT License (../LICENSE)
 * @rexxjs-meta=CHESS_ADDRESS_META
 */
/**
 * ADDRESS CHESS for the sae chess app (../app/), ARexx style, from any
 * REXX program on this machine:
 *
 *   REQUIRE "./chess-address.js"
 *   ADDRESS CHESS
 *   'MOVE("e2", "e4")'           a control function (control.ts)
 *   "move from=e7 to=e5"         or an old ADDRESS CHESS line, as before
 *   'GETBOARD()'
 *   SAY RESULT
 *
 * A command with a call in it ("MOVE(...)", "GETFEN()") is a string of
 * REXX the app works out, with its control functions; one without (the old
 * "move from=e2 to=e4", "get-board", or a command line such as "game.move
 * san=Nf3") is sent as CHESSCOMMAND("<the line>"), which runs it as a
 * script's ADDRESS CHESS does. RC is 0 when it worked and RESULT what it
 * came to; else RC is 1 and ERRORTEXT says why. A command runs in the app,
 * so it sees the app's names, not this script's variables: put values in
 * the string.
 *
 * The app must be running with its control bus on
 * (`sae --app app --control-bus`). The bus is sae's: a port chosen at
 * random and a key fresh for every launch, in a courier file only this user
 * can read, and every message sealed (sae's docs/control-bus.md). This
 * library does none of that itself: it runs sae's `sae-bus` command, which
 * reads the courier file, seals, sends and opens the answer.
 *
 *   SAE_BUS            the sae-bus to run (default: ../sae/target/sae-bus,
 *                      beside this repository's sae link)
 *   CHESS_APP          the app's name, which finds its courier file
 *                      (default "Chess", app/app.json's name)
 *   SAE_APPDATA_DIR    the app's data folder, when the app was started
 *                      with one (sae-bus reads it)
 *
 * RC is 2 when there was no app to ask (not running, the bus off, or the
 * answer did not open), with sae-bus's reason in ERRORTEXT.
 */

function CHESS_ADDRESS_META() {
  return {
    type: 'address-target',
    name: 'sae chess control bus',
    version: '1.0.0',
    description: 'ADDRESS CHESS: commands to the sae chess app over its sealed control bus',
    provides: {
      addressTarget: 'chess',
      commandSupport: true,
      methodSupport: false
    },
    dependencies: {},
    loaded: true,
    requirements: {
      environment: 'nodejs'
    }
  };
}

// A command as the app's bus takes it: REXX with a call in it as it is,
// any other line carried by CHESSCOMMAND, in a REXX string (a quote in it
// written twice).
function chessRequest(command) {
  const text = String(command).trim();
  if (/[A-Za-z_][\w.]*\s*\(/.test(text)) return text;
  return 'CHESSCOMMAND("' + text.replace(/"/g, '""') + '")';
}

// One command, through sae-bus: {success, errorCode, errorMessage, output}.
function ADDRESS_CHESS_HANDLER(command, context, sourceContext) {
  const { execFile } = require('child_process');
  const bus = process.env.SAE_BUS || require('path').join(__dirname, '..', 'sae', 'target', 'sae-bus');
  const app = process.env.CHESS_APP || 'Chess';
  return new Promise((resolve) => {
    execFile(bus, [app, chessRequest(command)], { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        const why = (stderr || '').trim() || error.message;
        resolve({ success: false, errorCode: 2, errorMessage: why, output: '' });
        return;
      }
      let answer;
      try {
        answer = JSON.parse(stdout);
      } catch (e) {
        resolve({ success: false, errorCode: 2, errorMessage: 'sae-bus answered with something other than JSON', output: '' });
        return;
      }
      if (answer.success) {
        resolve({ success: true, output: answer.result === null ? '' : answer.result });
      } else {
        resolve({ success: false, errorCode: 1, errorMessage: answer.error, output: '' });
      }
    });
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CHESS_ADDRESS_META, ADDRESS_CHESS_HANDLER, chessRequest };
}
if (typeof global !== 'undefined') {
  global.CHESS_ADDRESS_META = CHESS_ADDRESS_META;
  global.ADDRESS_CHESS_HANDLER = ADDRESS_CHESS_HANDLER;
}
