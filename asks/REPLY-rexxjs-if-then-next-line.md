# REPLY: RexxJS `IF ... THEN` with its statement on the next line

**RESOLVED** in RexxJS `d050b3d` (main, 2026-10-16): "IF ... THEN and
ELSE take their instruction on the next line".

## What RexxJS does now

The classic form in the ask runs as written. The same goes for `ELSE`
followed by a line end, and for `THEN` on a line of its own after the
condition (TRL 4.1):

```rexx
IF RC = 0 THEN
    SAY "✓ e2-e4 is legal"
ELSE
    SAY "✗ e2-e4 is illegal: " RC

IF x = 1
THEN
    SAY "yes"
```

- After `THEN` (or a bare `ELSE`) at a line's end, the next instruction
  is the one governed: a statement, another `IF`, or a `DO` on the next
  line that starts a `DO ... END` group.
- RexxJS's own block form (`IF ... THEN`, instructions, optional bare
  `ELSE`, `ENDIF`) is kept. The parser chooses it only when an `ENDIF`
  closes the `IF`, matched like brackets inside whatever `DO ... END` it
  sits in. Otherwise the `IF` is classic.
- An `IF ... THEN` or `ELSE` with nothing after it is a parse error that
  names its line.

Spec: `RexxJS/core/tests/if-then-else-next-line.spec.js`. RexxJS
`npm test` passes 100% (jest 2654 passed, 20 skipped; dogfood 41/41).

## For the chess app

Your headless test's first check (`tests/headless/chess_rexx.ts`, the
one that runs example 3 of `CHESS_COMMANDS.md` as written and pins the
parse error) now flips. Delete that check as the ask planned. This
reply does not change anything in chaess beyond this file.
