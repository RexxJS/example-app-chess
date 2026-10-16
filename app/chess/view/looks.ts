// The page's looks: a light theme and a dark one (sae's ui.styles, over
// aether-ui's AeCS cascade), switched by view.dark (DARKMODE() from REXX,
// the "Dark mode" button); the board's own palette follows the same
// setting (board.ts). Each theme states every property the other does, so
// switching back really goes back.
import type { ChessView } from "./view.ts";

export const THEMES = {
  light: {
    root: { background_color: 0xf6f3ee, color: 0x222222 },
    container: { background_color: 0xf6f3ee },
    label: { color: 0x222222 },
    button: { color: 0x222222, background_color: 0xe6e0d6 },
    textfield: { color: 0x222222, background_color: 0xffffff },
  },
  dark: {
    root: { background_color: 0x1b1d20, color: 0xe4e4e4 },
    container: { background_color: 0x1b1d20 },
    label: { color: 0xe4e4e4 },
    button: { color: 0xe4e4e4, background_color: 0x33373c },
    textfield: { color: 0xe4e4e4, background_color: 0x2a2d31 },
  },
};

/** The theme now, and again whenever view.dark changes it. */
export function looks(v: ChessView): void {
  let shown: boolean | null = null;
  const apply = (dark: boolean) => {
    if (dark === shown) return;
    shown = dark;
    ui.styles(dark ? THEMES.dark : THEMES.light);
    print(`chess: ${dark ? "dark" : "light"} mode`);
  };
  v.watch((s) => apply(s.dark));
  apply(v.cmds.game.dark);
}
