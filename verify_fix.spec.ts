import { test, expect } from '@playwright/test';

test('verify cyberpunk glow', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Select Cyberpunk preset
  await page.selectOption('select', 'cyberpunk');

  // Give it a moment to render
  await page.waitForTimeout(1000);

  // Capture screenshot
  await page.screenshot({ path: 'verification/cyberpunk_glow_fixed.png' });
});
