// The app's own puzzles (app/chess/puzzle.ts, TODO.md 6.4), each proved:
// a forced mate in exactly the moves it says, and none in fewer; and the
// FEN reader's refusal of a position whose side not to move is in check
// (such a "puzzle" would have the king taken: the mate search found it).
import { SET, mateDistance, parsePuzzles } from "./chess/puzzle.ts";
import { fromFen } from "./chess/parser.ts";
import { eq, throws } from "./lib/check.ts";

const t0 = Date.now();
for (const z of parsePuzzles(SET)) eq(`${z.title}: mate in exactly ${z.mateIn}`, mateDistance(fromFen(z.fen), z.mateIn), z.mateIn);
const ms = Date.now() - t0;   // about 2.5 s on QuickJS (an M-series Mac)
eq("proved inside the budget (6 s)", ms < 6000, true);
throws("a side left in check with the other to move", () => fromFen("k7/8/8/8/8/3K4/8/7Q w - - 0 1"), Error, "FEN: black is in check with white to move");

// expect: ok The back rank: mate in exactly 1
// expect: ok Four moves in: mate in exactly 1
// expect: ok Black's back-rank mate: mate in exactly 1
// expect: ok Smothered: mate in exactly 1
// expect: ok The rook ladder: mate in exactly 2
// expect: ok King and rook: mate in exactly 2
// expect: ok Black's king and rook: mate in exactly 2
// expect: ok The king comes up: mate in exactly 3
// expect: ok The rook cuts the board: mate in exactly 3
// expect: ok Black's king comes down: mate in exactly 3
// expect: ok proved inside the budget (6 s)
// expect: ok a side left in check with the other to move
