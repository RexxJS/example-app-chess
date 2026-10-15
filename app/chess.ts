"seeks documents, reduced functionality without";
"seeks control-bus, reduced functionality without";
// Chess, the sae app: Kaj Björklund's JavaScript Chess (MIT, 2013) carried
// over to sae, so it runs natively on aether-ui with no DOM, every action a
// command and every command reachable from REXX (TODO.md).
//
// app/chess/ is the game with no ui: the engine (chess.ts, bitboard.ts,
// zobrist.ts, move.ts, position.ts, parser.ts, ported from src/*.js),
// then the game, its commands, the control functions and the scripts.
// This page is the ui, declared over the commands; it is empty until
// stage 3 of TODO.md, and says so.
ui.text("Chess");
ui.text("The board comes in stage 3 of TODO.md; the engine is tested headless meanwhile.");
