// app/chess/bitboard.ts: the QUnit "Bitboard" case of src/test.js, then
// what it left as TODO: the knight and king movement tables at the edges
// and in the middle, and the shifts across the 32-bit seam.
import { Bitboard } from "./chess/bitboard.ts";
import { getIndexFromAlgebraic as sq, getAlgebraicFromIndex } from "./chess/chess.ts";
import { eq } from "./lib/check.ts";

eq("light and dark squares, 32 each, 64 together",
  [Bitboard.makeLightSquares().popcnt(), Bitboard.makeDarkSquares().popcnt(), Bitboard.makeLightSquares().xor(Bitboard.makeDarkSquares()).popcnt()], [32, 32, 64]);
eq("a file and a rank have 8", Array.from({ length: 8 }, (_, k) => [Bitboard.makeFile(k).popcnt(), Bitboard.makeRank(k).popcnt()]).flat().every((n) => n === 8), true);
eq("diagonal l has 8 - |l|", Array.from({ length: 15 }, (_, i) => i - 7).every((l) => Bitboard.makeDiagonal(l).popcnt() === 8 - Math.abs(l) && Bitboard.makeAntidiagonal(l).popcnt() === 8 - Math.abs(l)), true);

// The pairwise case: every i in is against every j in js.
const is = [0, 1, 7, 8, 31, 32, 55, 56, 62, 63];
const js = [0, 15, 31, 32, 40, 63];
let fails: string[] = [];
const check = (label: string, ok: boolean) => { if (!ok) fails.push(label); };
for (const i of is) {
  const bbi = Bitboard.makeIndex(i);
  check(`makeIndex(${i}) has one bit`, bbi.popcnt() === 1 && !bbi.isEmpty());
  for (const j of js) {
    let or = Bitboard.makeIndex(i).or(Bitboard.makeIndex(j));
    const hi = Bitboard.makeIndex(i > j ? i : j);
    check(`popLowestBit ${i},${j}`, or.popLowestBit().isEqual(i === j ? Bitboard.ZERO : hi));
    or = Bitboard.makeIndex(i).or(Bitboard.makeIndex(j));
    check(`or ${i},${j}`, !or.isEmpty() && or.popcnt() === (i === j ? 1 : 2) && or.getLowestBitPosition() === (i < j ? i : j));
    check(`isSet/isClear ${i},${j}`, or.isSet(i) && or.isSet(j) && !or.isClear(i) && !or.isClear(j) && bbi.isSet(j) === (j === i) && bbi.isClear(j) === (j !== i));
    const xor = Bitboard.makeIndex(i).xor(Bitboard.makeIndex(j));
    check(`xor ${i},${j}`, xor.popcnt() === (i === j ? 0 : 2) && xor.isEmpty() === (i === j));
    const bbj = bbi.dup();
    bbj.setBit(j);
    check(`setBit ${i},${j}`, bbj.isEqual(or) && JSON.stringify(bbj) === JSON.stringify(or));
    bbj.clearBit(j);
    check(`clearBit ${i},${j}`, bbj.isEqual(i === j ? Bitboard.ZERO : bbi));
  }
}
eq("the pairwise case: or, xor, set, clear, lowest bit, across both halves", fails, []);

// Edge masks: the movement tables.
const squares = (bb: Bitboard) => bb.indices().map(getAlgebraicFromIndex);
eq("a knight on a1 reaches b3 and c2; on h8, f7 and g6", [squares(Bitboard.KNIGHT_MOVEMENTS[sq("a1")]), squares(Bitboard.KNIGHT_MOVEMENTS[sq("h8")])], [["c2", "b3"], ["g6", "f7"]]);
eq("a knight on e4 reaches 8 squares, none wrapping", squares(Bitboard.KNIGHT_MOVEMENTS[sq("e4")]), ["d2", "f2", "c3", "g3", "c5", "g5", "d6", "f6"]);
eq("a knight on b1 does not wrap to the h file", squares(Bitboard.KNIGHT_MOVEMENTS[sq("b1")]), ["d2", "a3", "c3"]);
eq("a king on a1 reaches 3; on e4, 8; on h5, 5", [Bitboard.KING_MOVEMENTS[sq("a1")].popcnt(), Bitboard.KING_MOVEMENTS[sq("e4")].popcnt(), Bitboard.KING_MOVEMENTS[sq("h5")].popcnt()], [3, 8, 5]);
eq("a king on h1 reaches g1, g2, h2, not a-file squares", squares(Bitboard.KING_MOVEMENTS[sq("h1")]), ["g1", "g2", "h2"]);
eq("the tables are 64 long, the files and ranks 8, the diagonals 15", [Bitboard.KNIGHT_MOVEMENTS.length, Bitboard.KING_MOVEMENTS.length, Bitboard.FILES.length, Bitboard.RANKS.length, Bitboard.DIAGONALS.length, Bitboard.ANTIDIAGONALS.length], [64, 64, 8, 8, 15, 15]);
eq("FILES[0] is the a file, RANKS[7] the 8th, DIAGONALS[7] h1-a8 (the old engine's naming), ANTIDIAGONALS[7] a1-h8",
  [squares(Bitboard.FILES[0])[0], squares(Bitboard.FILES[0]).length, squares(Bitboard.RANKS[7]), squares(Bitboard.DIAGONALS[7]), squares(Bitboard.ANTIDIAGONALS[7])],
  ["a1", 8, ["a8", "b8", "c8", "d8", "e8", "f8", "g8", "h8"], ["h1", "g2", "f3", "e4", "d5", "c6", "b7", "a8"], ["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8"]]);

