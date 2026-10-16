"seeks documents, reduced functionality without";
"seeks control-bus, reduced functionality without";
// Chess, the sae app: Kaj Björklund's JavaScript Chess (MIT, 2013) carried
// over to sae, so it runs natively on aether-ui with no DOM, every action a
// command and every command reachable from REXX (TODO.md).
//
// app/chess/ is the game with no ui: the engine (chess.ts, bitboard.ts,
// zobrist.ts, move.ts, position.ts, parser.ts, ported from src/*.js),
// the game (game.ts), its commands (commands.ts), the control functions
// (control.ts, described.ts) and the scripts (script.ts). app/chess/view/
// is the ui: each panel reads the view's states and runs commands, and
// nothing else. This page only says which panels, in which order.
import { ChessView } from "./chess/view/view.ts";
import { Commands } from "./chess/commands.ts";
import { filesPanel } from "./chess/view/files.ts";
import { boardPanel } from "./chess/view/board.ts";
import { promotionBar } from "./chess/view/promotion.ts";
import { sidebar } from "./chess/view/sidebar.ts";
import { menuBar, toolbar } from "./chess/view/toolbar.ts";
import { scriptPanel } from "./chess/view/scriptpanel.ts";
import { moveField } from "./chess/view/keyboard.ts";
import { looks } from "./chess/view/looks.ts";
import { analysisPanel } from "./chess/view/analysis.ts";
import { setupPanel } from "./chess/view/setup.ts";

// The app's storage keeps its games and the game in progress (5.3).
const v = new ChessView(new Commands(undefined, typeof storage !== "undefined" ? storage : null));
const resumed = v.cmds.resume();

menuBar(v);
looks(v);
// The page in a padded column: the window's edge is not the board's.
ui.vstack(() => {
  ui.margin(16, 16, 16, 16);
  ui.text("Chess");
  toolbar(v);
  ui.hstack(() => {
    boardPanel(v);
    sidebar(v);
  });
  promotionBar(v);
  analysisPanel(v);
  moveField(v);
  setupPanel(v);
  filesPanel(v);
  bind(ui.text(""), v.status);
  bind(ui.text(""), computed(() => {
    const g = v.game.value;
    return g ? `${g.turn} to move: ${g.status}${g.result !== "*" ? ` (${g.result})` : ""}` : "";
  }, v.game));
  bind(ui.text_wrapped("", 720), computed(() => {
    const g = v.game.value;
    return g && g.sans.length ? `Moves: ${g.sans.join(" ")}` : "Moves: none yet";
  }, v.game));
  bind(ui.text(""), computed(() => `FEN: ${v.game.value?.fen ?? ""}`, v.game));
  scriptPanel(v);
});
v.refresh();
if (resumed >= 0) {
  v.status.set(`the game in progress is back: ${resumed} moves`);
  print(`chess: resumed a game of ${resumed} moves`);
}

// The control bus (an installed app started with --control-bus): another
// program drives the game, each request a string of REXX (MOVE("e2",
// "e4"), GETBOARD()), answered with what it came to; one request is one
// step of undo, and one that fails is taken back whole. A request sae
// stopped (past the page's time limit, or unanswered at the bus's
// deadline) is told to the commands, which put back what it did.
if (typeof bus !== "undefined") {
  bus.serve(async (code: string) => {
    const o = await v.cmds.chess(code, (line) => print(`chess: ${line}`));
    v.refresh();
    if (!o.ok) throw new Error(o.message);
    return o.output ?? null;
  }, async (reason: string) => {
    const what = v.cmds.stopped(reason);
    v.refresh();
    print(`chess: a control-bus request ${reason === "interrupted" ? "was stopped" : "ran past the deadline"}: ${what}`);
  });
}
