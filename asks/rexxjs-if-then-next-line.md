# RexxJS: `IF ... THEN` with its statement on the next line

**For:** RexxJS (`../RexxJS`), which is canonical for REXX here.
**From:** the chess app (`tests/headless/chess_rexx.ts`, example 3 of
`CHESS_COMMANDS.md`), 2026-10-15, RexxJS at 9478e75.

## What happens

Classic REXX lets the statement an `IF` governs follow `THEN` on the next
line, and the same for `ELSE`:

```rexx
ADDRESS CHESS "move from=e2 to=e4"
IF RC = 0 THEN
    SAY "✓ e2-e4 is legal"
ELSE
    SAY "✗ e2-e4 is illegal: " RC
```

RexxJS refuses it: `Missing ENDIF for IF statement at line 2`. The same
with `THEN SAY ...` on one line runs. (`ENDIF` is not REXX at all; the
message names RexxJS's own block form.)

## Why it matters

The chess app's old `CHESS_COMMANDS.md` examples (written for the old
app, which ran on RexxJS too, so this example never ran there either)
are to run as they are (TODO.md 2.4). Example 3 is the only one of the
five that does not; the headless test runs it as it is and pins the
parse error, and runs it again with each `IF` on one line, which passes.
When RexxJS takes the classic form, the first check flips: delete it and
resolve this.

## What is asked

The parser (`core/src/parser.js`): after `THEN` (or `ELSE`) at the end
of a line, the next statement is the one governed, as in classic REXX;
a `DO ... END` after it is a block as now.
