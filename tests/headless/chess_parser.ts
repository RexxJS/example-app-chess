// app/chess/parser.ts: the QUnit "Parser" case of src/test.js (clean, two
// games read from text), then FEN round-trips and refusals, a move from
// text in coordinate and SAN forms, and SAN written for every kind of
// move, with its check and mate marks.
import { clean, parseMoves, parseMove, parseOneMove, toSan, toFen, fromFen, START_FEN } from "./chess/parser.ts";
import { Position } from "./chess/position.ts";
import { Kind } from "./chess/move.ts";
import { Piece, PieceColor, getIndex } from "./chess/chess.ts";
import { eq, throws } from "./lib/check.ts";

eq("clean strips comments, nested, and what is not notation", clean("A4   )(   (B- (C! ( ( D? ) ) E F)) G5"), "A4 G5");

// Kasparov v The World, 1999, with its comments (the QUnit case).
const game1 = parseMoves("1. e4 c5 2. Nf3 d6 3. Bb5+ Bd7 4. Bxd7+ Qxd7 5. c4 Nc6 6. Nc3 Nf6 7. 0-0 g6 8. d4 cxd4 9. Nxd4 Bg7 10. Nde2 Qe6!? (a novelty suggested by Irina Krush and considered a turning point for the World Team) 11. Nd5 Qxe4 12. Nc7+ Kd7 13. Nxa8 Qxc4 14. Nb6+ axb6 15. Nc3 Ra8 16. a4 Ne4 17. Nxe4 Qxe4 18. Qb3 f5 19. Bg5 Qb4 20. Qf7 Be5 21. h3 Rxa4 22. Rxa4 Qxa4 23. Qxh7 Bxb2 24. Qxg6 Qe4 25. Qf7 Bd4 26. Qb3 f4 27. Qf7 Be5 28. h4 b5 29. h5 Qc4 30. Qf5+ Qe6 31. Qxe6+ Kxe6 (see diagram) 32. g3 fxg3 33. fxg3 b4 (the World Team did not trust 33...Bxg3 34.h6 Be5 35.h7 Bg7 36.Rf8 b4 37.h8=Q Bxh8 38.Rxh8) 34. Bf4 Bd4+ 35. Kh1! b3 36. g4 Kd5 37. g5 e6 38. h6 Ne7 39. Rd1 e5 40. Be3 Kc4 41. Bxd4 exd4 42. Kg2 b2 43. Kf3 Kc3 44. h7 Ng6 45. Ke4 Kc2 46. Rh1 d3 (46...b1=Q? 47.Rxb1 Kxb1 48.Kxd4 and White will win) 47. Kf5 b1=Q 48. Rxb1 Kxb1 49. Kxg6 d2 50. h8=Q d1=Q 51. Qh7 b5?! 52. Kf6+ Kb2 53. Qh2+ Ka1 54. Qf4 b4? 55. Qxb4 Qf3+ 56. Kg7 d5 57. Qd4+ Kb1 58. g6 Qe4 59. Qg1+ Kb2 60. Qf2+ Kc1 61. Kf6 d4 62. g7 1–0");
const black1 = game1.getColorBitboard(PieceColor.BLACK), white1 = game1.getColorBitboard(PieceColor.WHITE);
eq("Kasparov v The World read to its end: black's three pieces", [black1.popcnt(), black1.isSet(2), black1.isSet(getIndex(3, 3)), black1.isSet(getIndex(3, 4))], [3, true, true, true]);
eq("and white's three", [white1.popcnt(), white1.isSet(getIndex(1, 5)), white1.isSet(getIndex(5, 5)), white1.isSet(getIndex(6, 6))], [3, true, true, true]);
const game2 = parseMoves("1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 c6 5. Nf3 Bg4 6. Bf4 e6 7. h3 Bxf3 8. Qxf3 Bb4 9. Be2 Nd7 10. a3 0-0-0");
eq("a game with a queen-side castle", [game2.getColorBitboard(PieceColor.BLACK).popcnt(), game2.getColorBitboard(PieceColor.WHITE).popcnt(), game2.getPieceBitboard(Piece.PAWN).popcnt()], [14, 14, 14]);
throws("a move that is none says where", () => parseMoves("1. e4 e5 2. Qh9"), Error, "Parse error in 'Qh9'");
throws("an ambiguous one too", () => parseMoves("1. Nf3 Nf6 2. Nc3 Nc6 3. Ng5 Ng4 4. Ne4"), Error, "Parse error in 'Ne4'");
eq("the result ends the reading; moves without a space after the number", [toFen(parseMoves("1.e4 e5 2.Nf3 1-0")), toFen(parseMoves("1. e4 ½-½ 2. e5"))],
  ["rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"]);

