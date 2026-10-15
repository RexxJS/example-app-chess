// The headless harness itself: a test here is a page run on sae's lowerer
// harness (../sae/lower/run-tests.sh --mod tests/headless), its imports
// lowered as modules, and its "// expect:" lines the verdicts that
// lib/check.ts's eq prints. The model's tests import it as ./chess/...,
// through the chess -> ../../app/chess link.
import { eq } from "./lib/check.ts";

eq("the harness runs a test and reads its verdicts", 1 + 1, 2);
eq("and compares as JSON, so arrays and objects are one check", [1, { a: "b" }], [1, { a: "b" }]);

// expect: ok the harness runs a test and reads its verdicts
// expect: ok and compares as JSON, so arrays and objects are one check
