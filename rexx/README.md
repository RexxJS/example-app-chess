# REXX scripts that drive the chess app

Scripts that control a running chess app from another program, ARexx
style: `ADDRESS CHESS`, then the old command lines (`move from=e2
to=e4`, `get-board`) or the control functions (`MOVE("e2", "e4")`,
`GETFEN()`) (MIT; see [../LICENSING.md](../LICENSING.md)).

| Script | What it does |
|---|---|
| `test-connection.rexx` | Checks the app answers, and says what to do when it does not |
| `opening-moves.rexx` | The old control-bus demo's "Play Opening Moves": a new game, e4 and c5 by the old command lines, the status |
| `get-moves.rexx` | The old demo's "Get Available Moves" |
| `show-board.rexx` | The old demo's "Display Board" |
| `game-status.rexx` | The old demo's "Get Game Status" |
| `play-a-game.rexx` | The control functions: the Scholar's mate, an illegal move refused, the result, one UNDO, LISTCOMMANDS |
| `match.rexx` | Two apps play each other (TODO.md 6.1): white's app and black's, each its own computer player, every move one makes sent to the other; the script is the tournament |
| `chess-address.js` | The ADDRESS library: `ADDRESS CHESS` for the sae app |
| `chess-match.js` | `ADDRESS MATCH`: several apps from one program, each command led by the app's name (`'white AIMOVE()'`), found by `CHESS_<NAME>_DIR` |

## Running them

From the repository's root, with sae built (including `target/sae-bus`)
and RexxJS checked out beside this repository (the `RexxJS` link):

```bash
../sae/target/build/bin/sae --app app --control-bus
```

then, in another terminal:

```bash
RexxJS/core/rexx rexx/opening-moves.rexx
```

`./run-tests.sh spec_app_chess_rexx` runs them all against the app and
checks what they say and what the page then shows.

A match needs two apps, each with its own data folder (where its courier
file goes):

```bash
SAE_APPDATA_DIR=/tmp/white ../sae/target/build/bin/sae --app app --control-bus &
SAE_APPDATA_DIR=/tmp/black ../sae/target/build/bin/sae --app app --control-bus &
CHESS_WHITE_DIR=/tmp/white CHESS_BLACK_DIR=/tmp/black RexxJS/core/rexx rexx/match.rexx -- 20 2 1
```

(twenty moves, white at level 2, black at level 1);
`./run-tests.sh spec_app_chess_match` plays one, white the driver's app.

## How a command reaches the app

```rexx
REQUIRE "./chess-address.js"
ADDRESS CHESS
'MOVE("e2", "e4")'
"move from=e7 to=e5"
'GETBOARD()'
SAY RC RESULT
```

The app's control bus is sae's (`../sae/docs/control-bus.md`): off unless
the app is started with `--control-bus`; a port chosen at random; a key
fresh for every launch, in a courier file only this user can read; every
request and answer sealed with it. `chess-address.js` runs sae's
`sae-bus Chess <request>` for each command, which finds the courier file,
seals, sends and prints the opened answer.

A request on the bus is one REXX expression the app works out. So a
command with a call in it (`MOVE("e2", "e4")`, or several:
`MOVESAN("e4"); MOVESAN("e5")`) goes as it is, and any other line (the
old `move from=e2 to=e4`, `get-status`, or a command line such as
`game.move san=Nf3`) goes as `CHESSCOMMAND("<the line>")`, which runs it
as a script's `ADDRESS CHESS` inside the app does.

RC is 0 and RESULT what the command came to when it worked; otherwise RC
is 1 and ERRORTEXT says why ("e2 to e4 is not a legal move for black").
RC is 2 when there was no app to ask (not running, or the bus off), with
sae-bus's reason in ERRORTEXT. `SAE_BUS`, `CHESS_APP` and
`SAE_APPDATA_DIR` point it elsewhere (the library's header says how).

Each command is one step of undo in the app, however many moves it makes,
and one that fails part way is taken back whole: "(nothing it did was
kept)".

## Where they differ from the old app's

The old app's bus was an iframe pair in one browser page
(`chess-controlbus-demo.html`), the director frame posting each command
to the chess frame. What changed:

- **Connecting.** The director frame became any REXX program on the
  machine: `REQUIRE "./chess-address.js"` and `ADDRESS CHESS`.
- **Error codes.** The old handler numbered its refusals (10-19 for a
  move, 21-29 for the board, ... `CHESS_COMMANDS.md`'s old table); RC is
  now 1 for any refusal, with the reason in ERRORTEXT, and 2 for no app
  (inside the app, an unknown command's RC is 2, as before).
- **The computer player** answers as the old app's did, but after the
  request rather than in it: with `SETAISIDE("black")`, a `move` for white
  is answered by the page with black's move a moment later (it thinks in
  slices, `app/chess/think.ts`). `AIMOVE()` makes the computer's move
  inside the request, and gives its SAN.
