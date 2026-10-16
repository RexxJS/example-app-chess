# An MCP server for the chess app

`chess-mcp.js` lets an AI client (Claude, or any MCP client) play and drive
a running chess game. It speaks MCP over stdio and sends each tool call to
the app over its control bus, through sae's `sae-bus`, as
`rexx/chess-address.js` does for REXX scripts. It needs only node, with no
packages. Its shape is the spreadsheet's (`aether-lang-dev/spraedsheet`,
`mcp/`).

## Using it

Start the app with its control bus on:

```bash
../sae/target/build/bin/sae --app app --control-bus
```

Then add the server to the client. For Claude Code:

```bash
claude mcp add chess -- node /path/to/chaess/mcp/chess-mcp.js
```

Or in a client's JSON configuration:

```json
{ "mcpServers": { "chess": { "command": "node", "args": ["/path/to/chaess/mcp/chess-mcp.js"] } } }
```

`SAE_BUS` names another `sae-bus` (the default is `../sae/target/sae-bus`),
`CHESS_APP` another app name (default `Chess`), and `SAE_APPDATA_DIR` the
app's data folder when it was started with one.

## Which tools: `--tools=json`, `rexx` or `all`

Set when the server starts, by `--tools=...` after the script or
`CHESS_MCP_TOOLS` (the flag wins):

| Setting | Tools | For |
|---|---|---|
| `json` (the default) | `chess_move`, `chess_board`, `chess_call`, `chess_run_program`, `chess_list_commands` | any model, any client: arguments are JSON, and nothing needs escaping |
| `rexx` | `chess_run`, `chess_run_program`, `chess_board`, `chess_list_commands` | those who would write the app's REXX commands themselves |
| `all` | all six | both |

## The tools

| Tool | What it does |
|---|---|
| `chess_move` | Makes a move: `{"from": "e2", "to": "e4"}` (with `"promotion": "knight"` when a pawn promotes; queen if left out), or `{"san": "Nf3"}`. Gives the move in SAN and the position after it: FEN, whose turn, the status and the result. |
| `chess_board` | Reads the game: the diagram, the FEN, whose turn, the status and result, the moves made in SAN, and every legal move (`{from, to, piece, capture, promotion, san, coordinate}`), as structured content. |
| `chess_call` | Calls one of the app's functions by name, its arguments a JSON list: `{"function": "SETPOSITION", "args": ["<fen>"]}`; or several in turn, as one step: `{"calls": [...]}`. The arguments are checked against the function's description (how many, and of what kind: a square, a piece, a side, a level) before anything is sent, and a refusal names the argument. |
| `chess_run_program` | Runs a whole REXX program in the app, next to the game: loops, conditions, routines, `SAY`, calling the same functions as `chess_call` (`m = LISTLEGALMOVES()` is a stem a program loops over). One step of undo, all or nothing; its `SAY` lines and `RESULT` come back. Sent as it is (base64 JSON to the app's `RUN_PROGRAM`), so nothing in it needs escaping. |
| `chess_list_commands` | Lists the app's functions (about thirty), each as its signature (`MOVE(from, to, [promotion])`), what it does and what it gives, from the app's `LISTCOMMANDS(1)` (`app/chess/described.ts`); with a `name`, one in full. |
| `chess_run` | Runs one command of REXX, e.g. `MOVESAN("e4"); MOVESAN("e5")`, or an old line by `CHESSCOMMAND("move from=e2 to=e4")`. |

## What a client should know

The tools' descriptions say it too:

- **Each call is one step of undo** in the app: whatever one call does, the
  person takes it back with one Undo.
- **All or nothing.** A call that fails part way is taken back whole, and
  the error says so: "(nothing it did was kept)".
- **Request and reply only.** The client is not told when the person moves
  on the board, so it should read the board again before moving.
- **A program is sandboxed and bounded.** It runs in the page's own
  JavaScript engine inside the sae process, with the game's functions and
  nothing else. sae stops one stretch of work past 5 s, and the bus answers
  for a request still running at 10 s; either way the app takes the request
  back whole.
- **One call at a time**, each answered within 10 seconds, on this machine
  only (sae's `docs/control-bus.md`).
- **The computer player**: `AIMOVE()` (through `chess_call`) makes the
  computer's move at the level `SETAIDIFFICULTY(n)` set, so a client can
  play against it, or have it play both sides.

## Tests

```bash
./run-tests.sh mcp                  # the protocol, with a stand-in for sae-bus
./run-tests.sh spec_app_chess_mcp   # the app driven through the server
```

`tests/mcp/server.test.js` runs on `node --test` against
`tests/mcp/fake-sae-bus.js`; `tests/specs/spec_app_chess_mcp.ae` starts the
app with `--control-bus`, makes each call through `tests/mcp/drive.js` (its
larger arguments in `tests/mcp/args/`), and checks the page.