// FEN.
eq("the start position is START_FEN", toFen(new Position()), START_FEN);
const fens = [
  START_FEN,
  "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
  "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
  "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
  "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
  "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
  "8/8/8/2k5/3Pp3/8/8/4K3 b - d3 0 1",
];
eq("every FEN round-trips, the start, the perft positions, en passant squares for both sides", fens.map((f) => toFen(fromFen(f)) === f), fens.map(() => true));
eq("a FEN with the clocks left off reads with 0 and 1", toFen(fromFen("4k3/8/8/8/8/8/8/4K3 w")), "4k3/8/8/8/8/8/8/4K3 w - - 0 1");
eq("read, the perft positions give their counts: Kiwipete 48, position 3 14, with the en passant square taken from the FEN", [fromFen(fens[1]).perft(1), fromFen(fens[2]).perft(1), fromFen(fens[7]).getMoves().some((m) => m.getKind() === Kind.EN_PASSANT_CAPTURE)], [48, 14, true]);
eq("the hash of a position read equals that of the same position played", fromFen("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2").hashKey.isEqual(parseMoves("1. e4 e5").hashKey), true);
eq("what is wrong with a FEN is said", [
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1",
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPP/RNBQKBNR w KQkq - 0 1",
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNX w KQkq - 0 1",
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQ1BNR w KQkq - 0 1",
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1",
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQxq - 0 1",
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e4 0 1",
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - x 1",
  "rnbqkbnr",
].map((f) => { try { fromFen(f); return "read"; } catch (e) { return (e as Error).message; } }), [
  "FEN: 8 ranks, not 7",
  "FEN: rank 2 has 7 squares, not 8",
  "FEN: no piece 'X' in rank 1",
  "FEN: one king each, not 0 white and 1 black",
  "FEN: side to move is w or b, not 'x'",
  "FEN: castling rights are KQkq or -, not 'KQxq'",
  "FEN: en passant square 'e4' is not on rank 6",
  "FEN: the clocks are numbers, not 'x' and '1'",
  "FEN: 2 to 6 fields, not 1",
]);

// A move from text.
const start = new Position();
const coord = (p: Position, t: string) => parseMove(p, t)?.getCoordinate() ?? null;
eq("coordinate notation", [coord(start, "e2e4"), coord(start, "g1f3"), coord(start, "e2e5"), coord(start, "e3e4")], ["e2e4", "g1f3", null, null]);
eq("SAN: a pawn, a piece, with a check mark or a glyph after", [coord(start, "e4"), coord(start, "Nf3"), coord(start, "Nf3!?"), coord(start, "e4+")], ["e2e4", "g1f3", "g1f3", "e2e4"]);
const open = parseMoves("1. e4 d5 2. Nf3 Nc6");
eq("a capture, with x or :, or without", [coord(open, "exd5"), coord(open, "e:d5"), coord(open, "ed5"), coord(open, "Nxd5")], ["e4d5", "e4d5", "e4d5", null]);
const castles = fromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
eq("castling, as O-O or 0-0, either side", [coord(castles, "O-O"), coord(castles, "0-0"), coord(castles, "O-O-O"), coord(castles, "0-0-0")], ["e1g1", "e1g1", "e1c1", "e1c1"]);
const promo = fromFen("1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1");
eq("promotion: e8=Q, e8Q, e8(Q), e7e8q, and the plain square is the queen; a capture promotes too", [coord(promo, "a8=Q"), coord(promo, "a8Q"), coord(promo, "a8(N)"), coord(promo, "a7a8r"), coord(promo, "a8"), coord(promo, "axb8=N"), coord(promo, "a7b8b")],
  ["a7a8q", "a7a8q", "a7a8n", "a7a8r", "a7a8q", "a7b8n", "a7b8b"]);
