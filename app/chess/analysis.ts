// Analysis (TODO.md 4.5): what the computer makes of a position, for the
// page's analysis line, a hint, and ANALYZE() and HINT() in REXX: its
// value (to white, in pawns, or a mate in so many moves), the best move
// and the principal variation in SAN, how deep it looked and how many
// positions it searched. A finished search (ai.ts's Thinking, all at once
// or in slices, think.ts) is read into one.
import { Thinking } from "./ai.ts";
import type { Game } from "./game.ts";
import { toSan } from "./parser.ts";

export interface Analysis {
  readonly depth: number;
  /** To white, in centipawns: above 0 when white is better (a mate: MATE_VALUE less the half-moves to it). */
  readonly value: number;
  /** Moves to a mate found: above 0 when white mates, below when black does; 0 for none. */
  readonly mate: number;
  /** The best move in SAN ("" when there is none), and in coordinates. */
  readonly best: string;
  readonly coordinate: string;
  /** The principal variation, in SAN, the best move first. */
  readonly pv: readonly string[];
  readonly nodes: number;
  /** The value as a person reads it: "+0.35", "-1.20", "0.00", "#2" (white mates in 2), "#-1" (black mates in 1). */
  readonly text: string;
}

/** The value as text: pawns to two places with a sign, or "#n" for a mate in n ("#-n" when black mates). */
export function valueText(value: number, mate: number): string {
  if (mate) return `#${mate}`;
  const pawns = (value / 100).toFixed(2);
  return value > 0 ? `+${pawns}` : value < 0 ? pawns : "0.00";
}

/** A finished search of the game's position, read: the variation's moves in SAN, numbered from the game's move. */
export function analysisOf(game: Game, t: Thinking): Analysis {
  const p = game.positionCopy();
  const pv: string[] = [];
  for (const m of t.pv()) {
    pv.push(toSan(p, m));
    p.makeMove(m);
  }
  const mate = t.mateIn();
  return {
    depth: t.reached, value: t.bestValue, mate, best: pv[0] ?? "", coordinate: t.best?.getCoordinate() ?? "", pv,
    nodes: t.ai.nodes, text: valueText(t.bestValue, mate),
  };
}

/** The variation as a person reads it, numbered from the game's move: "4. Qxf7#", "12... Nf6 13. Bg5". */
export function lineText(game: Game, pv: readonly string[]): string {
  let white = game.turn() === "white";
  let n = game.position.fullmoveNumber;
  const out: string[] = [];
  for (const [i, san] of pv.entries()) {
    if (white) out.push(`${n}. ${san}`);
    else {
      out.push(i === 0 ? `${n}... ${san}` : san);
      n++;
    }
    white = !white;
  }
  return out.join(" ");
}

/** The position analysed all at once, `depth` half-moves deep. */
export function analyze(game: Game, depth: number): Analysis {
  const t = new Thinking(game.positionCopy(), depth);
  t.step();
  return analysisOf(game, t);
}
