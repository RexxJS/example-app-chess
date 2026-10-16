-- test-connection.rexx
-- Is the chess app there? One command to its control bus, and what to do
-- when nothing answers.
--
-- Usage, from the repository's root:
--   1. Start the chess app (../app/) with its control bus on:
--      ../sae/target/build/bin/sae --app app --control-bus
--
--   2. Run this script in another terminal:
--      RexxJS/core/rexx rexx/test-connection.rexx

REQUIRE "./chess-address.js"

SAY "Testing connection to the chess app's control bus..."
SAY ""

ADDRESS CHESS
'CHESS_VERSION()'

IF RC = 0 THEN DO
  SAY "✓ Connection successful: chess version" RESULT
  EXIT 0
END

SAY "ERROR: no answer, RC" RC
SAY "  " ERRORTEXT
SAY ""
SAY "Troubleshooting:"
SAY "1. Is the chess app running? Start it with:"
SAY "     ../sae/target/build/bin/sae --app app --control-bus"
SAY "2. Without --control-bus the app does not listen at all."
SAY "3. Started with SAE_APPDATA_DIR? Set the same here, so sae-bus finds"
SAY "   the courier file."
EXIT 1
