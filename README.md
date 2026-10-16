# Chess: a chess program you can script in REXX

Kaj Björklund's [JavaScript Chess](https://github.com/kbjorklu/chess) (MIT,
2013: bitboards, a full move generator with castling, en passant and
promotion, an alpha-beta computer player), being carried over to
[sae](https://github.com/aether-lang-dev/sae-it-aint-so) so it runs
natively on aether-ui (GTK4, AppKit, Win32) with no DOM, every action a
command, and every command reachable from REXX: scripts in the app, sae's
control bus from any program on the machine, and an MCP server. The plan,
in stages, each step one tested commit: [TODO.md](TODO.md).

| Folder | What it is | Licence |
|---|---|---|
| [`app/`](app/) | **The chess app, current.** A sae app in sae's TypeScript dialect: `app.json` (its manifest), `chess.ts` (the page), `chess/` (the game with no ui: the engine ported from `src/`, then the game, its commands and its REXX functions). | MIT |
| [`CHESS_COMMANDS.md`](CHESS_COMMANDS.md) | **The REXX reference**: every function, the old `ADDRESS CHESS` lines, the control bus and the MCP server; generated from `app/chess/described.ts` by `tools/gen-commands.mjs`, so it cannot drift. | MIT |
| [`rexx/`](rexx/) | REXX scripts that drive the running app over sae's control bus (`ADDRESS CHESS`, `rexx/chess-address.js`, run by RexxJS's CLI): the old iframe demo's scripts and a game by the control functions. | MIT |
| [`mcp/`](mcp/) | An MCP server: an AI client plays and drives the running app over the control bus (`chess_move`, `chess_board`, `chess_call`, `chess_run_program`, `chess_list_commands`; `--tools=json\|rexx\|all`). | MIT |
| [`tests/`](tests/) | `headless/` (the model, on sae's lowerer harness), `specs/` (the page, through sae-driver), `lib/` (the specs' driver verbs). | MIT |
| `src/`, `chess.html`, `chess.css`, `src-tauri/`, `chess-controlbus-demo.html`, `dist/` | **The old DOM app**, as it was: the engine in plain JavaScript, a jQuery board, the `ADDRESS CHESS` handler and in-app script runner, a webpack build, a Tauri wrapper and an iframe control bus ([docs/tauri-rexxjs-phases-done.md](docs/tauri-rexxjs-phases-done.md); the old `CHESS_COMMANDS.md` is in history before 2.7 of TODO.md). It stays until the sae app has taken in what it did, then goes to history. | MIT |

## The sae app

```
app/
  app.json          the installed app's manifest: its start page and grants
                    (documents, the control bus)
  chess.ts          the page
  chess/            the game with no ui: chess.ts, bitboard.ts, zobrist.ts,
                    move.ts, position.ts, parser.ts (the engine, ported from
                    src/*.js, stage 1 of TODO.md), game.ts (a game over a
                    position: moves, undo/redo, the result), commands.ts
                    (every action a command: id, label, params), control.ts
                    and described.ts (the REXX functions, each described),
                    script.ts (REXX scripts: ADDRESS CHESS, the old
                    commands by their old names), line.ts (a command
                    line), rexxjs.js (RexxJS, generated); to come in
                    TODO.md's order: ai.ts
tests/
  headless/         chess_*.ts: the model, one file per area, "// expect:"
                    lines as verdicts (perft the oracle for the move
                    generator, chess_speed its timing against a budget);
                    chess -> ../../app/chess; lib/check.ts
  specs/            spec_app_chess*.ae: the page in sae-driver
  lib/              chessdriver.ae: the specs' verbs for the page
tools/bundle-rexxjs.mjs   re-vendors RexxJS (below)
vendor/rexxjs/      RexxJS, a copy: its interpreter and parser, UPSTREAM the commit
run-tests.sh        all of it, through the sae beside this checkout
```

### Running it

With sae checked out and built beside this repository (`sae -> ../sae`;
`./build.sh` there, and `AETHER_UI_WITH_DRIVER=1 ./build.sh` for the
driver the specs use):

```bash
../sae/target/build/bin/sae --app app
```

`--control-bus` after it switches on the control bus, so other programs on
this machine can drive the game (sae's `docs/control-bus.md`): `sae-bus
Chess 'MOVE("e2", "e4")'` sends one request, and REXX scripts reach it by
`ADDRESS CHESS` ([rexx/README.md](rexx/README.md)).

### Testing it

```bash
./run-tests.sh
```

runs the header check (`tools/check-headers.sh`: every port names its
origin, [LICENSING.md](LICENSING.md)), the reference check (`CHESS_COMMANDS.md`
is what `node --no-warnings tools/gen-commands.mjs` makes of
`LISTCOMMANDS(1)`; run it to regenerate), the headless tests, the MCP
server's protocol tests and the specs,
one line of PASS or FAIL each, with
logs under `target/run-tests/`. `./run-tests.sh headless` runs only the
headless tests; `./run-tests.sh spec_app_chess` only that spec.
`SAE_DIR=...` picks another sae checkout. On Linux with no display it runs
under `xvfb-run`. The REXX scripts' spec (`spec_app_chess_rexx`) needs
`node` and RexxJS checked out beside this repository
(`RexxJS -> ../RexxJS`); the MCP server's tests (`mcp`,
`spec_app_chess_mcp`) need `node`.

### Re-vendoring RexxJS

```bash
node tools/bundle-rexxjs.mjs ../RexxJS
```

copies RexxJS's interpreter and parser into `vendor/rexxjs/` (recording the
commit in `UPSTREAM`) and regenerates `app/chess/rexxjs.js`, the one module
the app imports. RexxJS is the canonical source of the REXX language;
changes to it go there first.

## The old app

The engine's files in `src/` are described in the old README's terms:
`chess.js` (constants and utilities), `bitboard.js` (64-bit bit twiddling as
two 32-bit halves), `zobrist.js` (the position hash), `move.js` (a move),
`position.js` (the game state, move generation, make and unmake),
`parser.js` (algebraic notation), `ai.js` (alpha-beta with a simple
evaluation), `ui.js` (the jQuery board), `test.js` (QUnit tests, run by
`src/test.html`). `build/compile.sh` minified it with the Closure compiler
to `chess.min.js`; `webpack.config.js` and `src-tauri/` wrap it for Tauri;
`npm run build` builds `dist/`. The old README's to-do list (static
exchange evaluation, a transposition table, iterative deepening, killer
moves, underpromotion, captured pieces shown, loading a game from notation)
is folded into [TODO.md](TODO.md)'s stages 3 to 5.

## Licence

MIT ([LICENSING.md](LICENSING.md)). The engine is Kaj Björklund's, copyright
2013, and its ports keep that ([LICENSE](LICENSE)); the sae app and its
tests are the Aether contributors'. The old app's
third-party pieces (jQuery, jQuery UI, Touch Punch, QUnit) are MIT and are
not part of the sae app.
