/**
 * Chess Game - Webpack Entry Point
 * Bundles all chess modules with jQuery UI support and RexxJS handler
 */

"use strict";

// Load jQuery and jQuery UI
require('jquery');
require('jquery-ui');
require('jquery-ui/themes/base/all.css');
require('jquery-ui-touch-punch');

// Load chess modules
require('./chess.js');
require('./bitboard.js');
require('./zobrist.js');
require('./move.js');
require('./position.js');
require('./parser.js');
require('./ai.js');
require('./ui.js');

// Load chess CSS
require('./chess.css');

// Import RexxJS handler
const { initializeChessRexxHandler } = require('./chess-rexx-handler.js');
const { setupRexxScriptExecution } = require('./execute-rexx.js');

// Store global reference to game instance
let gameInstance = null;

// Override makeChessGame to capture the instance
const originalMakeChessGame = window.makeChessGame;
if (originalMakeChessGame) {
  window.makeChessGame = function() {
    const result = originalMakeChessGame.call(this);

    // The game instance is typically stored in window.Chess or similar
    // We'll look for it after the game initializes
    setTimeout(() => {
      if (window.Chess && window.Chess.UI) {
        // Try to find the game instance
        const chessUI = window.Chess.UI;
        // Initialize RexxJS handler with the game instance
        initializeChessRexxHandler(chessUI);
        // Setup script execution capability
        setupRexxScriptExecution();
        console.log('Chess RexxJS handler initialized');
      }
    }, 100);

    return result;
  };
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // makeChessGame is defined in ui.js
  if (typeof makeChessGame === 'function') {
    makeChessGame();
  }
});
