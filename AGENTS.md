# Notes for agents

Start with [README.md](README.md): what the folders are, and how to run and
test the sae app. Then [TODO.md](TODO.md), the plan: the migration to sae in
stages, each step one commit with its tests, struck through with its date
when done. The record of what came before it (the Tauri wrapper, the
`ADDRESS CHESS` handler, the iframe bus) is
[docs/tauri-rexxjs-phases-done.md](docs/tauri-rexxjs-phases-done.md).

- **`app/` is where the work is.** The old DOM app (`src/`, `chess.html`,
  webpack, `src-tauri/`, `chess-controlbus-demo.html`) stays in place until
  the sae app has taken in what it did (TODO.md, rule 5); it is not to be
  extended. Only the engine's logic (`src/chess.js`, `bitboard.js`,
  `zobrist.js`, `move.js`, `position.js`, `parser.js`, later `ai.js`) is
  ported, to `app/chess/*.ts`; the jQuery ui, webpack and Tauri are not.
  Each ported file's header names its origin and keeps Kaj Björklund's
  copyright.
- **It runs on sae, beside this checkout** (`sae -> ../sae`). A feature
  that needs something new of sae (a page service, a grant, an aether-ui
  widget) is built in sae, with sae's own test of it, and used here after;
  `run-tests.sh` runs sae's harnesses on this repo's tests. When sae
  changes a page API this app uses, run `./run-tests.sh` here before
  pushing sae. If a step is blocked on something outside this repo, write
  it up as `asks/<topic>.md`, mark the step blocked in TODO.md, move on.
- **RexxJS is canonical for REXX.** `vendor/rexxjs/` is a copy; fix RexxJS
  itself (`../RexxJS`, with its tests), then re-vendor with
  `node tools/bundle-rexxjs.mjs ../RexxJS`. No sae or app code goes into
  RexxJS.
- **The model has no ui** (`app/chess/`), and is tested headless
  (`tests/headless/`, one file per area, `// expect:` lines as verdicts,
  run by sae's lowerer harness on QuickJS); what only the ui shows is
  tested in `tests/specs/`, through sae-driver. The headless tests reach
  the model as `./chess/...` through the `tests/headless/chess ->
  ../../app/chess` link. Perft node counts are the oracle for the move
  generator; a test that only compiles is not a test.
- **The dialect** is sae's: modern TypeScript with its types erased, run on
  QuickJS (`../sae/lower/README.md`). No `enum`, no DOM, no npm, no
  decorators; 64-bit values stay two 32-bit halves, as the old engine had
  them.
- **The spreadsheet is the model** (`../spraedsheet`, the same family):
  its `app/app.json`, its `app/sheet/` with commands, control functions
  and `described.ts`, its `tests/headless/lib/check.ts`, its
  `run-tests.sh` and its `tools/bundle-rexxjs.mjs` are what this repo's
  are shaped after. When in doubt about a shape, read how the spreadsheet
  did it.
- **Never read `../not-ours`** (there is a chess port there under another
  licence: ideas only, not to be looked at), nor GridCraft's repository.
- **Tests:** `./run-tests.sh`, all green before a push. Other agents in
  sibling repos run sae's spec driver on the same fixed ports, so run the
  tests through the family's lock script when one is set up for the
  session.
- **Commits** go straight to `master` (this repository's default branch).
  Docs-only commits carry `[skip actions]`.
