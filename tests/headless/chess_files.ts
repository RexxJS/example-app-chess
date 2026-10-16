// The app's own games (TODO.md 5.3, commands.ts's Store): a game kept by
// a name and opened again, its moves, who the computer plays, its level
// and the flip with it; the names listed and a game forgotten; refusals;
// the game in progress autosaved after a change (and not rewritten when
// nothing changed) and resumed as the app starts again, as a second
// Commands on the same store does; SAVEGAME, OPENGAME, LISTGAMES and
// FORGETGAME in REXX; and no store, no keeping.
import { Commands } from "./chess/commands.ts";
import type { Store } from "./chess/commands.ts";
import { controlFunctions } from "./chess/control.ts";
import { eq, throws } from "./lib/check.ts";

// A store as sae's storage is: strings by key, kept until removed; a key
// letters, digits, ".", "_" or "-", at most 128, not starting with "."
// (sae_host.ae's storage_key_ok_), else it throws as sae's does.
const keyOk = (k: string) => {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(k) || k.startsWith(".")) throw new TypeError(`storage: key must be letters, digits, '.', '_' or '-': ${k}`);
};
const memory = (): Store & { map: Map<string, string>; writes: number } => {
  const map = new Map<string, string>();
  const s = {
    map, writes: 0,
    get: (k: string) => (keyOk(k), map.get(k) ?? null),
    set: (k: string, v: string) => { keyOk(k); map.set(k, v); s.writes++; },
    remove: (k: string) => { keyOk(k); map.delete(k); },
  };
  return s;
};

const store = memory();
const c = new Commands(undefined, store);
for (const m of ["e4", "e5", "Nf3"]) c.run(`game.move san=${m}`);
c.run("ai.level level=3");
c.run("ai.side side=black");
c.run("board.flip");
eq("game.save: kept by its name", c.run('game.save name="Ruy attempt"').message, 'kept the game as "Ruy attempt": 3 moves');
c.run("game.new");
c.run("ai.level level=1");
c.run('game.save name="empty"');
eq("game.kept: the names, in order", c.run("game.kept").output, ["Ruy attempt", "empty"]);
eq("game.open: the game back, its settings with it", [c.run('game.open name="Ruy attempt"').message, c.game.sanList(), c.game.aiLevel, c.game.aiSide, c.game.flipped],
  ['opened "Ruy attempt": 3 moves, black to move', ["e4", "e5", "Nf3"], 3, "black", true]);
eq("a name kept again is replaced, not listed twice", [c.run('game.save name="empty"').ok, c.run("game.kept").output], [true, ["Ruy attempt", "empty"]]);
eq("game.forget", [c.run('game.forget name="empty"').message, c.run("game.kept").output], ['forgot "empty"', ["Ruy attempt"]]);
eq("refused: no such game, a name that is none", [c.run('game.open name="nope"').message, c.run('game.forget name="nope"').message, c.run('game.save name="  "').message],
  ['no game kept as "nope"', 'no game kept as "nope"', 'a game\'s name is 1 to 80 characters, not "  "']);

// Autosave and resume.
const s2 = memory();
const first = new Commands(undefined, s2);
eq("nothing to resume at first", first.resume(), -1);
for (const m of ["d4", "d5"]) {
  first.run(`game.move san=${m}`);
  first.autosave();
}
eq("autosaved after each change, not when nothing changed", [first.autosave(), s2.writes], [false, 2]);
const second = new Commands(undefined, s2);
eq("the app started again: the game in progress resumed", [second.resume(), second.game.sanList(), second.game.turn()], [2, ["d4", "d5"], "white"]);
eq("and it undoes as it did", [second.run("game.undo").message, second.game.sanList()], ["undid d5", ["d4"]]);
s2.set("autosave", "{ not a game");
eq("an autosave that will not open is not resumed", new Commands(undefined, s2).resume(), -1);

// REXX.
const r = new Commands(undefined, memory());
const fns = controlFunctions((id, params) => r.execute(id, params), r.game, {});
fns.MOVESAN("e4");
eq("SAVEGAME, LISTGAMES, OPENGAME, FORGETGAME", [fns.SAVEGAME("one"), fns.NEWGAME(), fns.OPENGAME("one"), fns.GETMOVEHISTORYSAN()[1], fns.LISTGAMES()[0], fns.FORGETGAME("one"), fns.LISTGAMES()[0]], ["one", "OK", 1, "e4", 1, "one", 0]);
throws("OPENGAME of a game not kept", () => fns.OPENGAME("two"), Error, 'no game kept as "two"');

// No store: nothing kept, said so.
const none = new Commands();
eq("no store: refused, said why; nothing autosaved", [none.run("game.save name=x").message, none.autosave(), none.run("game.kept").output], ["no place to keep games here (the app's storage)", false, []]);

// expect: ok game.save: kept by its name
// expect: ok game.kept: the names, in order
// expect: ok game.open: the game back, its settings with it
// expect: ok a name kept again is replaced, not listed twice
// expect: ok game.forget
// expect: ok refused: no such game, a name that is none
// expect: ok nothing to resume at first
// expect: ok autosaved after each change, not when nothing changed
// expect: ok the app started again: the game in progress resumed
// expect: ok and it undoes as it did
// expect: ok an autosave that will not open is not resumed
// expect: ok SAVEGAME, LISTGAMES, OPENGAME, FORGETGAME
// expect: ok OPENGAME of a game not kept
// expect: ok no store: refused, said why; nothing autosaved
