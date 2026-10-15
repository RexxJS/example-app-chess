// bitboard.ts: a 64-bit board, one bit a square, as two unsigned 32-bit
// halves (QuickJS, like the browsers of 2013, has no 64-bit integer that
// is fast; the old engine did the same). A port of src/bitboard.js from
// Kaj Björklund's JavaScript Chess (https://github.com/kbjorklu/chess,
// MIT, copyright (c) 2013 Kaj Björklund; LICENSE), to sae's TypeScript
// dialect: the same operations, in place and chained, the same tables.
//
// Bit i is square i (a1 = 0 ... h8 = 63, chess.ts). The operations change
// this board and return it, so dup() first to keep the original.

export class Bitboard {
  low: number;
  high: number;

  constructor(low: number, high: number) {
    this.low = low >>> 0;
    this.high = high >>> 0;
  }

  /** The number of bits set in a 32-bit value (Bit Twiddling Hacks). */
  static popcnt32(v: number): number {
    v >>>= 0;
    v -= (v >>> 1) & 0x55555555;
    v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
    return (((v + (v >>> 4)) & 0xF0F0F0F) * 0x1010101) >>> 24;
  }

  /** v with its lowest set bit cleared. */
  static popLowestBit32(v: number): number {
    v >>>= 0;
    return (v & (v - 1)) >>> 0;
  }

  /** The position 0-31 of the lowest set bit of a non-zero 32-bit value. */
  static getLowestBitPosition32(v: number): number {
    v >>>= 0;
    return Bitboard.popcnt32((v & -v) - 1);
  }

  /** The number of bits set, 0-64. */
  popcnt(): number {
    return Bitboard.popcnt32(this.low) + Bitboard.popcnt32(this.high);
  }

  /** Clears the lowest set bit. */
  popLowestBit(): Bitboard {
    if (this.low) {
      this.low = Bitboard.popLowestBit32(this.low);
    } else {
      this.high = Bitboard.popLowestBit32(this.high);
    }
    return this;
  }

  /** The position 0-63 of the lowest set bit; undefined on an empty board. */
  getLowestBitPosition(): number {
    if (this.low) {
      return Bitboard.getLowestBitPosition32(this.low);
    }
    return 32 + Bitboard.getLowestBitPosition32(this.high);
  }

  /** Clears the lowest set bit and gives its position. */
  extractLowestBitPosition(): number {
    const index = this.getLowestBitPosition();
    this.popLowestBit();
    return index;
  }

  isEmpty(): boolean {
    return !this.low && !this.high;
  }

  isClear(index: number): boolean {
    index >>>= 0;
    if (index < 32) {
      return !(this.low & (1 << index));
    }
    return !(this.high & (1 << (index - 32)));
  }

  isSet(index: number): boolean {
    return !this.isClear(index);
  }

  setBit(index: number): Bitboard {
    index >>>= 0;
    if (index < 32) {
      this.low = (this.low | (1 << index)) >>> 0;
    } else {
      this.high = (this.high | (1 << (index - 32))) >>> 0;
    }
    return this;
  }

  clearBit(index: number): Bitboard {
    index >>>= 0;
    if (index < 32) {
      this.low = (this.low & ~(1 << index)) >>> 0;
    } else {
      this.high = (this.high & ~(1 << (index - 32))) >>> 0;
    }
    return this;
  }

  and(other: Bitboard): Bitboard {
    this.low = (this.low & other.low) >>> 0;
    this.high = (this.high & other.high) >>> 0;
    return this;
  }

  and_not(other: Bitboard): Bitboard {
    this.low = (this.low & ~other.low) >>> 0;
    this.high = (this.high & ~other.high) >>> 0;
    return this;
  }

  or(other: Bitboard): Bitboard {
    this.low = (this.low | other.low) >>> 0;
    this.high = (this.high | other.high) >>> 0;
    return this;
  }

  xor(other: Bitboard): Bitboard {
    this.low = (this.low ^ other.low) >>> 0;
    this.high = (this.high ^ other.high) >>> 0;
    return this;
  }

  not(): Bitboard {
    this.low = (~this.low) >>> 0;
    this.high = (~this.high) >>> 0;
    return this;
  }

  /** Shifts left by v, 0-63. */
  shl(v: number): Bitboard {
    v >>>= 0;
    if (v > 31) {
      this.high = (this.low << (v - 32)) >>> 0;
      this.low = 0;
    } else if (v > 0) {
      this.high = ((this.high << v) | (this.low >>> (32 - v))) >>> 0;
      this.low = (this.low << v) >>> 0;
    }
    return this;
  }

  /** Shifts right by v, 0-63, zeros coming in. */
  shr(v: number): Bitboard {
    v >>>= 0;
    if (v > 31) {
      this.low = this.high >>> (v - 32);
      this.high = 0;
    } else if (v > 0) {
      this.low = ((this.low >>> v) | (this.high << (32 - v))) >>> 0;
      this.high >>>= v;
    }
    return this;
  }

  /** Shifts left by v; a negative v shifts right; beyond 63 either way clears. */
  shiftLeft(v: number): Bitboard {
    if (v > 63 || v < -63) {
      this.low = this.high = 0;
    } else if (v > 0) {
      this.shl(v);
    } else if (v < 0) {
      this.shr(-v);
    }
    return this;
  }

  isEqual(other: Bitboard): boolean {
    return this.low === other.low && this.high === other.high;
  }

  dup(): Bitboard {
    return Bitboard.make(this.low, this.high);
  }

