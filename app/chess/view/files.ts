// Games kept in the app (TODO.md 5.3): a name typed and Keep as (game.save,
// SAVEGAME in REXX) keeps the game by it, in the app's own storage, with no
// file to pick; each kept game a button that opens it (game.open) and one
// that forgets it. The game in progress is kept on its own after every
// change (Commands.autosave) and is back when the app starts again.
import type { ChessView } from "./view.ts";

export const NAME_PLACEHOLDER = "A name for the game";

export function filesPanel(v: ChessView): void {
  const typed = state("");
  const keep = () => {
    const name = typed.value.trim();
    if (!name) return;
    if (v.run("game.save", { name }).ok) typed.set("");
  };
  ui.hstack(() => {
    ui.on_submit(bind(ui.textfield(NAME_PLACEHOLDER, () => {}), typed), keep);
    ui.btn("Keep as", keep);
  });
  each(v.kept, (name: string) => name, (name: string) => ui.hstack(() => {
    ui.btn(`Open ${name}`, () => v.run("game.open", { name }));
    ui.btn(`Forget ${name}`, () => v.run("game.forget", { name }));
  }));
}
