/**
 * Chess RexxJS Integration Tests
 * Tests for in-app execution and iframe control bus
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8080';
const CONTROL_BUS_URL = `${BASE_URL}/chess-controlbus-demo.html`;

test.describe('Chess In-App RexxJS Execution', () => {
  test('chess app loads successfully', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    const chessboard = await page.locator('#chessboard').isVisible();
    expect(chessboard).toBeTruthy();
  });

  test('ChessRexxHandler is registered globally', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    const handlerExists = await page.evaluate(() => {
      return typeof window.ADDRESS_CHESS_HANDLER === 'function';
    });

    expect(handlerExists).toBeTruthy();
  });

  test('can execute get-moves command', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    const result = await page.evaluate(async () => {
      return await window.ADDRESS_CHESS_HANDLER('get-moves');
    });

    expect(result.success).toBe(true);
    expect(result.errorCode).toBe(0);
    expect(result.result).toBeTruthy();
  });

  test('can execute get-status command', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    const result = await page.evaluate(async () => {
      return await window.ADDRESS_CHESS_HANDLER('get-status');
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Game status');
  });

  test('can execute get-board command', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    const result = await page.evaluate(async () => {
      return await window.ADDRESS_CHESS_HANDLER('get-board');
    });

    expect(result.success).toBe(true);
    expect(result.result).toContain('♔');
  });

  test('can execute move command', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    const result = await page.evaluate(async () => {
      return await window.ADDRESS_CHESS_HANDLER('move', { from: 'e2', to: 'e4' });
    });

    expect(result.success).toBe(true);
  });

  test('rejects illegal move', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    const result = await page.evaluate(async () => {
      return await window.ADDRESS_CHESS_HANDLER('move', { from: 'e2', to: 'e5' });
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBeGreaterThan(0);
  });

  test('can execute undo command', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    // Make a move first
    await page.evaluate(async () => {
      await window.ADDRESS_CHESS_HANDLER('move', { from: 'e2', to: 'e4' });
    });

    // Then undo
    const result = await page.evaluate(async () => {
      return await window.ADDRESS_CHESS_HANDLER('undo');
    });

    expect(result.success).toBe(true);
  });

  test('can execute new-game command', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    const result = await page.evaluate(async () => {
      return await window.ADDRESS_CHESS_HANDLER('new-game');
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('New game');
  });

  test('unknown command returns error', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    const result = await page.evaluate(async () => {
      return await window.ADDRESS_CHESS_HANDLER('invalid-command');
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBeGreaterThan(0);
  });
});

test.describe('Chess Control Bus (Iframe)', () => {
  test('control bus demo page loads', async ({ page }) => {
    await page.goto(CONTROL_BUS_URL);
    await page.waitForTimeout(3000);

    const title = await page.title();
    expect(title).toContain('Chess Control Bus');
  });

  test('script editor is visible', async ({ page }) => {
    await page.goto(CONTROL_BUS_URL);

    const editor = await page.locator('#scriptEditor').isVisible();
    expect(editor).toBeTruthy();
  });

  test('worker frame loads chess game', async ({ page }) => {
    await page.goto(CONTROL_BUS_URL);
    await page.waitForTimeout(3000);

    const frame = page.frameLocator('#chess-worker');
    const chessboard = await frame.locator('#chessboard').isVisible();
    expect(chessboard).toBeTruthy();
  });

  test('can load example script', async ({ page }) => {
    await page.goto(CONTROL_BUS_URL);

    // Click first example button
    await page.click('.example-scripts button:first-of-type');

    const editorText = await page.inputValue('#scriptEditor');
    expect(editorText.length).toBeGreaterThan(0);
  });

  test('clear button clears output', async ({ page }) => {
    await page.goto(CONTROL_BUS_URL);

    // Set some text
    await page.evaluate(() => {
      document.getElementById('output').textContent = 'Test output';
    });

    // Click clear
    await page.click('#clearBtn');

    const output = await page.textContent('#output');
    expect(output.trim()).toBe('');
  });

  test('script execution works', async ({ page }) => {
    await page.goto(CONTROL_BUS_URL);
    await page.waitForTimeout(3000);

    // Load example
    const buttons = await page.locator('.example-scripts button').all();
    await buttons[0].click();

    // Execute
    await page.click('#executeBtn');
    await page.waitForTimeout(2000);

    const output = await page.textContent('#output');
    expect(output.length).toBeGreaterThan(0);
  });

  test('multiple commands execute in sequence', async ({ page }) => {
    await page.goto(CONTROL_BUS_URL);
    await page.waitForTimeout(3000);

    const script = `ADDRESS CHESS "get-moves"
SAY "Moves loaded"

ADDRESS CHESS "get-status"
SAY "Status checked"`;

    await page.fill('#scriptEditor', script);
    await page.click('#executeBtn');
    await page.waitForTimeout(2000);

    const output = await page.textContent('#output');
    expect(output).toContain('Moves loaded');
    expect(output).toContain('Status checked');
  });

  test('worker frame persists across multiple commands', async ({ page }) => {
    await page.goto(CONTROL_BUS_URL);
    await page.waitForTimeout(3000);

    // First execution
    await page.fill('#scriptEditor', 'SAY "First"');
    await page.click('#executeBtn');
    await page.waitForTimeout(1000);

    // Check frame still there
    const frame = page.frameLocator('#chess-worker');
    const chessboard = await frame.locator('#chessboard').isVisible();
    expect(chessboard).toBeTruthy();

    // Second execution
    await page.fill('#scriptEditor', 'SAY "Second"');
    await page.click('#executeBtn');
    await page.waitForTimeout(1000);

    const chessboard2 = await frame.locator('#chessboard').isVisible();
    expect(chessboard2).toBeTruthy();
  });

  test('can clear output between executions', async ({ page }) => {
    await page.goto(CONTROL_BUS_URL);
    await page.waitForTimeout(3000);

    // First execution
    await page.fill('#scriptEditor', 'SAY "First"');
    await page.click('#executeBtn');
    await page.waitForTimeout(1000);

    // Clear
    await page.click('#clearBtn');
    let output = await page.textContent('#output');
    expect(output.trim()).toBe('');

    // Second execution
    await page.fill('#scriptEditor', 'SAY "Second"');
    await page.click('#executeBtn');
    await page.waitForTimeout(1000);

    output = await page.textContent('#output');
    expect(output).toContain('Second');
    expect(output).not.toContain('First');
  });
});

test.describe('Chess Control Bus Integration', () => {
  test('director and worker frames communicate', async ({ page }) => {
    await page.goto(CONTROL_BUS_URL);
    await page.waitForTimeout(3000);

    const directorScript = await page.locator('#scriptEditor').isVisible();
    expect(directorScript).toBeTruthy();

    const workerFrame = page.frameLocator('#chess-worker');
    const workerApp = await workerFrame.locator('#chessboard').isVisible();
    expect(workerApp).toBeTruthy();
  });

  test('status indicates connection', async ({ page }) => {
    await page.goto(CONTROL_BUS_URL);

    const statusText = page.locator('#statusText');
    const text = await statusText.textContent();
    expect(text).toBeDefined();
    expect(text.length).toBeGreaterThan(0);
  });
});
