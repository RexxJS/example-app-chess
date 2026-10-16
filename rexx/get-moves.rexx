-- get-moves.rexx: the old control-bus demo's "Get Available Moves"
-- (chess-controlbus-demo.html), against the sae app.
REQUIRE "./chess-address.js"

ADDRESS CHESS "get-moves"
IF RC <> 0 THEN DO
  SAY "✗ get-moves: RC" RC ERRORTEXT
  EXIT 1
END
SAY "Available moves: " RESULT
SAY "✓ get-moves done"
