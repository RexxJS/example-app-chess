/**
 * Chess Game - Webpack Entry Point
 * Bundles all chess modules with jQuery UI support
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

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // makeChessGame is defined in ui.js
  if (typeof makeChessGame === 'function') {
    makeChessGame();
  }
});
