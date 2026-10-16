-- play-a-game.rexx: the control functions from another program (not in
-- the old demo): a new game, the Scholar's mate by MOVE and MOVESAN, an
-- illegal move refused with why, the board and FEN read back, the result,
-- one UNDO, and LISTCOMMANDS.
REQUIRE "./chess-address.js"
ADDRESS CHESS

'NEWGAME()'
'MOVE("e2", "e4")'
SAY "1." RESULT
'MOVESAN("e5")'
'MOVESAN("Bc4")'
'MOVESAN("Nc6")'
'MOVESAN("Qh5")'

-- An illegal move: refused, and why.
'MOVE("e8", "e6")'
IF RC = 0 THEN DO
  SAY "✗ an illegal move was made"
  EXIT 1
END
SAY "✓ refused:" ERRORTEXT

'MOVESAN("Nf6")'
'MOVESAN("Qxf7")'
SAY "mate:" RESULT
'GETRESULT()'
IF RESULT <> "1-0" THEN DO
  SAY "✗ the result is" RESULT
  EXIT 1
END
SAY "✓ result 1-0"
'GETSTATUS()'
SAY "status:" RESULT.status "to play:" RESULT.toPlay

'UNDO()'
SAY "undone:" RESULT
'GETFEN()'
SAY "FEN:" RESULT
'GETBOARD()'
SAY RESULT

'LISTCOMMANDS()'
SAY "the app has" RESULT.0 "functions"
SAY "✓ a game played"
