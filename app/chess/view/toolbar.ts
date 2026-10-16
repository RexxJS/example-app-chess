// The buttons and the menu bar: New game, Undo, Redo, Flip, Resign, Offer
// draw; Computer move and Stop (it thinks in slices, think.ts); who plays (the person as white, as black, both sides, or the
// computer both); the computer's level; Open (the app's own game file, or
// a PGN), Save and Save PGN, a file the person picks, through documents.
// Each runs a command; the menu bar
// (an installed app's, sae's ui.menu) runs the same.
import type { ChessView } from "./view.ts";
import type { AiSide } from "../game.ts";
import { CONTROLS } from "./sidebar.ts";

// Who the person plays, as the side the computer plays.
const PLAYS: readonly (readonly [string, AiSide])[] = [
  ["Play as white", "black"], ["Play as black", "white"], ["Play both sides", "none"], ["Computer plays both", "both"],
];

export function playsLabel(aiSide: AiSide, level: number, book = false): string {
  if (aiSide === "none") return "You play both sides";
  if (aiSide === "both") return `The computer plays both sides, at level ${level}${book ? ", from the book" : ""}`;
  return `You play ${aiSide === "black" ? "white" : "black"}; the computer plays ${aiSide}, at level ${level}${book ? ", from the book" : ""}`;
}

export function toolbar(v: ChessView): void {
  ui.hstack(() => {
    ui.btn("New game", () => v.run("game.new"));
    ui.btn("Undo", () => v.undo());
    ui.btn("Redo", () => v.run("game.redo"));
    ui.btn("Flip", () => v.run("board.flip"));
    ui.btn("Resign", () => v.run("game.resign"));
    ui.btn("Offer draw", () => v.run("game.offerDraw"));
    ui.btn("Dark mode", () => v.run("view.dark"));
    ui.btn("Smaller", () => v.run("view.boardSize", { by: "-80" }));
    ui.btn("Larger", () => v.run("view.boardSize", { by: "80" }));
    ui.btn("Fit board", () => v.run("view.boardSize", { fit: "1" }));
    if (typeof documents !== "undefined") {
      ui.btn("Open", () => openGame(v));
      ui.btn("Save", () => saveGame(v));
      ui.btn("Save PGN", () => savePgn(v));
    }
  });
  ui.hstack(() => {
    for (const [label, side] of PLAYS) ui.btn(label, () => v.run("ai.side", { side }));
    for (const level of [1, 2, 3, 4]) ui.btn(`Level ${level}`, () => v.run("ai.level", { level: String(level) }));
    ui.btn("Book", () => v.run("ai.book"));
    ui.btn("Computer move", () => v.think());
    ui.btn("Stop", () => v.stopThinking());
  });
  bind(ui.text(""), v.thinking);
  bind(ui.text(""), computed(() => {
    const g = v.game.value;
    return g ? playsLabel(g.aiSide, g.aiLevel, g.book) : "";
  }, v.game));
}

/** The menu bar: the same commands, by menu. */
export function menuBar(v: ChessView): void {
  if (typeof ui.menu !== "function") return;
  ui.menu("Game", () => {
    ui.menu_item("New game", () => v.run("game.new"));
    if (typeof documents !== "undefined") {
      ui.menu_item("Open...", () => openGame(v));
      ui.menu_item("Save...", () => saveGame(v));
      ui.menu_item("Save as PGN...", () => savePgn(v));
    }
    ui.menu_separator();
    ui.menu_item("Resign", () => v.run("game.resign"));
    ui.menu_item("Offer draw", () => v.run("game.offerDraw"));
  });
  ui.menu("Edit", () => {
    ui.menu_item("Undo", () => v.undo());
    ui.menu_item("Redo", () => v.run("game.redo"));
  });
  ui.menu("Board", () => {
    ui.menu_item("Flip board", () => v.run("board.flip"));
    ui.menu_item("Dark mode", () => v.run("view.dark"));
    ui.menu_item("Fit board to the window", () => v.run("view.boardSize", { fit: "1" }));
  });
  ui.menu("Clocks", () => {
    ui.menu_item("No clocks", () => v.run("clock.set", { control: "none" }));
    for (const control of CONTROLS) ui.menu_item(`${control}`, () => v.run("clock.set", { control }));
  });
  ui.menu("Computer", () => {
    for (const [label, side] of PLAYS) ui.menu_item(label, () => v.run("ai.side", { side }));
    ui.menu_separator();
    for (const level of [1, 2, 3, 4]) ui.menu_item(`Level ${level}`, () => v.run("ai.level", { level: String(level) }));
    ui.menu_separator();
    ui.menu_item("Play from the opening book", () => v.run("ai.book"));
    ui.menu_item("Computer move", () => v.think());
    ui.menu_item("Stop thinking", () => v.stopThinking());
    ui.menu_separator();
    ui.menu_item("Analyse", () => v.analyse());
    ui.menu_item("Hint", () => v.analyse(true));
  });
}

// What failed, on the status line, as a refused command's reason is.
async function tried(v: ChessView, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (e) {
    v.status.set(String((e as Error)?.message ?? e));
  }
}

function openGame(v: ChessView): Promise<void> {
  return tried(v, async () => {
    const d = await documents.pick_open("Open a chess game");
    if (!d) return;
    // The app's own file is JSON; anything else is read as PGN.
    const text = await d.read_text();
    const o = v.run(text.trimStart().startsWith("{") ? "game.import" : "game.importPgn", { text });
    if (o.ok) print(`chess: opened ${d.name}`);
  });
}

function saveGame(v: ChessView): Promise<void> {
  return tried(v, async () => {
    const d = await documents.pick_save("game.chess.json");
    if (!d) return;
    await d.write_text(String(v.cmds.execute("game.export").output));
    print(`chess: saved ${d.name}`);
    v.status.set(`Saved ${d.name}`);
  });
}

function savePgn(v: ChessView): Promise<void> {
  return tried(v, async () => {
    const d = await documents.pick_save("game.pgn");
    if (!d) return;
    await d.write_text(String(v.cmds.execute("game.exportPgn").output));
    print(`chess: saved ${d.name}`);
    v.status.set(`Saved ${d.name} (PGN)`);
  });
}
