import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = path.resolve(__dirname, '..', 'test-artifacts');

const queryText =
  'Explain the difference between symmetric and asymmetric encryption, and when to use each.';

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }

  fs.mkdirSync(artifactsDir, { recursive: true });
  const safeTitle = testInfo.title.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase();

  await page.screenshot({
    path: path.join(artifactsDir, `${safeTitle}.png`),
    fullPage: true
  });

  const html = await page.content();
  fs.writeFileSync(path.join(artifactsDir, `${safeTitle}.html`), html, 'utf8');
});

test('runs stage1 -> stage2 -> stage3 and renders results', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const queryInput = page.getByPlaceholder('Ask a question for the council...');
  await queryInput.fill(queryText);

  const runButton = page.getByRole('button', { name: /run pipeline/i });
  await runButton.click();

  const tabA = page.getByRole('button', { name: 'A', exact: true });
  const tabB = page.getByRole('button', { name: 'B', exact: true });

  await expect(tabA).toBeVisible();
  await expect(tabB).toBeVisible();

  const tabPanel = page.locator('.tab-panel');
  await tabA.click();
  await expect(tabPanel.locator('.answer-text')).toHaveText(/\S/);
  await tabB.click();
  await expect(tabPanel.locator('.answer-text')).toHaveText(/\S/);

  const reviewList = page.locator('.review-list');
  await expect(reviewList).toBeVisible();
  await expect(reviewList.locator('.review-item').first()).toBeVisible();

  await page.waitForFunction(() => {
    return document.querySelectorAll('.ranking-table tbody tr').length >= 2;
  });

  const finalAnswer = page.locator('.final-card .final-answer');
  await expect(finalAnswer).toHaveText(/\S/);

  const rationale = page.locator('.final-card .rationale p');
  await expect(rationale).toHaveText(/\S/);
});
