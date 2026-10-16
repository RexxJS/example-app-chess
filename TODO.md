# To do: the chess app, reimagined on sae

The app today (2026-10-15): Kaj Björklund's JavaScript Chess (MIT, 2013;
bitboards, a full move generator, an alpha-beta computer player, a jQuery
UI board) with what was added for RexxJS (`docs/tauri-rexxjs-phases-done.md`):
`ADDRESS CHESS` with 12 commands (`CHESS_COMMANDS.md`), in-app script
execution, an iframe control bus demo, 21 Playwright tests, a Tauri
wrapper and a webpack build. It needs what the spreadsheet had
(aether-lang-dev/spraedsheet, once `RexxJS/example-app-spreadsheet`): a
full migration to sae, so it runs natively on aether-ui (GTK4, AppKit,
Win32) with no DOM, every action a command, every command reachable from
REXX (scripts, sae's sealed control bus, an MCP server), and RexxJS
vendored in the same way. How the RexxJS distribution pieces come in
properly is for another day; until then the vendoring is a copy, as the
spreadsheet's is.

**Breadth** is every part the app has now, carried over with nothing
lost, then what a chess program should have. **Depth** is how far each
part goes: a headless test of the model, a spec of what the ui shows, a
REXX function described, a file format, a measured speed. Each step is
one commit with its tests; a step done is struck through with its date.
Shaped after the spreadsheet's `TODO.md` and `AGENTS.md`: read those
first.

## The rules every step follows

1. **The engine is a model with no ui** (`app/chess/*.ts`, sae's
   TypeScript dialect, lowered to QuickJS): tested headless on sae's
   lowerer harness (`tests/headless/`, `// expect:` lines), the QUnit
   tests ported, perft counts the oracle.
2. **Every action is a command** (`commands.ts`: id, label, params,
   undo/redo), run by the ui's buttons, by scripts, over the bus and from
   the MCP server alike; the ui reads the model and runs commands, as the
   spreadsheet's panels do.
3. **Everything is REXX.** Each command has a control function
   (`control.ts`), described (`described.ts`: parameters, kinds, what it
   does and gives, `LISTCOMMANDS(1)`), so `ADDRESS CHESS` in a script, the
   bus and `spreadsheet_call`'s chess twin reach it with no further work.
   A step whose feature a REXX program cannot drive is not done.
4. **RexxJS is canonical for REXX**: `vendor/rexxjs/` a copy made by
   `tools/bundle-rexxjs.mjs ../RexxJS` (the spreadsheet's), `UPSTREAM`
   recording the commit; fixes go to RexxJS first.
5. **Nothing of the old DOM app survives but the engine's logic and the
   command names.** jQuery, webpack, Tauri and the iframe bus go when the
   sae app has taken in what they did (the spreadsheet did the same:
   `tauri/` deleted, history keeps it). The MIT licence and Kaj
   Björklund's copyright stay with the engine.

## Stage 0: the shape of the repository

| # | Step | Tests prove | REXX |
|---|---|---|---|
| 0.1 | ~~The sae app skeleton beside the old one: `app/app.json` (name Chess, start `/chess`, grants: documents, controlBus), `app/chess.ts` (an empty page), `app/chess/`, `tests/headless/`, `tests/specs/`, `tests/lib/`, `run-tests.sh` running sae's harnesses through `sae -> ../sae`, `RexxJS -> ../RexxJS`; `AGENTS.md`, `README.md` rewritten for it~~ (done 2026-10-15: `tests/headless/chess_harness.ts`, `tests/specs/spec_app_chess.ae` on `tests/lib/chessdriver.ae`) | `./run-tests.sh`: one headless test and one spec pass, green from the first commit | |
| 0.2 | ~~RexxJS vendored: `tools/bundle-rexxjs.mjs` (from spraedsheet), `vendor/rexxjs/` with `UPSTREAM`, `app/chess/rexxjs.js` generated; a headless test runs a one-line REXX program on it~~ (done 2026-10-15: `tests/headless/chess_rexxjs.ts`; RexxJS's `SAY` says its words, so `SAY 1+1` says `1+1` and `x = 1+1; SAY x` says 2, both checked) | headless: `SAY 1+1` gives 2 on the vendored interpreter | the interpreter itself |
| 0.3 | ~~Licensing: `LICENSE` (MIT, Kaj Björklund 2013 for the engine; the app and its tests MIT, Aether contributors), `LICENSING.md` as the spreadsheet's; the RexxJS copy's licence beside it~~ (done 2026-10-15: `tools/check-headers.sh`, the `headers` entry of `run-tests.sh`) | a check that every source file's header names its origin where it is a port | |

## Stage 1: the engine, ported and proven

| # | Step | Tests prove | REXX |
|---|---|---|---|
| 1.1 | ~~`chess.ts`: constants, utilities, pieces, colours, squares (the old `chess.js`)~~ (done 2026-10-15; `getIndexFromAlgebraic` gives -1 for what is no square, where the old gave a wrong index) | headless `chess_utilities`: the QUnit "utilities" cases | |
| 1.2 | ~~`bitboard.ts`: 64-bit boards as two 32-bit halves (QuickJS has no 64-bit ints; the old code did the same), shifts, masks, popcount, lowest bit~~ (done 2026-10-15; the knight and king tables and the shifts across the halves tested too, which the old tests left as TODO) | headless `chess_bitboard`: the QUnit "Bitboard" cases, plus edge masks | |
| 1.3 | ~~`zobrist.ts`: the position hash~~ (done 2026-10-15; the random table seeded, so a hash is the same from run to run) | headless: the QUnit "Zobrist" cases; the same position reached two ways hashes alike | |
| 1.4 | ~~`move.ts`: a move (from, to, kind, piece, capture, promotion, castle) and its text~~ (done 2026-10-15; `getCoordinate()` beside `getString()`, for `e2e4`/`e7e8q`) | headless: the QUnit "Move" cases | |
| 1.5 | ~~`position.ts`: the game state, move generation (pseudo-legal and legal, captures only), make and unmake, castling rights, en passant, promotion, check, the fifty-move rule, threefold repetition, insufficient material, status (in progress, check, checkmate, stalemate, the draws)~~ (done 2026-10-15: perft 4 from the start = 197281 exact and quick enough on QuickJS, Kiwipete to 3, positions 3 to 6; two old bugs fixed: the halfmove clock not restored on unmake, threefold needing a fourth occurrence; `fullmoveNumber`, `Status.CHECK`, `empty()`/`putPiece()` for set-up) | headless `chess_position`: the QUnit cases and **perft** to depth 4 from the start and from the standard test positions (Kiwipete and the rest), node counts exact; hashing after make/unmake | |
| 1.6 | ~~`parser.ts`: FEN in and out, a move from text (coordinate `e2e4`, `e7e8q`, and SAN `Nf3`, `O-O`, `exd5`, `e8=Q`)~~ (done 2026-10-15: `fromFen` says what is wrong with a FEN; `toSan` with disambiguation, `+` and `#`; the old `parseMoves` kept; the position test's perft positions read through `fromFen`) | headless `chess_parser`: the QUnit cases, FEN round-trips, SAN for every move kind | |
| 1.7 | ~~Speed on QuickJS measured: perft 4 and the AI's depth-3 search timed in a headless test with a stated budget, so a slower lowering shows~~ (done 2026-10-15 for perft: `chess_speed`, perft 4 from the start 3.0-3.1 s and Kiwipete perft 3 1.9 s on an M-series Mac, budgets 60 s and 30 s; the AI's depth-3 timing joins the file at 4.1, when `ai.ts` exists) | headless: timings asserted loosely (an order of magnitude) | |

## Stage 2: commands, REXX, the bus, the MCP server

| # | Step | Tests prove | REXX |
|---|---|---|---|
| 2.1 | ~~`game.ts`: a game over a position: the move list, undo and redo (the old app's redo was never implemented: it is here), new game, a position set from FEN, whose turn, the result~~ (done 2026-10-15: undo and redo in steps, a group of moves (one control-bus request's) folding into one step; resign and a draw agreed; the settings the commands keep (level, side, flip) live here; `saved()`/`restore()` put a game back whole) | headless `chess_game`: undo to the start and redo to the end, a new game clears the lists | |
| 2.2 | ~~`commands.ts`: `game.new`, `game.move` (from, to, [promotion]; or `san=`), `game.undo`, `game.redo`, `game.setPosition` (fen), `game.resign`, `game.offerDraw`, `ai.level`, `ai.side`, `ai.move`, `board.flip`, with labels and params; `game.state` for the ui~~ (done 2026-10-15: `game.move` takes `move=e2e4` too; `ai.move` answers "no computer player yet" until stage 4; `game.offerDraw` is agreed at once, there being no one to decline until then; `legalMovesOf` for LISTLEGALMOVES; a journal of the lines that changed the game, which replays) | headless `chess_commands`: each command, its refusal of a bad parameter, undo of each | |
| 2.3 | ~~`control.ts` and `described.ts`: `MOVE("e2", "e4")`, `MOVESAN("Nf3")`, `UNDO()`, `REDO()`, `NEWGAME()`, `SETPOSITION(fen)`, `GETBOARD()` (the ASCII diagram, as before), `GETFEN()`, `GETMOVES()`, `LISTLEGALMOVES()` (a stem of {from, to, piece, capture, promotion, san}), `GETSTATUS()`, `GETMOVEHISTORY()`, `GETGAMEINFO()`, `SETAIDIFFICULTY(n)`, `AIMOVE()`, `PIECEAT("e4")`, `ISCHECK()`, `LISTCOMMANDS([described])`, `BATCH_EXECUTE(json, [stop])`, `RUN_PROGRAM(text, [encoding])`: the old 12 commands by their old names too (`move from=e2 to=e4` as `ADDRESS CHESS` lines)~~ (done 2026-10-15; also RESIGN, OFFERDRAW, GETMOVEHISTORYSAN, GETTURN, GETRESULT, GETAIDIFFICULTY, SETAISIDE, FLIPBOARD, CHESS_VERSION; the old names are mapped in `script.ts` at 2.4) | headless `chess_control` and `chess_described` (every function described, each one's parameters as many as it takes) | all of them |
| 2.4 | ~~`script.ts`: a REXX script with `ADDRESS CHESS` and these functions, on an interpreter of its own; the old `CHESS_COMMANDS.md` examples run as they are~~ (done 2026-10-16: the quick start and examples 1, 2, 4 and 5 as they are; example 3 waited on RexxJS taking `IF ... THEN` with its statement on the next line (`asks/rexxjs-if-then-next-line.md`), and runs as written since RexxJS d050b3d; RC 2 for an unknown command, 1 for a refused one, as before; a whole script one step of undo; `Commands.chess` runs a control-bus request, one step, taken back whole when it fails or `stopped()` is told sae stopped it) | headless `chess_rexx`: the five examples from `CHESS_COMMANDS.md` | scripts |
| 2.5 | ~~The control bus: `bus.serve` in the page with the stopped hook, one request one step of undo and taken back whole when it fails or sae stops it (as the spreadsheet's); `rexx/` holds `chess-address.js` (`ADDRESS CHESS` over `sae-bus`) and the scripts ported from the old demo~~ (done 2026-10-16: the page shows whose turn, the status, the moves and the FEN as text until stage 3, which the specs read; `CHESSCOMMAND(line)` carries an old `ADDRESS CHESS` line over the bus, whose requests are expressions; the old demo's four scripts and `play-a-game.rexx` in `rexx/`; over the bus RC is 1 for a refusal, 2 for no app) | spec `spec_app_chess_bus` and `spec_app_chess_rexx` (the scripts run by RexxJS's CLI against the app, the board checked) | `ADDRESS CHESS` from any REXX on the machine |
| 2.6 | ~~An MCP server, `mcp/chess-mcp.js`, the spreadsheet's shape: `chess_move`, `chess_board` (the diagram, FEN, legal moves, status, as structured content), `chess_call` (any function, arguments checked against `LISTCOMMANDS(1)`), `chess_run_program` (a whole REXX program, one undo step, sandboxed), `chess_list_commands`; `--tools=json|rexx|all`~~ (done 2026-10-16: `chess_board` is one request of GETGAMEINFO and LISTLEGALMOVES; `chess_move` returns the position after; `--tools=rexx` and `all` add `chess_run`; `mcp/README.md`) | `mcp` (node --test against a stand-in sae-bus) and `spec_app_chess_mcp` | a model plays through it |
| 2.7 | ~~`CHESS_COMMANDS.md` rewritten from `described.ts` (generated, so it cannot drift), with the MCP and bus sections~~ (done 2026-10-16: `tools/gen-commands.mjs` asks `LISTCOMMANDS(1)` through `Commands.chess` on node's type stripping, and takes the old lines from `script.ts`; its examples are `rexx/reference-examples.rexx`, which `spec_app_chess_rexx` runs; `run-tests.sh`'s `commands-doc` entry is the check) | a check that the file matches `LISTCOMMANDS(1)` | |

## Stage 3: the page

| # | Step | Tests prove | REXX |
|---|---|---|---|
| 3.1 | ~~The board drawn in `vg`: 8 x 8, coordinates, light and dark squares, the pieces as glyphs (the Unicode chess set first; drawn pieces later), the last move and check marked; flipped for black~~ (done 2026-10-16: `app/chess/view/view.ts` (the states the panels read, as the spreadsheet's SheetView) and `board.ts`, every square and glyph bound to them; the outlined glyphs for white, the solid for black; spec `spec_app_chess_board` samples square colours and reads the glyphs from the scene's nodes) | spec: the board's pixels sampled at squares after `MOVE` (sae-driver's screenshot), flip | `FLIPBOARD()` |
| 3.2 | ~~Moving: click a piece, its legal targets shown, click a target; drag a piece (aether-ui pointer events on a `vg` canvas: check what sae gives a page; an ask if a drag is not there); a promotion choice (queen, rook, bishop, knight)~~ (done 2026-10-16: sae gives a vg shape `on_drag(fn(x, y, dx, dy))` and `on_drag_end(fn(x, y))`, and the driver `/canvas/{h}/click`, `move` and `release`, so no ask was needed; a press picks a piece and dots its targets, a press on a target or a drop on one moves, the glyph follows the pointer; a promotion waits for one of four buttons, or Cancel) | spec: a game of ten moves by clicks, an illegal click refused, a promotion | the same commands |
| 3.3 | ~~Beside the board: the move list (numbered, SAN, the current move marked; a click goes to that position: undo/redo to it), status (whose turn, check, checkmate, stalemate, the draw and why), captured pieces by side, material balance~~ (done 2026-10-16: `app/chess/view/sidebar.ts`; the list shows the moves ahead to redo too, so a click goes either way; `game.goto` and `GOTOMOVE(ply)` (a request's moves stay together), `GETCAPTURED()`; the status in words, the pieces taken and the balance from `game.ts`, tested headless) | spec: after moves the list reads so; a click on move 3 shows that position | `GETMOVEHISTORY()` |
| 3.4 | ~~Buttons and a menu bar: New game, Undo, Redo, Flip, Resign, Offer draw; Play as white/black/both/none; AI level; Open, Save; the script panel (a REXX script run in the page, its SAY lines shown: the old in-app execution)~~ (done 2026-10-16: sae had no menu bar for a page, so sae 8527bc6 adds `ui.menu`, `ui.menu_item` and `ui.menu_separator` for an installed app, on aether-ui's native bar; Open and Save write and read a game file (`game.export`/`game.import`, `EXPORTGAME()`/`IMPORTGAME(file)`), through documents, which 5.3 builds on; Play as, Level 1 to 4; `app/chess/view/toolbar.ts`, `scriptpanel.ts`) | spec: each button's command through the driver; the script panel runs a game | |
| 3.5 | ~~The script panel's recorder: moves made on the board written as a REXX script (`MOVE("e2", "e4")` lines) that replays the game~~ (done 2026-10-16: "Game as script" writes the game so far however its moves were made, a `MOVE` line a move with its SAN as a comment, `NEWGAME()` or `SETPOSITION` first, a resignation or draw last; `game.script`, `GAMESCRIPT()`) | spec: play, read the script, new game, run it, the same position | this is the REXX edge: a game is a program |
| 3.6 | ~~Looks: window padding, a dark mode, a resizable board that keeps square, keyboard moves (type `e2e4` or `Nf3` into a field)~~ (done 2026-10-16: the page in a column padded 16 px; a dark mode (`view.dark`, `DARKMODE([on])`, the "Dark mode" button and menu item: a page theme by `ui.styles` and the board's own palette); the board keeps square as the window widens (the viewBox fits uniformly, centred) and is resized by `view.boardSize` (`BOARDSIZE([px])`, Smaller, Larger: sae gives a page no resize event, so the size is a command); a move typed into a field, coordinate or SAN; the start position's pixels against `tests/specs/ref/board-start.grid`. The AeCS button colour and text field background are reported but not drawn: aether-ui `asks/aecs-button-fg-and-field-bg-not-drawn.md`) | spec: screenshot at a fixed size compared; the field | |

## Stage 4: the computer player

| # | Step | Tests prove | REXX |
|---|---|---|---|
| 4.1 | ~~`ai.ts`: the alpha-beta search and evaluation ported, levels 1 to 4 as depth; the AI's move as a command (`ai.move`) so it is one step of undo~~ (done 2026-10-16: level n is n half-moves then the captures, so level 4 is the old player; mate in one and a free queen found for either side, mate preferred to stalemate; `chess_speed` times it: level 4 on Kiwipete 2.2 s, near sae's 5 s, hence 4.2) | headless `chess_ai`: the QUnit "AI" cases; it finds mate in one and a free queen at level 2; deterministic at a level | `AIMOVE()`, `SETAIDIFFICULTY()` |
| 4.2 | ~~Thinking off the page's work: the search in slices under sae's 5 s-per-entry limit (an iterative deepening loop that yields between depths, or sae's background work if a page has it: check `ui.background_for`), the ui live meanwhile, a Stop~~ (done 2026-10-16: sae has no background work for a page (no `ui.background_for`; workers are a design, its page-services.md section 7), so `think.ts` slices by timers: ai.ts's `Thinking` deepens 1 to n a root move at a time, about 40 ms a slice and never past 600 ms (the depth in progress given up then); run to the end it is the old search, the same move. The page plays the side `ai.side` gives it, at the head of the game; Computer move, Stop; the board waits while it thinks; Undo against it takes back two; `AIMOVE()` over the bus thinks in slices too, which the spec shows fails without them) | spec: a level-4 move completes with the page answering the driver meanwhile | |
| 4.3 | ~~Strength, from the old README's list: iterative deepening, a transposition table on the Zobrist hash, move ordering (captures, killers), quiescence search, static exchange evaluation, game-phase and mobility in the evaluation, a little randomness among equal moves~~ (done 2026-10-16: negamax; a nearer mate worth more; the quiescence search finds mates in check and skips captures the exchange loses; the table's move, captures, killers, history: under a fifth of the nodes at level 3 on a quiet middle game; the king's end-game table by the phase; mobility by a pass over the board; equal moves at the root found as such, one chosen by the position's hash and a seed, so the same each time. Dearer a node (level 4 on Kiwipete 4.1 s, was 2.2 s), so the speed tests are their own file: saejs gives one 10 s) | headless: a position suite with the expected best moves per level; node counts fall with ordering | |
| 4.4 | The engine as a native: the search in Aether (a `contrib`-style native the page calls), the TypeScript one kept as the reference it is tested against | headless: both engines agree on the suite; the native one timed | |
| | ~~The engine in Aether, held to the TypeScript one~~ (done 2026-10-16: `native/engine.ae`, `tests/native/check.sh` (`run-tests.sh native`): perft exact on the six standard positions, every suite search (`tests/headless/chess_native_reference.ts`) the same line as ai.ts's, move, value, depth, ties, nodes and positions evaluated; level 4 on Kiwipete in about 8 ms. **Blocked: the page's call.** sae gives a page no way to reach native code an app ships (one prebuilt binary; every effect a service of its own, confined by its imports): `../sae/asks/app-native-modules.md` sets out what the app would use (`natives.engine.call(fn, arg)`, on an actor, confined to pure imports, installed apps only) and the questions it raises for sae (where it is compiled, the import check, the trust model, iOS). Until then the page plays with the TypeScript engine in slices (4.2)) | | |
| 4.5 | ~~Analysis: an evaluation and principal variation shown for the position, hints~~ (done 2026-10-16: `analysis.ts`: the value as "+0.35" or "#2" (a mate in so many moves, below 0 when black mates), the best move, the line from the table (`Thinking.pv`) numbered from the game's move; Analyse and Hint on the page (the hint's square picked), thought in slices, the line gone when the game moves on; `ai.analyze`, `ai.hint`, not journaled; `ANALYZE([depth])` a stem, `HINT()`, in slices over the bus as AIMOVE) | spec; headless `chess_analysis` | `ANALYZE(depth)` gives a stem; `HINT()` |

## Stage 5: files and notation

| # | Step | Tests prove | REXX |
|---|---|---|---|
| 5.1 | PGN: a game written (tags, SAN moves, result) and read (one game, comments and variations skipped but kept), through sae's `documents` | headless `chess_pgn`: round-trips, the standard sample games | `EXPORTPGN()`, `IMPORTPGN(text)` |
| 5.2 | FEN set-up: a position typed or pasted, the board from it; the start position editor (place pieces) | spec | `SETPOSITION(fen)` already |
| 5.3 | A game saved and opened as the app's own file (the move list, who plays, the level), autosave of the game in progress | spec `spec_app_chess_files` | `SAVEGAME`, `OPENGAME` |

## Stage 6: beyond the old app

| # | Step | Tests prove | REXX |
|---|---|---|---|
| 6.1 | Two apps play each other over the bus: a REXX script (RexxJS's CLI) driving two instances, or one instance's `AIMOVE()` against a scripted opening book | spec: a script plays twenty moves between two apps | the script is the tournament |
| 6.2 | Clocks: a time control per side, the flag falling, shown and scripted | headless `chess_clock` (a fake clock); spec | `SETCLOCK("5+3")` |
| 6.3 | Opening book: a small book the AI and a script can read; the opening's name shown | headless | `OPENINGNAME()` |
| 6.4 | Puzzles: a position, a goal (mate in n), checked; a set loaded from a file | headless; spec | `LOADPUZZLE(n)`, `PUZZLESOLVED()` |
| 6.5 | Chess960 start positions (the `factor-language/extra/chess960` checkout is a reference for the numbering only) | headless: the 960 positions enumerated, castling rules for them | `NEWGAME960(n)` |
| 6.6 | Accessibility: the board readable square by square by a screen reader (an aether-ui ask), keyboard-only play | spec via the driver | |

## Deliberately deferred

- **The RexxJS distribution pieces** (how an app takes RexxJS as a
  package rather than a vendored copy): another day, for all the family.
- **UCI engines**: the app is a sandbox; an outside engine is not in it.
  The native engine of 4.4 is the way to strength.
- **Online play**: the bus is the local machine; beyond it is designed in
  sae's `docs/control-bus.md`, not built.