// Shifts, across the seam between the halves.
eq("shl across 32: bit 31 to bit 32; shl 40: bit 0 to 40; shl 63", [Bitboard.makeIndex(31).shl(1).indices(), Bitboard.makeIndex(0).shl(40).indices(), Bitboard.makeIndex(0).shl(63).indices()], [[32], [40], [63]]);
eq("shr across 32: bit 32 to bit 31; shr 40: bit 63 to 23; shr 63", [Bitboard.makeIndex(32).shr(1).indices(), Bitboard.makeIndex(63).shr(40).indices(), Bitboard.makeIndex(63).shr(63).indices()], [[31], [23], [0]]);
eq("shiftLeft: negative is right, beyond 63 clears, 0 is nothing", [Bitboard.makeIndex(40).shiftLeft(-8).indices(), Bitboard.makeOne().shiftLeft(64).isEmpty(), Bitboard.makeOne().shiftLeft(-64).isEmpty(), Bitboard.makeIndex(5).shiftLeft(0).indices()], [[32], true, true, [5]]);
eq("a rank shifted up a rank is the next rank", Bitboard.RANKS[3].dup().shl(8).isEqual(Bitboard.RANKS[4]), true);
eq("shr fills with zeros, not the sign", Bitboard.makeOne().shr(1).isEqual(Bitboard.make(0xFFFFFFFF, 0x7FFFFFFF)), true);
eq("not, and_not, and the tables shared untouched", [Bitboard.makeZero().not().isEqual(Bitboard.ONE), Bitboard.makeOne().and_not(Bitboard.LIGHT_SQUARES).isEqual(Bitboard.DARK_SQUARES), Bitboard.ONE.popcnt(), Bitboard.ZERO.popcnt()], [true, true, 64, 0]);
eq("the 32-bit helpers", [Bitboard.popcnt32(0), Bitboard.popcnt32(0xFFFFFFFF), Bitboard.popcnt32(0x80000001), Bitboard.popLowestBit32(0x80000001), Bitboard.getLowestBitPosition32(0x80000000), Bitboard.getLowestBitPosition32(1)], [0, 32, 2, 0x80000000, 31, 0]);

// expect: ok light and dark squares, 32 each, 64 together
// expect: ok a file and a rank have 8
// expect: ok diagonal l has 8 - |l|
// expect: ok the pairwise case: or, xor, set, clear, lowest bit, across both halves
// expect: ok a knight on a1 reaches b3 and c2; on h8, f7 and g6
// expect: ok a knight on e4 reaches 8 squares, none wrapping
// expect: ok a knight on b1 does not wrap to the h file
// expect: ok a king on a1 reaches 3; on e4, 8; on h5, 5
// expect: ok a king on h1 reaches g1, g2, h2, not a-file squares
// expect: ok the tables are 64 long, the files and ranks 8, the diagonals 15
// expect: ok FILES[0] is the a file, RANKS[7] the 8th, DIAGONALS[7] h1-a8 (the old engine's naming), ANTIDIAGONALS[7] a1-h8
// expect: ok shl across 32: bit 31 to bit 32; shl 40: bit 0 to 40; shl 63
// expect: ok shr across 32: bit 32 to bit 31; shr 40: bit 63 to 23; shr 63
// expect: ok shiftLeft: negative is right, beyond 63 clears, 0 is nothing
// expect: ok a rank shifted up a rank is the next rank
// expect: ok shr fills with zeros, not the sign
// expect: ok not, and_not, and the tables shared untouched
// expect: ok the 32-bit helpers
