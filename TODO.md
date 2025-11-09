# Chess RexxJS Integration TODO

## Project Overview
Converting the vanilla JavaScript chess game to support RexxJS scripting via:
1. Tauri desktop app wrapper
2. In-app RexxJS executor
3. Control bus (iframe-based)
4. Comprehensive test suite

## Implementation Phases

### Phase 1: Tauri Setup ⚠️ BLOCKED
- [ ] Initialize Tauri project structure
  - **STATUS**: Needs research on Tauri + existing vanilla JS integration
  - **BLOCKER**: Chess uses jQuery UI; need to verify compatibility with Tauri + modern build tools
  - **TODO**: Test Tauri integration with jQuery UI dependencies
- [ ] Migrate from CDN jQuery to npm/bundled
- [ ] Create `src-tauri/` with Cargo setup
- [ ] Build configuration for chess + Tauri

### Phase 2: RexxJS Command Bus API
- [ ] Design meaningful chess commands:
  - `ADDRESS CHESS "move from=a2 to=a4"` - Make a move
  - `ADDRESS CHESS "get-board"` - Get board state as ASCII or JSON
  - `ADDRESS CHESS "get-moves"` - List legal moves
  - `ADDRESS CHESS "undo"` - Undo last move
  - `ADDRESS CHESS "new-game"` - Start fresh game
  - `ADDRESS CHESS "set-ai-difficulty level=3"` - Change AI level
  - `ADDRESS CHESS "get-status"` - Game status (in progress, checkmate, stalemate, etc.)
  - `ADDRESS CHESS "get-move-history"` - Get list of moves played

- [ ] Create `chess-rexx-handler.js` (similar to photo-editor-rexxjs-control-handler.js)
  - Implement ADDRESS CHESS handler
  - Integrate with existing chess engine
  - Return proper result codes (RC variable)
  - Handle invalid moves with error messages

### Phase 3: In-App Execution
- [ ] Add RexxJS bundle to Tauri assets
- [ ] Create execute-rexx command handler
- [ ] Integrate with existing chess AI
- [ ] Test basic script execution

### Phase 4: Control Bus (Iframe)
- [ ] Create chess-controlbus.js bridge
  - ChessWorkerBridge for game frame
  - ChessDirectorBridge for script frame
  - postMessage RPC for moves and queries
- [ ] Create chess-controlbus-demo.html
  - Split view: script editor (left), chess board (right)
  - Script execution UI
- [ ] Verify chess move validation across iframe boundary

### Phase 5: Test Suite

#### A. Jest/Embedded Rexx Tests
- [ ] Test chess-rexx-handler.js
  - Mock chess engine moves
  - Verify ADDRESS CHESS command parsing
  - Validate result codes
  - Test invalid move handling

#### B. Playwright Tests
- [ ] In-app execution tests (5-7 tests)
  - Basic move execution
  - Illegal move rejection
  - AI move
  - Undo functionality
  - Game status tracking

- [ ] Iframe control bus tests (8-10 tests)
  - Move from director frame
  - Board state retrieval
  - Move history
  - AI configuration
  - Error handling

### Phase 6: Documentation
- [ ] Create CHESS_COMMANDS.md with all available commands
- [ ] Add example scripts (automated tournament, mate analysis)
- [ ] Update main README with RexxJS support section

## Special Considerations

1. **Chess Engine Complexity**: The chess.js library is sophisticated (~2900 lines). Need to carefully expose only relevant state.

2. **AI Integration**: Current AI uses minimax; ensure RexxJS can control difficulty level without breaking lookahead.

3. **Game State**: Moves must maintain full history for undo/redo and move validation.

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| jQuery UI incompatibility with modern bundlers | Medium | High | Test early with Webpack 5 + jQuery UI |
| AI complexity breaking under RexxJS control | Low | Medium | Careful API design, extensive testing |
| Move validation across boundaries | Low | Medium | Unit tests for move validation |

## Success Criteria

- [ ] All 9 core chess commands work via ADDRESS CHESS
- [ ] 15+ playwright tests passing
- [ ] Tauri app builds and runs
- [ ] Sample script can play automated game or analyze position
- [ ] Control bus demo shows distributed chess control

## Notes

- **Dependencies**: jQuery UI compatibility is key blocker
- **Complexity**: Medium - chess engine is well-designed but needs careful exposure
- **Timeline**: 2-3 days estimated (after Tauri unblocked)
- **Reusable patterns**: Control handler pattern from photo-editor is directly applicable
