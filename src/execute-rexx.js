/**
 * Execute RexxJS Script in Chess Context
 * Allows full RexxJS scripts to be executed within the chess application
 */

import ChessRexxHandler from './chess-rexx-handler.js';

/**
 * Execute a full RexxJS script with ADDRESS CHESS support
 * @param {string} script - The RexxJS script to execute
 * @param {object} options - Optional configuration
 * @returns {Promise<object>} - { success, output, result, returnCode }
 */
export async function executeRexxScript(script, options = {}) {
  return new Promise(async (resolve) => {
    try {
      // Verify RexxJS is available
      if (!window.RexxInterpreter || !window.parse) {
        resolve({
          success: false,
          output: 'RexxJS interpreter not loaded',
          returnCode: 1
        });
        return;
      }

      // Create a new interpreter instance for this script
      const interpreter = new window.RexxInterpreter();

      // Initialize output capture
      let output = '';
      let result = '';
      let returnCode = 0;

      // Override SAY to capture output
      const originalSay = interpreter.say || function() {};
      interpreter.say = function(value) {
        output += value + '\n';
        if (originalSay) originalSay.call(this, value);
      };

      // Setup ADDRESS CHESS handler
      const handler = new ChessRexxHandler();
      if (window.ChessRexxHandler && window.ChessRexxHandler.gameInstance) {
        handler.setGameInstance(window.ChessRexxHandler.gameInstance);
      }

      // Register the handler with the interpreter
      const addressHandler = {
        send: async (command, params) => {
          return new Promise((resolveCommand) => {
            handler.run(command, params, { type: 'rexx-script' })
              .then(response => {
                // Update RC and RESULT variables
                if (interpreter.variables) {
                  interpreter.variables.RC = response.errorCode || 0;
                  interpreter.variables.RESULT = response.result || response.output || '';
                }
                resolveCommand(response);
              });
          });
        }
      };

      // Set the address target
      interpreter.addressTargets.set('chess', addressHandler);

      // Also register as global for compatibility
      window.ADDRESS_CHESS = addressHandler;

      try {
        // Parse the script
        const commands = window.parse(script);

        // Execute the parsed commands
        for (const command of commands) {
          // Handle different command types
          if (command.type === 'SAY') {
            interpreter.say(command.value || '');
          } else if (command.type === 'ADDRESS') {
            // Execute ADDRESS command via the handler
            const response = await addressHandler.send(command.command, command.params || {});
            if (response.errorCode) {
              returnCode = response.errorCode;
              result = response.output;
              if (options.stopOnError) break;
            } else {
              result = response.result || response.output || '';
            }
          } else if (command.type === 'ASSIGNMENT') {
            // Handle variable assignments
            interpreter.variables = interpreter.variables || {};
            interpreter.variables[command.variable] = command.value;
          }
          // Add more command types as needed
        }

      } catch (parseError) {
        output += `\nParse error: ${parseError.message}`;
        returnCode = 2;
      }

      resolve({
        success: returnCode === 0,
        output: output.trim(),
        result,
        returnCode,
        variables: interpreter.variables || {}
      });

    } catch (error) {
      resolve({
        success: false,
        output: `Error executing script: ${error.message}`,
        returnCode: 99
      });
    }
  });
}

/**
 * Setup script execution capability in chess
 * Registers handlers for executing scripts via ADDRESS CHESS "execute-rexx ..."
 */
export function setupRexxScriptExecution() {
  if (!window.ADDRESS_CHESS_HANDLER) {
    console.warn('ChessRexxHandler not initialized');
    return;
  }

  // Register a special execute-rexx command that accepts full scripts
  const originalHandler = window.ADDRESS_CHESS_HANDLER;

  window.ADDRESS_CHESS_HANDLER = async function(commandString, params = {}, sourceContext) {
    // Check if this is an execute-rexx command
    if (commandString.startsWith('execute-rexx')) {
      // Extract the script from params or by parsing the command
      let scriptContent = params.script || '';

      if (!scriptContent && commandString.includes('script=')) {
        // Parse the script from command string
        const match = commandString.match(/script="([^"]+)"/);
        scriptContent = match ? match[1] : '';
      }

      if (!scriptContent) {
        return {
          success: false,
          errorCode: 200,
          output: 'script parameter required for execute-rexx'
        };
      }

      // Execute the script
      try {
        const result = await executeRexxScript(scriptContent, params);
        return {
          success: result.success,
          errorCode: result.returnCode,
          output: result.output,
          result: result.result
        };
      } catch (error) {
        return {
          success: false,
          errorCode: 299,
          output: `Script execution error: ${error.message}`
        };
      }
    }

    // Otherwise, use the original handler for normal ADDRESS CHESS commands
    return originalHandler.call(this, commandString, params, sourceContext);
  };
}

export default executeRexxScript;
