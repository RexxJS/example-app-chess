-- opening-moves.rexx: the old control-bus demo's "Play Opening Moves"
-- (chess-controlbus-demo.html), against the sae app: a new game, then the
-- Sicilian's first moves by the old command lines.
REQUIRE "./chess-address.js"

ADDRESS CHESS "new-game"

ADDRESS CHESS "move from=e2 to=e4"
IF RC <> 0 THEN DO
  SAY "✗ e2-e4: RC" RC ERRORTEXT
  EXIT 1
END
SAY "White: e2-e4"

ADDRESS CHESS "move from=c7 to=c5"
IF RC <> 0 THEN DO
  SAY "✗ c7-c5: RC" RC ERRORTEXT
  EXIT 1
END
SAY "Black: c7-c5"

ADDRESS CHESS "get-status"
SAY "Status: " RESULT
SAY "✓ opening played"
