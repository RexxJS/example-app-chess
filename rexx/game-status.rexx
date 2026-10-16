-- game-status.rexx: the old control-bus demo's "Get Game Status"
-- (chess-controlbus-demo.html), against the sae app.
REQUIRE "./chess-address.js"

ADDRESS CHESS "get-status"
IF RC <> 0 THEN DO
  SAY "✗ get-status: RC" RC ERRORTEXT
  EXIT 1
END
SAY "Game status: " RESULT
SAY "✓ get-status done"
