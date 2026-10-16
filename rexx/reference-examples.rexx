-- reference-examples.rexx: CHESS_COMMANDS.md's examples, included there as
-- they are by tools/gen-commands.mjs, and run against the app by
-- spec_app_chess_rexx. From the repository's root, with the app running
-- (--control-bus): RexxJS/core/rexx rexx/reference-examples.rexx
REQUIRE "./chess-address.js"
ADDRESS CHESS "new-game"

/* An opening, by the old lines */
ADDRESS CHESS "move from=e2 to=e4"
ADDRESS CHESS "move from=c7 to=c5"
ADDRESS CHESS "move from=g1 to=f3"
ADDRESS CHESS "get-status"
SAY "Status: " RESULT

/* A move tried, and refused */
ADDRESS CHESS "move from=e7 to=e4"
IF RC = 0 THEN SAY "legal"
ELSE SAY "illegal:" ERRORTEXT

/* The functions: undo and redo, the position */
ADDRESS CHESS 'UNDO()'
SAY RESULT "move back"
ADDRESS CHESS 'REDO()'
ADDRESS CHESS 'GETFEN()'
SAY "FEN:" RESULT

/* The legal moves, as a stem */
ADDRESS CHESS 'LISTLEGALMOVES()'
m = RESULT
SAY m.0 "legal moves; the first:" m.1.san
