/**
 * Chess RexxJS Control Handler
 * Provides ADDRESS CHESS command interface for game control via RexxJS
 */

/**
 * ChessRexxHandler - Manages RexxJS commands for chess operations
 */
class ChessRexxHandler {
  constructor() {
    this.handlers = {
      'move': this.move.bind(this),
      'get-board': this.getBoard.bind(this),
      'get-moves': this.getMoves.bind(this),
      'undo': this.undo.bind(this),
      'redo': this.redo.bind(this),
      'new-game': this.newGame.bind(this),
      'set-ai-difficulty': this.setAiDifficulty.bind(this),
      'get-status': this.getStatus.bind(this),
      'get-move-history': this.getMoveHistory.bind(this),
      'get-position-fen': this.getPositionFen.bind(this),
      'list-legal-moves': this.listLegalMoves.bind(this),
      'get-game-info': this.getGameInfo.bind(this),
    };

    // Reference to Chess game instance (set during initialization)
    this.gameInstance = null;
  }

  /**
   * Set the chess game instance (called during init)
   */
  setGameInstance(instance) {
    this.gameInstance = instance;
  }

  /**
   * Main handler called by RexxJS ADDRESS dispatcher
   */
  async run(commandString, params = {}, sourceContext) {
    try {
      if (!this.gameInstance) {
        return {
          success: false,
          errorCode: 1,
          output: 'Chess game not initialized'
        };
      }

      // Parse command if it's a string
      let method, args;
      if (typeof commandString === 'string') {
        const parts = commandString.trim().split(/\s+/);
        method = parts[0];
        args = {};

        for (let i = 1; i < parts.length; i++) {
          const [key, value] = parts[i].split('=');
          if (key && value !== undefined) {
            // Parse value types
            if (value === 'true') args[key] = true;
            else if (value === 'false') args[key] = false;
            else if (!isNaN(value) && value !== '') args[key] = Number(value);
            else args[key] = value;
          }
        }
      } else {
        method = commandString;
        args = params;
      }

      // Find and execute handler
      const handler = this.handlers[method];
      if (!handler) {
        return {
          success: false,
          errorCode: 2,
          output: `Unknown command: ${method}`
        };
      }

      const result = await handler(args);
      return {
        success: result.success !== false,
        errorCode: result.errorCode || 0,
        output: result.output || '',
        result: result.result || ''
      };
    } catch (error) {
      return {
        success: false,
        errorCode: 99,
        output: `Error: ${error.message}`
      };
    }
  }

  /**
   * Make a move on the board
   * Usage: ADDRESS CHESS "move from=e2 to=e4"
   */
  async move(params) {
    try {
      const { from, to } = params;
      if (!from || !to) {
        return { success: false, errorCode: 10, output: 'from and to parameters required (e.g., from=e2 to=e4)' };
      }

      if (!this.gameInstance.chessPosition) {
        return { success: false, errorCode: 11, output: 'Chess position not available' };
      }

      // Make the move
      const chessPos = this.gameInstance.chessPosition;
      const legalMoves = chessPos.getMoves();

      const move = legalMoves.find(m =>
        m.fromSquare === from && m.toSquare === to
      );

      if (!move) {
        return {
          success: false,
          errorCode: 12,
          output: `Illegal move: ${from} to ${to}. Try ADDRESS CHESS "get-moves" for legal moves.`
        };
      }

      chessPos.makeMove(move);

      // Check if AI should move
      if (chessPos.getToPlay() === 'black' && this.gameInstance.ai) {
        const aiMove = this.gameInstance.ai.getMove(chessPos);
        if (aiMove) {
          chessPos.makeMove(aiMove);
        }
      }

      return {
        success: true,
        output: `Move ${from} to ${to} executed`,
        result: `${from}${to}`
      };
    } catch (error) {
      return { success: false, errorCode: 19, output: error.message };
    }
  }

