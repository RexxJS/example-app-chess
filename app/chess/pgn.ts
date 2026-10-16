// PGN (TODO.md 5.1), the Portable Game Notation: a game written (the seven
// tag roster and any other tags, the moves in SAN numbered, the result,
// the lines kept to 80 columns) and read (the first game of a file: its
// tags, its moves played out, its result). What a reader may leave aside
// is kept, not lost: the comments ({...} and ; to the line's end), the
// variations ((...), nested), the numeric annotations ($1) and the !? marks
// after a move are held as the text that followed each move, and written
// again after the same move when the game is written, so a game read and
// written comes back with them, while its moves are those it had.
import { START_FEN } from "./parser.ts";
import type { Game } from "./game.ts";

/** What a game read from PGN keeps besides its moves, to write again. */
export interface PgnKept {
  /** Every tag, in the order read (the seven tag roster among them). */
  readonly tags: readonly (readonly [string, string])[];
  /** What came before the first move: a comment, say. */
  readonly lead: string;
  /** Per move (index 0 the first), what followed it: comments, variations, annotations. */
  readonly notes: readonly string[];
  /** The moves read, in SAN, to know the notes still belong to the game's moves. */
  readonly sans: readonly string[];
}

/** A game as PGN has it. */
export interface PgnGame extends PgnKept {
  /** The position it starts from (the FEN tag with SetUp "1", else the start). */
  readonly start: string;
  /** "1-0", "0-1", "1/2-1/2" or "*". */
  readonly result: string;
}

const ROSTER = ["Event", "Site", "Date", "Round", "White", "Black", "Result"];
const RESULTS = ["1-0", "0-1", "1/2-1/2", "*"];

const quote = (v: string) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;

/**
 * The first game in `text`. Throws saying what is wrong: a tag that is not
 * one, a comment or variation left open, no moves and no tags at all. The
 * moves are SAN as written, not yet checked against a position (Game's
 * fromPgn plays them).
 */
