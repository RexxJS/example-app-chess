# Chess RexxJS Commands Reference

## Overview

Chess now supports RexxJS scripting via the `ADDRESS CHESS` command interface. This allows you to script game moves, analyze positions, and control the AI programmatically.

## Quick Start

### In-App Execution

```rexx
/* Make opening moves */
ADDRESS CHESS "move from=e2 to=e4"
ADDRESS CHESS "move from=c7 to=c5"

/* Check game status */
ADDRESS CHESS "get-status"
SAY "Game: " RESULT

/* Get available moves */
ADDRESS CHESS "get-moves"
SAY "Legal moves: " RESULT

/* Display board */
ADDRESS CHESS "get-board"
SAY RESULT
```

### Iframe Control Bus

```rexx
/* Send commands from RexxJS script frame to Chess worker frame */
ADDRESS CHESS "move from=d2 to=d4"
SAY "Move executed!"

ADDRESS CHESS "get-legal-moves"
SAY "Options: " RESULT
```

## Command Reference

### Game Control Commands

#### move
Make a move on the chess board.

```rexx
ADDRESS CHESS "move from=e2 to=e4"
```

**Parameters:**
- `from` (string, required) - Source square (e.g., "e2")
- `to` (string, required) - Destination square (e.g., "e4")

**Returns:** Success status with move notation
**Error Codes:** 10-19
**Example:** `ADDRESS CHESS "move from=e2 to=e4"`

---

#### new-game
Start a fresh chess game from the initial position.

```rexx
ADDRESS CHESS "new-game"
```

**Returns:** Success status
**Error Codes:** 71-79

---

#### undo
Undo the last move.

```rexx
ADDRESS CHESS "undo"
```

**Returns:** Success status
**Error Codes:** 51-59

---

#### redo
Redo the last undone move.

```rexx
ADDRESS CHESS "redo"
```

**Returns:** Success status
**Error Codes:** Varies (not yet implemented)

---

### Board Query Commands

#### get-board
Get the current board position as an ASCII diagram.

```rexx
ADDRESS CHESS "get-board"
SAY RESULT
```

**Returns:** ASCII board diagram with piece symbols
**Result Format:**
```
  a b c d e f g h
8 ♜ ♞ ♝ ♛ ♚ ♝ ♞ ♜ 8
7 ♟ ♟ ♟ ♟ ♟ ♟ ♟ ♟ 7
6 . . . . . . . . 6
5 . . . . . . . . 5
4 . . . . ♙ . . . 4
3 . . . . . . . . 3
2 ♙ ♙ ♙ ♙ . ♙ ♙ ♙ 2
1 ♖ ♘ ♗ ♕ ♔ ♗ ♘ ♖ 1
  a b c d e f g h
```
**Error Codes:** 21-29

---

#### get-moves
Get list of legal moves in algebraic notation.

```rexx
ADDRESS CHESS "get-moves"
SAY "Available: " RESULT
```

**Returns:** JSON array of move strings
**Result Format:** `["e2e4", "d2d4", "g1f3", ...]`
**Error Codes:** 31-39

---

#### list-legal-moves
Get detailed information about all legal moves.

```rexx
ADDRESS CHESS "list-legal-moves"
SAY RESULT
```

**Returns:** JSON array of move objects
**Result Format:**
```json
[
  {"from": "e2", "to": "e4", "piece": "P", "isCapture": false, "isCheck": false},
  {"from": "d2", "to": "d4", "piece": "P", "isCapture": false, "isCheck": false},
  ...
]
```
**Error Codes:** 41-49

---

#### get-position-fen
Get the current position in FEN notation.

```rexx
ADDRESS CHESS "get-position-fen"
SAY "FEN: " RESULT
```

**Returns:** FEN string
**Result Format:** `rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1`
**Error Codes:** 111-119

---

### Game Status Commands

#### get-status
Get current game status.

```rexx
ADDRESS CHESS "get-status"
SAY "Status: " RESULT
```

**Returns:** JSON object with game status
**Result Format:**
```json
{
  "status": "in_progress|check|checkmate|stalemate",
  "toPlay": "white|black",
  "isCheck": true/false,
  "legalMoves": 20
}
```
**Error Codes:** 91-99

---

#### get-game-info
Get comprehensive game information.

```rexx
ADDRESS CHESS "get-game-info"
SAY RESULT
```

**Returns:** JSON object with full game state
**Result Format:**
```json
{
  "status": "in_progress",
  "toPlay": "white",
  "isCheck": false,
  "legalMoveCount": 20,
  "halfMoveClock": 0,
  "fullMoveNumber": 1,
  "board": "[ASCII board diagram]"
}
```
**Error Codes:** 121-129

---

#### get-move-history
Get list of all moves played.

```rexx
ADDRESS CHESS "get-move-history"
SAY "History: " RESULT
```

**Returns:** JSON array of moves
**Result Format:** `["e2e4", "c7c5", "d2d4", ...]`
**Error Codes:** 101-109