  /**
   * Get board state as ASCII diagram
   * Usage: ADDRESS CHESS "get-board"
   */
  async getBoard(params) {
    try {
      if (!this.gameInstance.chessPosition) {
        return { success: false, errorCode: 21, output: 'Chess position not available' };
      }

      const board = this.gameInstance.chessPosition.board;
      const ascii = this.boardToAscii(board);

      return {
        success: true,
        output: 'Board retrieved',
        result: ascii
      };
    } catch (error) {
      return { success: false, errorCode: 29, output: error.message };
    }
  }

  /**
   * Get legal moves for current position
   * Usage: ADDRESS CHESS "get-moves"
   */
  async getMoves(params) {
    try {
      if (!this.gameInstance.chessPosition) {
        return { success: false, errorCode: 31, output: 'Chess position not available' };
      }

      const moves = this.gameInstance.chessPosition.getMoves();
      const moveStrings = moves.map(m => `${m.fromSquare}${m.toSquare}`);

      return {
        success: true,
        output: `${moveStrings.length} legal moves available`,
        result: JSON.stringify(moveStrings)
      };
    } catch (error) {
      return { success: false, errorCode: 39, output: error.message };
    }
  }

  /**
   * List legal moves in detailed format
   * Usage: ADDRESS CHESS "list-legal-moves"
   */
  async listLegalMoves(params) {
    try {
      if (!this.gameInstance.chessPosition) {
        return { success: false, errorCode: 41, output: 'Chess position not available' };
      }

      const moves = this.gameInstance.chessPosition.getMoves();
      const moveDetails = moves.map(m => ({
        from: m.fromSquare,
        to: m.toSquare,
        piece: m.piece,
        isCapture: m.isCapture,
        isCheck: m.isCheck
      }));

      return {
        success: true,
        output: `${moves.length} legal moves`,
        result: JSON.stringify(moveDetails)
      };
    } catch (error) {
      return { success: false, errorCode: 49, output: error.message };
    }
  }

  /**
   * Undo last move
   * Usage: ADDRESS CHESS "undo"
   */
  async undo(params) {
    try {
      if (!this.gameInstance.chessPosition) {
        return { success: false, errorCode: 51, output: 'Chess position not available' };
      }

      const success = this.gameInstance.chessPosition.undo();

      if (!success) {
        return { success: false, errorCode: 52, output: 'No moves to undo' };
      }

      return { success: true, output: 'Last move undone' };
    } catch (error) {
      return { success: false, errorCode: 59, output: error.message };
    }
  }

  /**
   * Redo last undone move
   * Usage: ADDRESS CHESS "redo"
   */
  async redo(params) {
    try {
      if (!this.gameInstance.chessPosition) {
        return { success: false, errorCode: 61, output: 'Chess position not available' };
      }

      const success = this.gameInstance.chessPosition.redo();

      if (!success) {
        return { success: false, errorCode: 62, output: 'No moves to redo' };
      }

      return { success: true, output: 'Move redone' };
    } catch (error) {
      return { success: false, errorCode: 69, output: error.message };
    }
  }

  /**
   * Start new game
   * Usage: ADDRESS CHESS "new-game"
   */
  async newGame(params) {
    try {
      if (!this.gameInstance.chessPosition) {
        return { success: false, errorCode: 71, output: 'Chess position not available' };
      }

      this.gameInstance.chessPosition.clear();

      return { success: true, output: 'New game started' };
    } catch (error) {
      return { success: false, errorCode: 79, output: error.message };
    }
  }

  /**
   * Set AI difficulty level
   * Usage: ADDRESS CHESS "set-ai-difficulty level=3"
   */
  async setAiDifficulty(params) {
    try {
      const { level } = params;
      if (level === undefined) {
        return { success: false, errorCode: 81, output: 'level parameter required (1-4)' };
      }

      if (level < 1 || level > 4) {
        return { success: false, errorCode: 82, output: 'level must be between 1 and 4' };
      }

      if (!this.gameInstance.ai) {
        return { success: false, errorCode: 83, output: 'AI not available' };
      }

      // Set AI search depth based on level
      this.gameInstance.ai.setSearchDepth(level * 2);

      return { success: true, output: `AI difficulty set to level ${level}` };
    } catch (error) {
      return { success: false, errorCode: 89, output: error.message };
    }
  }

