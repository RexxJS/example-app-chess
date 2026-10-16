// The computer player's search and evaluation, piece by piece (TODO.md
// 4.3): node counts falling with the move ordering (the table's move,
// killers, history) and the transposition table; static exchange
// evaluation, by the swap list; the game's phase in the evaluation (the
// king's middle and end game tables).
import { Position } from "./chess/position.ts";
import { fromFen, parseMove } from "./chess/parser.ts";
import { AI, PHASE_MAX, evaluate, gamePhase, getPieceSquareValue, see } from "./chess/ai.ts";
import { PieceColor } from "./chess/chess.ts";
import { eq } from "./lib/check.ts";

// ---- node counts fall with ordering and the table

const quiet = "r2q1rk1/1b2bppp/p2ppn2/1p6/3NP3/1BN1B3/PPP2PPP/R2Q1RK1 w - - 0 11";
const nodes = (o: { ordering?: boolean; table?: boolean }) => {
  const a = new AI(o);
  a.search(fromFen(quiet), 3);
  return a.nodes;
};
const plain = nodes({ ordering: false, table: false }), ordered = nodes({ table: false }), both = nodes({});
eq("ordering (the table's move, killers, history) cuts the nodes at level 3 to under a third", ordered * 3 < plain, true);
eq("and the table with it, no more", both <= ordered, true);

// ---- static exchange evaluation

const S = (fen: string, mv: string) => {
  const p = fromFen(fen);
  return see(p, parseMove(p, mv)!);
};
eq("a queen takes a pawn a pawn defends: loses 800", S("4k3/8/3p4/4p3/8/8/7Q/4K3 w - - 0 1", "h2e5"), -800);
eq("a queen takes a loose pawn: wins 100", S("4k3/8/8/4p3/8/8/7Q/4K3 w - - 0 1", "h2e5"), 100);
eq("doubled rooks take a pawn a rook defends: the rook behind makes it 100", S("4k3/4r3/8/4p3/8/8/4R3/4RK2 w - - 0 1", "e2e5"), 100);
eq("a rook takes a knight a rook defends: 300 (black does better not to take back)", S("4k3/4r3/8/4n3/8/8/4R3/4RK2 w - - 0 1", "e2e5"), 300);
eq("and a pawn defending it too: -200", S("4k3/4r3/3p4/4n3/8/8/4R3/4RK2 w - - 0 1", "e2e5"), -200);

// ---- the game's phase

eq("the phase: 24 at the start, 0 with kings and pawns", [gamePhase(new Position()), gamePhase(fromFen("4k3/pppp4/8/8/8/8/PPPP4/4K3 w - - 0 1"))], [PHASE_MAX, 0]);
const KING_ON: Record<string, string> = { e4: "7k/8/8/8/4K3/8/8/8 w - - 0 1", g1: "7k/8/8/8/8/8/8/6K1 w - - 0 1" };
const kingOn = (sq: string) => fromFen(KING_ON[sq]);
eq("the king: castled is better in the middle game, the centre in the end game", [
  getPieceSquareValue(kingOn("g1"), PieceColor.WHITE, PHASE_MAX) > getPieceSquareValue(kingOn("e4"), PieceColor.WHITE, PHASE_MAX),
  getPieceSquareValue(kingOn("e4"), PieceColor.WHITE, 0) > getPieceSquareValue(kingOn("g1"), PieceColor.WHITE, 0),
], [true, true]);
eq("so with kings and pawns, a king in the centre is worth more", evaluate(fromFen("7k/p7/8/8/4K3/8/P7/8 w - - 0 1")) > evaluate(fromFen("7k/p7/8/8/8/8/P7/6K1 w - - 0 1")), true);

// expect: ok ordering (the table's move, killers, history) cuts the nodes at level 3 to under a third
// expect: ok and the table with it, no more
// expect: ok a queen takes a pawn a pawn defends: loses 800
// expect: ok a queen takes a loose pawn: wins 100
// expect: ok doubled rooks take a pawn a rook defends: the rook behind makes it 100
// expect: ok a rook takes a knight a rook defends: 300 (black does better not to take back)
// expect: ok and a pawn defending it too: -200
// expect: ok the phase: 24 at the start, 0 with kings and pawns
// expect: ok the king: castled is better in the middle game, the centre in the end game
// expect: ok so with kings and pawns, a king in the centre is worth more
