// The script panel: a REXX script run in the page, as the old app's in-app
// execution ran one (ADDRESS CHESS lines and the control functions:
// script.ts), its SAY lines shown below; the whole script is one step of
// undo. The page shows the game after it.
import type { ChessView } from "./view.ts";

export function scriptPanel(v: ChessView): void {
  const script = state(""), said = state("");
  ui.hstack(() => {
    bind(ui.textarea("REXX script"), script);
    ui.btn("Run script", async () => {
      const lines: string[] = [];
      const o = await v.cmds.script(script.value, (l) => {
        lines.push(l);
        print(`chess: say ${l}`);
      });
      v.refresh();
      if (!o.ok) print(`chess: the script failed: ${o.message}`);
      said.set([...lines, o.ok ? "" : `the script failed: ${o.message}`].filter((l) => l).join("\n"));
    });
  });
  bind(ui.text_wrapped("", 720), said);
}
