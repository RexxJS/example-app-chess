# Licensing

| What | License | Text |
|---|---|---|
| The engine: `src/chess.js`, `bitboard.js`, `zobrist.js`, `move.js`, `position.js`, `parser.js`, `ai.js`, `ui.js`, `test.js`, and their ports under `app/chess/` and `app/native/engine.ae` | MIT, Kaj Björklund 2013 | [LICENSE](LICENSE) |
| The sae app and its tests: `app/` (but for the ports and the vendored RexxJS), `rexx/`, `mcp/`, `tests/`, `tools/`, `docs/`, `asks/`, `CHESS_COMMANDS.md`, `run-tests.sh` | MIT, Aether contributors | [LICENSE](LICENSE) |
| `vendor/rexxjs/` and `app/chess/rexxjs.js` (RexxJS, vendored and bundled) | MIT | [vendor/rexxjs/LICENSE](vendor/rexxjs/LICENSE) |
| The old DOM app's own files (`src/chess-rexx-handler.js`, `execute-rexx.js`, `index.js`, `chess-controlbus-demo.html`, `src-tauri/`, `webpack.config.js`, `dist/`) | MIT | [LICENSE](LICENSE) |

A port under `app/chess/` keeps the engine's copyright: its header names the
`src/*.js` file it came from and Kaj Björklund; `tools/check-headers.sh`
(run by `run-tests.sh`) checks that every such file does, and that the
RexxJS bundle says it is generated. The old app's third-party pieces
(jQuery, jQuery UI, Touch Punch, QUnit) are MIT and are not part of the
sae app.
