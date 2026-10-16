-- show-board.rexx: the old control-bus demo's "Display Board"
-- (chess-controlbus-demo.html), against the sae app.
REQUIRE "./chess-address.js"

ADDRESS CHESS "get-board"
IF RC <> 0 THEN DO
  SAY "✗ get-board: RC" RC ERRORTEXT
  EXIT 1
END
SAY "Current board:"
SAY RESULT
SAY "✓ get-board done"