  /** The squares set, as indices in order. */
  indices(): number[] {
    const out: number[] = [];
    const bb = this.dup();
    while (!bb.isEmpty()) out.push(bb.extractLowestBitPosition());
    return out;
  }

  static make(low: number, high: number): Bitboard {
    return new Bitboard(low, high);
  }

  static makeZero(): Bitboard {
    return Bitboard.make(0, 0);
  }

  static makeOne(): Bitboard {
    return Bitboard.make(0xFFFFFFFF, 0xFFFFFFFF);
  }

  static makeLightSquares(): Bitboard {
    return Bitboard.make(0x55AA55AA, 0x55AA55AA);
  }

  static makeDarkSquares(): Bitboard {
    return Bitboard.make(0xAA55AA55, 0xAA55AA55);
  }

  static makeFile(file: number): Bitboard {
    return Bitboard.make(0x01010101, 0x01010101).shl(file);
  }

  static makeFiles(): Bitboard[] {
    const b: Bitboard[] = [];
    for (let i = 0; i < 8; ++i) b.push(Bitboard.makeFile(i));
    return b;
  }

  static makeRank(rank: number): Bitboard {
    return Bitboard.make(0xFF, 0).shl(rank * 8);
  }

  static makeRanks(): Bitboard[] {
    const b: Bitboard[] = [];
    for (let i = 0; i < 8; ++i) b.push(Bitboard.makeRank(i));
    return b;
  }

  static makeIndex(index: number): Bitboard {
    return Bitboard.makeZero().setBit(index);
  }

  static makeIndices(): Bitboard[] {
    const b: Bitboard[] = [];
    for (let i = 0; i < 64; ++i) b.push(Bitboard.makeIndex(i));
    return b;
  }

  /** Diagonal 0 runs h1-a8 (the old engine's "main diagonal"); positive ones are above it, negative below, -7..7. */
  static makeDiagonal(diagonal: number): Bitboard {
    return Bitboard.make(0x10204080, 0x01020408).and(Bitboard.makeOne().shiftLeft(diagonal * 8)).shiftLeft(diagonal);
  }

  static makeDiagonals(): Bitboard[] {
    const b: Bitboard[] = [];
    for (let i = -7; i < 8; ++i) b.push(Bitboard.makeDiagonal(i));
    return b;
  }

  /** Antidiagonal 0 runs a1-h8; positive ones are below it, negative above, -7..7. */
  static makeAntidiagonal(antidiagonal: number): Bitboard {
    return Bitboard.make(0x08040201, 0x80402010).and(Bitboard.makeOne().shiftLeft(-antidiagonal * 8)).shiftLeft(antidiagonal);
  }

  static makeAntidiagonals(): Bitboard[] {
    const b: Bitboard[] = [];
    for (let i = -7; i < 8; ++i) b.push(Bitboard.makeAntidiagonal(i));
    return b;
  }

  /** The squares a knight on index reaches. */
  static makeKnightMovement(index: number): Bitboard {
    const b = Bitboard.makeZero().setBit(index);
    const l1 = b.dup().shr(1).and_not(Bitboard.FILES[7]);
    const l2 = b.dup().shr(2).and_not(Bitboard.FILES[7]).and_not(Bitboard.FILES[6]);
    const r1 = b.dup().shl(1).and_not(Bitboard.FILES[0]);
    const r2 = b.dup().shl(2).and_not(Bitboard.FILES[0]).and_not(Bitboard.FILES[1]);
    const v1 = l2.or(r2);
    const v2 = l1.or(r1);
    return v1.dup().shl(8).or(v1.shr(8)).or(v2.dup().shl(16)).or(v2.shr(16));
  }

  static makeKnightMovements(): Bitboard[] {
    const b: Bitboard[] = [];
    for (let i = 0; i < 64; ++i) b.push(Bitboard.makeKnightMovement(i));
    return b;
  }

  /** The squares a king on index reaches. */
  static makeKingMovement(index: number): Bitboard {
    const b = Bitboard.makeZero().setBit(index);
    const c = b.dup().shr(1).and_not(Bitboard.FILES[7]).or(b.dup().shl(1).and_not(Bitboard.FILES[0]));
    const u = b.dup().or(c).shr(8);
    const d = b.dup().or(c).shl(8);
    return c.or(u).or(d);
  }

  static makeKingMovements(): Bitboard[] {
    const b: Bitboard[] = [];
    for (let i = 0; i < 64; ++i) b.push(Bitboard.makeKingMovement(i));
    return b;
  }

  // The tables, made once, in this order (the movements need FILES). They
  // are shared: dup() before changing one.
  static readonly ZERO = Bitboard.makeZero();
  static readonly ONE = Bitboard.makeOne();
  static readonly LIGHT_SQUARES = Bitboard.makeLightSquares();
  static readonly DARK_SQUARES = Bitboard.makeDarkSquares();
  static readonly FILES = Bitboard.makeFiles();
  static readonly RANKS = Bitboard.makeRanks();
  /** DIAGONALS[7] is h1-a8, 0-6 below it, 8-14 above. */
  static readonly DIAGONALS = Bitboard.makeDiagonals();
  /** ANTIDIAGONALS[7] is a1-h8, 0-6 above it, 8-14 below. */
  static readonly ANTIDIAGONALS = Bitboard.makeAntidiagonals();
  static readonly KNIGHT_MOVEMENTS = Bitboard.makeKnightMovements();
  static readonly KING_MOVEMENTS = Bitboard.makeKingMovements();
}
