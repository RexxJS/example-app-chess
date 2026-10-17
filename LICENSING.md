# Licensing

| What | License | Text |
|---|---|---|
| The engine: its ports under `app/chess/` and `app/native/engine.ae`, of the old app's `src/chess.js`, `bitboard.js`, `zobrist.js`, `move.js`, `position.js`, `parser.js`, `ai.js` and `test.js` (in history, last at e32f320) | MIT, Kaj Björklund 2013 | [LICENSE](LICENSE) |
| The sae app and its tests: `app/` (but for the ports and the vendored RexxJS), `rexx/`, `mcp/`, `tests/`, `tools/`, `docs/`, `asks/`, `CHESS_COMMANDS.md`, `run-tests.sh` | MIT, Aether contributors | [LICENSE](LICENSE) |
| `vendor/rexxjs/` and `app/chess/rexxjs.js` (RexxJS, vendored and bundled) | MIT | [vendor/rexxjs/LICENSE](vendor/rexxjs/LICENSE) |

A port under `app/chess/` keeps the engine's copyright: its header names the
`src/*.js` file it came from and Kaj Björklund; `tools/check-headers.sh`
(run by `run-tests.sh`) checks that every such file does, and that the
RexxJS bundle says it is generated. The old DOM app (its own files, and
its third-party pieces: jQuery, jQuery UI, Touch Punch, QUnit, all MIT) is
in history, last at e32f320; none of it was part of the sae app.
