// app/chess/clock.ts (TODO.md 6.2): clocks on a fake clock: a time control
// read and written ("5+3", "1:30+0"), the side to move's clock running,
// the increment after a move, the flag falling (a loss on time, or a draw
// when the other side cannot mate), a move refused once it has, a new game
// starting the clocks again; the clock.set and clock.state commands, and
// SETCLOCK() and GETCLOCK() in REXX.
import { Commands } from "./chess/commands.ts";
import { controlFunctions } from "./chess/control.ts";
import { controlOf, controlText, timeText } from "./chess/clock.ts";
import { Game } from "./chess/game.ts";
import { eq, throws } from "./lib/check.ts";

eq("a control read: minutes and seconds a move", [controlOf("5+3"), controlOf("1:30+0"), controlOf("0:05"), controlOf(" 0.5 + 1 ")], [{ base: 300000, inc: 3000 }, { base: 90000, inc: 0 }, { base: 5000, inc: 0 }, { base: 30000, inc: 1000 }]);
eq("and written", [controlText(controlOf("5+3")), controlText(controlOf("1:30+0")), controlText(controlOf("0:05"))], ["5+3", "1:30+0", "0:05+0"]);
throws("one that is not", () => controlOf("five"), Error, "five is not a time control (\"5+3\": minutes, then the seconds added a move; \"1:30+0\"; or \"none\")");
throws("no time at all", () => controlOf("0+5"), Error, "a time control gives some time, not 0+5");
eq("time shown: minutes, tenths under twenty seconds, hours", [timeText(297000), timeText(9450), timeText(3723000), timeText(-5)], ["4:57", "0:09.4", "1:02:03", "0:00.0"]);

let t = 1000;
const c = new Commands(undefined, null, () => t);
eq("no clocks at first", c.run("clock.state").output, null);
eq("clock.set 5+3", c.run("clock.set control=5+3").output, "5+3");
t += 4000;
eq("white's clock runs", c.run("clock.state").output, { control: "5+3", white: 296000, black: 300000, running: "white", flag: "" });
c.run("game.move san=e4");
eq("a move: the time charged, the increment added, black's clock running", c.run("clock.state").output, { control: "5+3", white: 299000, black: 300000, running: "black", flag: "" });
t += 10000;
c.run("game.move san=e5");
eq("black's move so", [c.clock!.left.black, c.clock!.running], [293000, "white"]);
c.run("game.undo");
eq("an undo takes no time back; the clock follows the side to move", [c.clock!.left.black, c.clock!.running], [293000, "black"]);

// The flag.
t += 293000;
eq("black's flag falls at zero", c.tick(), "black");
eq("the game is over on time: white wins", [c.game.status(), c.game.result(), c.game.statusText()], ["time_forfeit", "1-0", "black's flag fell: white wins on time (1-0)"]);
eq("a move refused once it has", c.run("game.move san=e5").message, "the game is over (time_forfeit, 1-0)");
eq("its clock stopped at zero", c.run("clock.state").output, { control: "5+3", white: 299000, black: 0, running: "", flag: "black" });
c.run("game.new");
eq("a new game starts the clocks again", c.run("clock.state").output, { control: "5+3", white: 300000, black: 300000, running: "white", flag: "" });

// A flag that falls before a move is made: the move is refused.
c.run("clock.set control=0:05");
t += 6000;
eq("the flag falls when the move comes in late", [c.run("game.move san=d4").ok, c.game.result()], [false, "0-1"]);

// A draw: the flag falls, but the other side has only a king and a knight.
const d = new Commands(new Game("4k3/8/8/8/8/8/8/2N1K1n1 b - - 0 1"), null, () => t);
d.run("clock.set control=1+0");
t += 61000;
d.tick();
eq("a flag against a side that cannot mate: a draw", [d.game.result(), d.game.statusText()], ["1/2-1/2", "black's flag fell, but white cannot mate: a draw (1/2-1/2)"]);
eq("canMate: a king and one minor cannot", [new Game("4k3/8/8/8/8/8/8/2N1K1n1 w - - 0 1").canMate("white"), new Game("4k3/8/8/8/8/8/8/1NN1K3 w - - 0 1").canMate("white"), new Game("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1").canMate("white")], [false, true, true]);

// A handicap, none, a bad one; the game file keeps the flag.
eq("white=, black=: a side's time in seconds", [c.run("clock.set control=5+0 white=60").ok, c.clock!.left.white, c.clock!.left.black], [true, 60000, 300000]);
eq("none takes them away", [c.run("clock.set control=none").ok, c.clock], [true, null]);
eq("a bad control refused", c.run("clock.set control=soon").ok, false);
const g = new Game();
g.flagFall("white");
const f = new Game();
f.fromFile(JSON.stringify(g.toFile()));
eq("the game file keeps a flag that fell", [f.status(), f.result()], ["time_forfeit", "0-1"]);

// REXX.
const r = new Commands(undefined, null, () => t);
const fns = controlFunctions((id, params) => r.execute(id, params), r.game, {});
eq("GETCLOCK() with no clocks", (fns.GETCLOCK() as any).control, "");
eq("SETCLOCK(\"3+2\")", fns.SETCLOCK("3+2"), "3+2");
t += 2500;
eq("GETCLOCK(): seconds to a tenth, as shown, whose runs", fns.GETCLOCK(), { control: "3+2", white: 177.5, black: 180, running: "white", flag: "", whiteText: "2:57", blackText: "3:00" });
eq("SETCLOCK(\"1+0\", 10, 20)", [fns.SETCLOCK("1+0", 10, 20), (fns.GETCLOCK() as any).white, (fns.GETCLOCK() as any).black], ["1+0", 10, 20]);
throws("SETCLOCK of no control", () => fns.SETCLOCK("x"), Error, "x is not a time control (\"5+3\": minutes, then the seconds added a move; \"1:30+0\"; or \"none\")");
eq("SETCLOCK(\"none\")", fns.SETCLOCK("none"), "");

// expect: ok a control read: minutes and seconds a move
// expect: ok and written
// expect: ok one that is not
// expect: ok no time at all
// expect: ok time shown: minutes, tenths under twenty seconds, hours
// expect: ok no clocks at first
// expect: ok clock.set 5+3
// expect: ok white's clock runs
// expect: ok a move: the time charged, the increment added, black's clock running
// expect: ok black's move so
// expect: ok an undo takes no time back; the clock follows the side to move
// expect: ok black's flag falls at zero
// expect: ok the game is over on time: white wins
// expect: ok a move refused once it has
// expect: ok its clock stopped at zero
// expect: ok a new game starts the clocks again
// expect: ok the flag falls when the move comes in late
// expect: ok a flag against a side that cannot mate: a draw
// expect: ok canMate: a king and one minor cannot
// expect: ok white=, black=: a side's time in seconds
// expect: ok none takes them away
// expect: ok a bad control refused
// expect: ok the game file keeps a flag that fell
// expect: ok GETCLOCK() with no clocks
// expect: ok SETCLOCK("3+2")
// expect: ok GETCLOCK(): seconds to a tenth, as shown, whose runs
// expect: ok SETCLOCK("1+0", 10, 20)
// expect: ok SETCLOCK of no control
// expect: ok SETCLOCK("none")