---

### AI Control Commands

#### set-ai-difficulty
Set the AI search depth/difficulty level.

```rexx
ADDRESS CHESS "set-ai-difficulty level=3"
```

**Parameters:**
- `level` (number, required) - Difficulty level 1-4 (deeper search)

**Returns:** Success status
**Error Codes:** 81-89

---

## Error Handling

Every command sets the `RC` variable to indicate success or failure:

```rexx
ADDRESS CHESS "move from=e2 to=e4"
IF RC = 0 THEN
    SAY "Move succeeded"
ELSE
    SAY "Error: RC=" RC
```

### Common Error Codes

- **0** - Success
- **1** - Chess game not initialized
- **2** - Unknown command
- **10-19** - Move command errors (illegal move, missing parameters)
- **21-29** - Get-board command errors
- **31-39** - Get-moves command errors
- **41-49** - List-legal-moves command errors
- **51-59** - Undo command errors
- **71-79** - New-game command errors
- **81-89** - AI difficulty command errors
- **91-99** - Get-status command errors
- **99** - Unexpected error

The `RESULT` variable contains additional information about the operation.

## Example Scripts

### Example 1: Opening Sequence

```rexx
/* Play a common opening sequence */
ADDRESS CHESS "move from=e2 to=e4"
SAY "1. e4"

ADDRESS CHESS "move from=c7 to=c5"
SAY "1... c5 (Sicilian Defense)"

ADDRESS CHESS "move from=g1 to=f3"
SAY "2. Nf3"

ADDRESS CHESS "get-status"
SAY "Status: " RESULT
```

### Example 2: Analyze Position

```rexx
/* Get detailed position information */
ADDRESS CHESS "get-board"
SAY "Current Board:"
SAY RESULT

ADDRESS CHESS "get-status"
SAY "Game Status:"
SAY RESULT

ADDRESS CHESS "list-legal-moves"
SAY "Legal Moves:"
SAY RESULT

ADDRESS CHESS "get-position-fen"
SAY "FEN: " RESULT
```

### Example 3: Move Validation

```rexx
/* Try moves and validate them */
ADDRESS CHESS "move from=e2 to=e4"
IF RC = 0 THEN
    SAY "✓ e2-e4 is legal"
ELSE
    SAY "✗ e2-e4 is illegal: " RC

ADDRESS CHESS "move from=e2 to=e5"
IF RC = 0 THEN
    SAY "✓ e2-e5 is legal"
ELSE
    SAY "✗ e2-e5 is illegal (pawn can only move 1 or 2 squares)"
```

### Example 4: Undo/Redo

```rexx
/* Make and undo moves */
ADDRESS CHESS "move from=e2 to=e4"
SAY "Made move: e2-e4"

ADDRESS CHESS "get-status"
initial_status = RESULT

ADDRESS CHESS "undo"
SAY "Undo executed"

ADDRESS CHESS "get-status"
after_undo = RESULT

ADDRESS CHESS "redo"
SAY "Redo executed"

ADDRESS CHESS "get-status"
final_status = RESULT
```

### Example 5: AI Difficulty Levels

```rexx
/* Test different AI difficulty levels */
DO level = 1 TO 4
    ADDRESS CHESS "new-game"
    ADDRESS CHESS "set-ai-difficulty level=" level
    SAY "AI difficulty set to level " level

    /* Make white's opening move */
    ADDRESS CHESS "move from=e2 to=e4"
    SAY "White: e2-e4"

    /* Let AI respond (black automatically moves when it's black's turn) */
    ADDRESS CHESS "get-moves"
    SAY "After AI move, " RESULT.0 " legal moves remain"
END
```

## Integration Modes

### Mode 1: In-App Execution

Scripts run within the Chess application context. Use `ADDRESS CHESS` directly.

**Best for:**
- Tauri desktop app
- Single-frame deployments
- Direct game manipulation

### Mode 2: Iframe Control Bus

Scripts run in a separate director frame and communicate with Chess worker frame via postMessage RPC.

**Best for:**
- Multi-frame deployments
- Sandboxed script execution
- Distributed architectures

See `chess-controlbus-demo.html` for an example implementation.

## Performance Considerations

- **Move validation**: Instant (uses cached legal move list)
- **Board analysis**: <10ms (ASCII generation)
- **FEN generation**: <5ms
- **AI thinking**: Varies by level (1-5 seconds typical)

## Security Notes

- Move validation is enforced at the chess engine level
- No arbitrary code execution is possible through commands
- All inputs are validated before use
- Commands are executed in app context with full access to game state

## Debugging

Enable logging to see command execution details:

```javascript
// In browser console
window.DEBUG_CHESS = true;

// Then run script - detailed logs will appear
ADDRESS CHESS "get-moves"
```

## Changelog

### Version 1.0
- Initial release with 12+ commands
- In-app execution support
- Iframe control bus demo
- Full move validation
- AI difficulty control
- Error handling with RC/RESULT variables
