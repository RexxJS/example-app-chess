// app/chess/rexxjs.js: RexxJS vendored (vendor/rexxjs/, a copy made by
// tools/bundle-rexxjs.mjs ../RexxJS, UPSTREAM recording the commit) and
// bundled as one module a sae page imports. One REXX program on it, headless:
// the interpreter is there, parses, runs and says.
//
// RexxJS's SAY takes words (SAY "Status: " RESULT), each a variable, a
// literal or a call, so "SAY 1+1" says the word 1+1, where classic REXX
// would work out 2; an expression is worked out in an assignment. Both are
// checked here, so a change in RexxJS's SAY shows when it is re-vendored.
import { RexxInterpreter, parse } from "./chess/rexxjs.js";
import { eq } from "./lib/check.ts";

const run = async (program: string): Promise<string[]> => {
  const said: string[] = [];
  const it = new RexxInterpreter(null, { output: (line: unknown) => said.push(String(line)) });
  await it.run(parse(program));
  return said;
};

eq("1+1 gives 2 on the vendored interpreter", await run("x = 1+1\nSAY x"), ["2"]);
eq("SAY says its words, as RexxJS has it", await run("SAY 1+1"), ["1+1"]);
eq("the string functions a chess script will use", await run('x = "e2e4"\nSAY LEFT(x, 2) || "-" || RIGHT(x, 2)'), ["e2-e4"]);
eq("a loop", await run("s = 0\nDO i = 1 TO 3\n  s = s + i\nEND\nSAY s"), ["6"]);
// RexxJS 9478e75 (re-vendored 2026-10-15): DO FOREVER with LEAVE, and
// c = a || b with no LET, both of which a chess script wants.
eq("DO FOREVER and LEAVE", await run("n = 0\nDO FOREVER\n  n = n + 1\n  IF n = 4 THEN LEAVE\nEND\nSAY n"), ["4"]);
eq("a || b assigned without LET", await run('a = "e2"\nb = "e4"\nc = a || b\nSAY c'), ["e2e4"]);

// expect: ok 1+1 gives 2 on the vendored interpreter
// expect: ok SAY says its words, as RexxJS has it
// expect: ok the string functions a chess script will use
// expect: ok a loop
// expect: ok DO FOREVER and LEAVE
// expect: ok a || b assigned without LET
