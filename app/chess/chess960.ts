// Chess960 (TODO.md 6.5): Fischer random chess's 960 start positions,
// numbered 0 to 959 by the standard numbering (Reinhard Scharnagl's, the
// one the Chess960 rules and the game's literature use; #518 is the
// usual start), computed here from that numbering's definition:
//
//   n % 4 places the light-squared bishop (on b, d, f or h), then
//   (n / 4) % 4 the dark-squared one (a, c, e or g), then (n / 16) % 6 the
//   queen on the empty squares counted from a, then n / 96 (0 to 9) the
//   two knights on the five left, in the order NN---, N-N--, N--N-,
//   N---N, -NN--, -N-N-, -N--N, --NN-, --N-N, ---NN; the three squares
//   left are a rook, the king and a rook, in that order.
//
// Black's pieces mirror white's. Castling (position.ts) puts the king and
// rook on the squares they reach in chess, g and f or c and d.
export const STANDARD_960 = 518;

const KNIGHTS = ["11000", "10100", "10010", "10001", "01100", "01010", "01001", "00110", "00101", "00011"];

/** White's back rank of position n (0 to 959), a to h: "RNBQKBNR" for 518. */
export function backRank(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 959) throw new Error(`${n} is not a Chess960 position (0 to 959)`);
  const rank: string[] = new Array(8).fill("");
  rank[2 * (n % 4) + 1] = "B";
  rank[2 * (Math.floor(n / 4) % 4)] = "B";
  const free = () => rank.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0);
  rank[free()[Math.floor(n / 16) % 6]] = "Q";
  const five = free(), knights = KNIGHTS[Math.floor(n / 96)];
  for (let k = 0; k < 5; ++k) if (knights[k] === "1") rank[five[k]] = "N";
  const [r1, k, r2] = free();
  rank[r1] = "R";
  rank[k] = "K";
  rank[r2] = "R";
  return rank.join("");
}

/** Position n as FEN, white to move, every castling right. */
export function fen960(n: number): string {
  const r = backRank(n);
  return `${r.toLowerCase()}/pppppppp/8/8/8/8/PPPPPPPP/${r} w KQkq - 0 1`;
}

/** The number of a start position (its back rank, or a FEN whose ranks are a start position's), or -1 for none. */
export function number960(rankOrFen: string): number {
  const fields = rankOrFen.trim().split(/\s+/)[0].split("/");
  const rank = fields.length === 8 ? fields[7] : fields[0];
  if (fields.length === 8 && (fields[0] !== rank.toLowerCase() || fields[1] !== "pppppppp" || fields[6] !== "PPPPPPPP" || fields.slice(2, 6).some((f) => f !== "8"))) return -1;
  for (let n = 0; n < 960; ++n) if (backRank(n) === rank) return n;
  return -1;
}