export function parsePgn(text: string): PgnGame & { readonly moves: readonly string[] } {
  const tags: [string, string][] = [];
  const moves: string[] = [];
  const notes: string[] = [];
  let lead = "";
  let result = "*";
  let i = 0;
  const n = text.length;
  // Kept text goes after the last move read, or before the first.
  const keep = (raw: string) => {
    if (!moves.length) lead = lead ? `${lead} ${raw}` : raw;
    else notes[moves.length - 1] = notes[moves.length - 1] ? `${notes[moves.length - 1]} ${raw}` : raw;
  };
  let inMoves = false;
  while (i < n) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    // An escape line: "%" first on a line, skipped.
    if (ch === "%" && (i === 0 || text[i - 1] === "\n")) {
      while (i < n && text[i] !== "\n") i++;
      continue;
    }
    if (ch === "[") {
      if (inMoves) break; // the next game's tags: one game read
      const m = /^\[\s*([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\s*\]/.exec(text.slice(i));
      if (!m) throw new Error(`PGN: a tag is [Name "value"], not ${text.slice(i, i + 30).split("\n")[0]}`);
      tags.push([m[1], m[2].replace(/\\(.)/g, "$1")]);
      i += m[0].length;
      continue;
    }
    inMoves = true;
    if (ch === "{") {
      const end = text.indexOf("}", i);
      if (end < 0) throw new Error("PGN: a comment { is not closed");
      keep(text.slice(i, end + 1));
      i = end + 1;
      continue;
    }
    if (ch === ";") {
      let end = text.indexOf("\n", i);
      if (end < 0) end = n;
      keep(`{${text.slice(i + 1, end).trim()}}`);
      i = end;
      continue;
    }
    if (ch === "(") {
      let depth = 0, j = i;
      for (; j < n; j++) {
        if (text[j] === "{") {
          const e = text.indexOf("}", j);
          if (e < 0) break;
          j = e;
        } else if (text[j] === "(") depth++;
        else if (text[j] === ")" && --depth === 0) break;
      }
      if (j >= n) throw new Error("PGN: a variation ( is not closed");
      keep(text.slice(i, j + 1).replace(/\s+/g, " "));
      i = j + 1;
      continue;
    }
    // A token: up to whitespace or the next bracket.
    let j = i;
    while (j < n && !/[\s{}()\[\];]/.test(text[j])) j++;
    let tok = text.slice(i, j);
    i = j;
    if (RESULTS.includes(tok)) {
      result = tok;
      break;
    }
    if (/^\$\d+$/.test(tok)) {
      keep(tok);
      continue;
    }
    // "12." or "12..." alone, or glued to its move ("12.e4").
    tok = tok.replace(/^\d+\.+/, "");
    if (tok === "") continue;
    const marks = /[!?]+$/.exec(tok);
    if (marks) tok = tok.slice(0, -marks[0].length);
    if (tok === "") continue;
    moves.push(tok);
    if (marks) keep(marks[0]);
  }
  if (!tags.length && !moves.length) throw new Error("PGN: no game here (no tags and no moves)");
  const tag = (name: string) => tags.find(([k]) => k === name)?.[1];
  const start = tag("SetUp") === "1" && tag("FEN") ? tag("FEN")! : START_FEN;
  if (result === "*" && tag("Result") && RESULTS.includes(tag("Result")!)) result = tag("Result")!;
  return { tags, lead, notes: moves.map((_, k) => notes[k] ?? ""), sans: moves, moves, start, result };
}

// Today as PGN dates it, "2026.10.16".
const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * The game as PGN: the seven tag roster first (as read, or "?" where there
 * is none; the Date today's when unknown; the Result the game's), then the
 * other tags read, SetUp and FEN when the game did not start from the
 * usual position; the moves numbered, with what was kept after each one
 * that is still the game's move; the result; lines of at most 80.
 */
export function toPgn(game: Game, date: string = today()): string {
  const kept = game.pgn;
  const read = new Map(kept ? kept.tags.map(([k, v]) => [k, v] as [string, string]) : []);
  const roster: Record<string, string> = {
    Event: read.get("Event") ?? "Casual game", Site: read.get("Site") ?? "sae chess", Date: read.get("Date") ?? date,
    Round: read.get("Round") ?? "-", White: read.get("White") ?? "?", Black: read.get("Black") ?? "?", Result: game.result(),
  };
  const lines = ROSTER.map((k) => `[${k} ${quote(roster[k])}]`);
  for (const [k, v] of kept ? kept.tags : []) if (!ROSTER.includes(k) && k !== "SetUp" && k !== "FEN") lines.push(`[${k} ${quote(v)}]`);
  if (game.startFen !== START_FEN) lines.push(`[SetUp "1"]`, `[FEN ${quote(game.startFen)}]`);
  // The kept notes belong to the moves while the game's moves are the ones read.
  const sans = game.sanList();
  let same = 0;
  while (kept && same < sans.length && same < kept.sans.length && kept.sans[same] === sans[same]) same++;
  const words: string[] = [];
  if (kept?.lead && (same > 0 || !kept.sans.length)) words.push(kept.lead);
  let white = game.startFen.split(" ")[1] !== "b";
  let number = Number(game.startFen.split(" ")[5]) || 1;
  sans.forEach((san, k) => {
    if (white) words.push(`${number}.`);
    else if (k === 0 || (kept && k - 1 < same && kept.notes[k - 1])) words.push(`${number}...`);
    words.push(san);
    const note = kept && k < same ? kept.notes[k] : "";
    // "!?" and the like go on the move, the rest after it.
    const marks = /^[!?]+/.exec(note);
    if (marks) words[words.length - 1] += marks[0];
    const rest = note.slice(marks ? marks[0].length : 0).trim();
    if (rest) words.push(rest);
    if (!white) number++;
    white = !white;
  });
  words.push(game.result());
  // Wrapped at 80 columns, a word never split.
  const body: string[] = [];
  let line = "";
  for (const w of words) {
    if (line && line.length + 1 + w.length > 79) {
      body.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) body.push(line);
  return `${lines.join("\n")}\n\n${body.join("\n")}\n`;
}