  /**
   * Get game status
   * Usage: ADDRESS CHESS "get-status"
   */
  async getStatus(params) {
    try {
      if (!this.gameInstance.chessPosition) {
        return { success: false, errorCode: 91, output: 'Chess position not available' };
      }

      const pos = this.gameInstance.chessPosition;
      let status = 'in_progress';

      const moves = pos.getMoves();
      if (moves.length === 0) {
        status = pos.isCheck() ? 'checkmate' : 'stalemate';
      } else if (pos.isCheck()) {
        status = 'check';
      }

      const info = {
        status,
        toPlay: pos.getToPlay(),
        isCheck: pos.isCheck(),
        legalMoves: moves.length
      };

      return {
        success: true,
        output: `Game status: ${status}`,
        result: JSON.stringify(info)
      };
    } catch (error) {
      return { success: false, errorCode: 99, output: error.message };
    }
  }

  /**
   * Get move history
   * Usage: ADDRESS CHESS "get-move-history"
   */
  async getMoveHistory(params) {
    try {
      if (!this.gameInstance.chessPosition) {
        return { success: false, errorCode: 101, output: 'Chess position not available' };
      }

      const history = this.gameInstance.chessPosition.getMoveHistory?.() || [];

      return {
        success: true,
        output: `${history.length} moves in history`,
        result: JSON.stringify(history)
      };
    } catch (error) {
      return { success: false, errorCode: 109, output: error.message };
    }
  }

  /**
   * Get position in FEN notation
   * Usage: ADDRESS CHESS "get-position-fen"
   */
  async getPositionFen(params) {
    try {
      if (!this.gameInstance.chessPosition) {
        return { success: false, errorCode: 111, output: 'Chess position not available' };
      }

      const fen = this.gameInstance.chessPosition.getFen?.() || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

      return {
        success: true,
        output: 'FEN retrieved',
        result: fen
      };
    } catch (error) {
      return { success: false, errorCode: 119, output: error.message };
    }
  }

  /**
   * Get comprehensive game information
   * Usage: ADDRESS CHESS "get-game-info"
   */
  async getGameInfo(params) {
    try {
      if (!this.gameInstance.chessPosition) {
        return { success: false, errorCode: 121, output: 'Chess position not available' };
      }

      const pos = this.gameInstance.chessPosition;
      const moves = pos.getMoves();

      let status = 'in_progress';
      if (moves.length === 0) {
        status = pos.isCheck() ? 'checkmate' : 'stalemate';
      } else if (pos.isCheck()) {
        status = 'check';
      }

      const info = {
        status,
        toPlay: pos.getToPlay(),
        isCheck: pos.isCheck(),
        legalMoveCount: moves.length,
        halfMoveClock: pos.getHalfMoveClock?.() || 0,
        fullMoveNumber: pos.getFullMoveNumber?.() || 1,
        board: this.boardToAscii(pos.board)
      };

      return {
        success: true,
        output: 'Game info retrieved',
        result: JSON.stringify(info)
      };
    } catch (error) {
      return { success: false, errorCode: 129, output: error.message };
    }
  }

  /**
   * Convert board to ASCII representation
   */
  boardToAscii(board) {
    const pieces = {
      'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
      'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
    };

    let ascii = '  a b c d e f g h\n';

    for (let rank = 8; rank >= 1; rank--) {
      ascii += rank + ' ';
      for (let file = 0; file < 8; file++) {
        const square = String.fromCharCode(97 + file) + rank;
        const piece = board[square];
        ascii += (piece ? pieces[piece] : '.') + ' ';
      }
      ascii += rank + '\n';
    }

    ascii += '  a b c d e f g h';
    return ascii;
  }
}

/**
 * Initialize the RexxJS handler
 * Called from index.js after game is initialized
 */
export function initializeChessRexxHandler(gameInstance) {
  const handler = new ChessRexxHandler();
  handler.setGameInstance(gameInstance);

  // Register with window for RexxJS to find
  window.ADDRESS_CHESS_HANDLER = handler.run.bind(handler);

  // Also expose the full handler for direct method calls
  window.ChessRexxHandler = handler;

  return handler;
}

export default ChessRexxHandler;
