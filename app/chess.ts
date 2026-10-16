"seeks documents, reduced functionality without";
"seeks control-bus, reduced functionality without";
// Chess, the sae app: Kaj Björklund's JavaScript Chess (MIT, 2013) carried
// over to sae, so it runs natively on aether-ui with no DOM, every action a
// command and every command reachable from REXX (TODO.md).
//
// app/chess/ is the game with no ui: the engine (chess.ts, bitboard.ts,
// zobrist.ts, move.ts, position.ts, parser.ts, ported from src/*.js),
// the game (game.ts), its commands (commands.ts), the control functions
// (control.ts, described.ts) and the scripts (script.ts). This page is the
// ui, declared over the commands. The board is drawn in stage 3 of
// TODO.md; until then the page shows the game as text: whose turn, the
// status, the moves and the position's FEN, which the specs read.
import { Commands } from "./chess/commands.ts";

const cmds = new Commands();
const turn = state("");
const moves = state("");
const fen = state("");

function refresh(): void {
  const g = cmds.game;
  batch(() => {
    turn.set(`${g.turn()} to move: ${g.status()}${g.isOver() ? ` (${g.result()})` : ""}`);
    moves.set(g.sanList().length ? `Moves: ${g.sanList().join(" ")}` : "Moves: none yet");
    fen.set(`FEN: ${g.fen()}`);
  });
}

ui.text("Chess");
ui.text("The board comes in stage 3 of TODO.md; the engine is tested headless meanwhile.");
bind(ui.text(""), turn);
bind(ui.text_wrapped("", 720), moves);
bind(ui.text(""), fen);
refresh();

// The control bus (an installed app started with --control-bus): another
// program drives the game, each request a string of REXX (MOVE("e2",
// "e4"), GETBOARD()), answered with what it came to; one request is one
// step of undo, and one that fails is taken back whole. A request sae
// stopped (past the page's time limit, or unanswered at the bus's
// deadline) is told to the commands, which put back what it did.
if (typeof bus !== "undefined") {
  bus.serve(async (code: string) => {
    const o = await cmds.chess(code, (line) => print(`chess: ${line}`));
    refresh();
    if (!o.ok) throw new Error(o.message);
    return o.output ?? null;
  }, async (reason: string) => {
    const what = cmds.stopped(reason);
    refresh();
    print(`chess: a control-bus request ${reason === "interrupted" ? "was stopped" : "ran past the deadline"}: ${what}`);
  });
}