const twoKnights = parseMoves("1. Nf3 Nf6 2. Nc3 Nc6 3. Ng5 Ng4");
eq("ambiguity: Ne4 could be either knight, so null; Nce4, Nge4 and c3e4 pick one", [coord(twoKnights, "Ne4"), coord(twoKnights, "Nce4"), coord(twoKnights, "Nge4"), coord(twoKnights, "c3e4"), parseOneMove(twoKnights, "Ne4")!.length], [null, "c3e4", "g5e4", "c3e4", 2]);
eq("text that is no move is null; a move that reads but is not there is none", [coord(start, "hello"), coord(start, ""), parseOneMove(start, "zz9"), parseOneMove(start, "Qh9"), parseOneMove(start, "Qd3")], [null, null, null, null, []]);

// SAN written.
const san = (fen: string, text: string) => { const p = fromFen(fen); return toSan(p, parseMove(p, text)!); };
eq("pawn moves, piece moves, captures", [san(START_FEN, "e2e4"), san(START_FEN, "g1f3"), san("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", "e4d5"), san("rnbqkbnr/ppp1pppp/8/3p4/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 2", "f3e5")], ["e4", "Nf3", "exd5", "Ne5"]);
eq("en passant is a plain pawn capture in SAN", san("rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3", "e5f6"), "exf6");
eq("castles", [san("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1"), san("r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1", "e8c8")], ["O-O", "O-O-O"]);
eq("promotions, plain and capturing", [san("1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7a8q"), san("1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a7b8n")], ["a8=Q", "axb8=N"]);
eq("check and mate", [san("rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2", "d8h4"), san("rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 2", "d1h5"), san("4k3/8/8/8/8/8/8/R3K3 w Q - 0 1", "a1a8")], ["Qh4#", "Qh5+", "Ra8+"]);
eq("disambiguation: by file, by rank, by both", [
  toSan(twoKnights, parseMove(twoKnights, "c3e4")!), toSan(twoKnights, parseMove(twoKnights, "g5e4")!),
  san("4k3/8/8/8/8/8/4K3/R6R w - - 0 1", "a1d1"),
  san("4k3/8/8/R7/8/8/8/R3K3 w - - 0 1", "a1a3"),
  san("2k5/8/8/8/4Q2Q/8/8/K6Q w - - 0 1", "h4e1"),
], ["Nce4", "Nge4", "Rad1", "R1a3", "Qh4e1"]);
eq("toSan leaves the position as it was", (() => { const p = fromFen(START_FEN); const before = toFen(p); toSan(p, parseMove(p, "e4")!); return toFen(p) === before && p.madeMoves.length === 0; })(), true);
eq("every legal move of Kiwipete reads back from its SAN", (() => { const p = fromFen(fens[1]); return p.getMoves().every((m) => parseMove(p, toSan(p, m))?.isEqual(m)); })(), true);

throws("a position whose side not to move is in check", () => fromFen("k7/8/8/8/8/3K4/8/7Q w - - 0 1"), Error, "FEN: black is in check with white to move");

// expect: ok clean strips comments, nested, and what is not notation
// expect: ok Kasparov v The World read to its end: black's three pieces
// expect: ok and white's three
// expect: ok a game with a queen-side castle
// expect: ok a move that is none says where
// expect: ok an ambiguous one too
// expect: ok the result ends the reading; moves without a space after the number
// expect: ok the start position is START_FEN
// expect: ok every FEN round-trips, the start, the perft positions, en passant squares for both sides
// expect: ok a FEN with the clocks left off reads with 0 and 1
// expect: ok read, the perft positions give their counts: Kiwipete 48, position 3 14, with the en passant square taken from the FEN
// expect: ok the hash of a position read equals that of the same position played
// expect: ok what is wrong with a FEN is said
// expect: ok coordinate notation
// expect: ok SAN: a pawn, a piece, with a check mark or a glyph after
// expect: ok a capture, with x or :, or without
// expect: ok castling, as O-O or 0-0, either side
// expect: ok promotion: e8=Q, e8Q, e8(Q), e7e8q, and the plain square is the queen; a capture promotes too
// expect: ok ambiguity: Ne4 could be either knight, so null; Nce4, Nge4 and c3e4 pick one
// expect: ok text that is no move is null; a move that reads but is not there is none
// expect: ok pawn moves, piece moves, captures
// expect: ok en passant is a plain pawn capture in SAN
// expect: ok castles
// expect: ok promotions, plain and capturing
// expect: ok check and mate
// expect: ok disambiguation: by file, by rank, by both
// expect: ok toSan leaves the position as it was
// expect: ok every legal move of Kiwipete reads back from its SAN
// expect: ok a position whose side not to move is in check
