import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifact = path.join(root, 'exports/LiveAC-Studio.html');
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const context = await browser.newContext({ offline: true, acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const networkRequests = [];
  const errors = [];
  page.on('request', request => {
    if (/^https?:/.test(request.url())) networkRequests.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  // Managed Chromium blocks file: URLs (ERR_BLOCKED_BY_ADMINISTRATOR).
  // Verify the exact artifact in an offline blank document without bypassing policy.
  await page.setContent(await readFile(artifact, 'utf8'), { waitUntil: 'load' });
  await expect(page.getByRole('heading', { name: 'Comfort, in the right place.' })).toBeVisible();
  await expect(page.locator('.model-option')).toHaveCount(6);
  await page.evaluate(() => document.fonts.ready);
  const assets = await page.evaluate(() => ({
    images: Array.from(document.images).map(img => ({ loaded: img.complete && img.naturalWidth > 0, embedded: img.src.startsWith('data:') })),
    fonts: Array.from(document.fonts).filter(font => font.status === 'loaded').map(font => font.family),
    overflow: document.documentElement.scrollWidth > window.innerWidth,
  }));
  assert.ok(assets.images.length >= 8, 'Room, product, and unit images should be present');
  assert.ok(assets.images.every(image => image.loaded && image.embedded), 'All displayed images must be embedded and decoded offline');
  assert.ok(assets.fonts.some(font => /DM Sans/.test(font)), 'Embedded DM Sans should load offline');
  assert.ok(assets.fonts.some(font => /Manrope/.test(font)), 'Embedded Manrope should load offline');
  assert.equal(assets.overflow, false);
  await page.screenshot({ path: '/tmp/liveac-local.png', fullPage: true });

  await page.getByLabel('Upload a room photo', { exact: true }).setInputFiles(path.join(root, 'public/sample-room.jpg'));
  await expect(page.getByAltText('Your uploaded room')).toBeVisible();
  await page.getByRole('button', { name: /ARTCOOL Gallery Premium.*Wood-look frame/ }).click();
  const unit = page.getByRole('button', { name: 'Air conditioner placement. Drag to move, or use arrow keys.' });
  const before = await unit.boundingBox();
  assert.ok(before);
  assert.ok(Math.abs(before.width / before.height - 1) < 0.02, 'Gallery illustration should preserve its square shape');
  await unit.focus();
  await unit.press('ArrowRight');
  const after = await unit.boundingBox();
  assert.ok(after.x > before.x, 'Placement should respond to keyboard movement');
  await page.getByLabel('Visual size', { exact: true }).fill('30');
  const resized = await unit.boundingBox();
  assert.ok(resized.width > after.width, 'Visual size should resize the unit');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save my preview' }).click();
  const download = await downloading;
  assert.equal(download.suggestedFilename(), 'liveac-room-preview.jpg');
  assert.equal(await download.failure(), null);
  const jpeg = await readFile(await download.path());
  assert.ok(jpeg.length > 1000, 'Export should contain an actual preview image');
  assert.equal(jpeg.subarray(0, 3).toString('hex'), 'ffd8ff');

  await page.getByRole('button', { name: 'Find the best spot' }).click();
  await expect(page.getByRole('alert')).toContainText(/hosted|online|local/i);
  assert.deepEqual(networkRequests, [], 'Local operation must not make any HTTP requests');
  assert.deepEqual(errors, [], 'Local app must run without JavaScript errors');
  await context.close();
  console.log('Standalone offline Chrome checks passed: embedded room/products/fonts; six models; photo upload; Gallery dimensions; placement; resizing; real JPEG export; honest hosted-AI limitation; no HTTP requests or JS errors.');
  console.log('Screenshot: /tmp/liveac-local.png');
  console.log('Direct file: navigation remains untested: managed Chromium blocks file URLs by administrator policy. Exact HTML verified via setContent in an offline blank document instead.');
} finally {
  await browser.close();
}
