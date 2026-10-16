/* match.rexx: two chess apps play each other over their control buses
   (TODO.md 6.1). The app called white plays white with its computer
   player, the app called black plays black with its own; each move one
   makes is sent to the other, so both boards follow the one game. The
   script is the tournament: who plays, at what level, for how long.

     CHESS_WHITE_DIR=<white's data folder> CHESS_BLACK_DIR=<black's> \
       RexxJS/core/rexx rexx/match.rexx [-- moves [white level [black level]]]

   Each app started with --control-bus and its own SAE_APPDATA_DIR. */
moves = ARG(1)
wlevel = ARG(2)
blevel = ARG(3)
IF moves = '' THEN moves = 20
IF wlevel = '' THEN wlevel = 2
IF blevel = '' THEN blevel = 1
REQUIRE "./chess-match.js"
ADDRESS MATCH
'white NEWGAME()'
IF RC \= 0 THEN DO
  SAY 'ERROR: white:' ERRORTEXT
  EXIT 1
END
'black NEWGAME()'
IF RC \= 0 THEN DO
  SAY 'ERROR: black:' ERRORTEXT
  EXIT 1
END
'white SETAIDIFFICULTY(' || wlevel || ')'
'black SETAIDIFFICULTY(' || blevel || ')'
'white SETBOOK(1)'
SAY 'A match of' moves 'moves: white at level' wlevel '(from its book), black at level' blevel
line = ''
n = 0
DO WHILE n < moves
  n = n + 1
  'white AIMOVE()'
  IF RC \= 0 THEN DO
    SAY 'ERROR: white could not move:' ERRORTEXT
    EXIT 1
  END
  w = RESULT
  'black MOVESAN("' || w || '")'
  IF RC \= 0 THEN DO
    SAY 'ERROR: black would not take' w || ':' ERRORTEXT
    EXIT 1
  END
  'black LASTMOVE()'
  IF RESULT.san \= w | RESULT.by \= 'white' THEN DO
    SAY 'ERROR: black has' RESULT.san 'by' RESULT.by 'as its last move, not' w 'by white'
    EXIT 1
  END
  'black GETRESULT()'
  IF RESULT \= '*' THEN DO
    SAY n || '.' w
    LEAVE
  END
  'black AIMOVE()'
  IF RC \= 0 THEN DO
    SAY 'ERROR: black could not move:' ERRORTEXT
    EXIT 1
  END
  b = RESULT
  'white MOVESAN("' || b || '")'
  IF RC \= 0 THEN DO
    SAY 'ERROR: white would not take' b || ':' ERRORTEXT
    EXIT 1
  END
  SAY n || '.' w b
  'white GETRESULT()'
  IF RESULT \= '*' THEN LEAVE
END
'white GETFEN()'
wfen = RESULT
'black GETFEN()'
bfen = RESULT
'white GETRESULT()'
result = RESULT
'white OPENINGNAME()'
opening = RESULT
IF wfen \= bfen THEN DO
  SAY 'ERROR: the two boards differ:' wfen '|' bfen
  EXIT 1
END
SAY 'Opening:' opening
SAY 'Both boards:' wfen
SAY '✓ match played:' n 'moves, result' result
