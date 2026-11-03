import { expect, test } from '@playwright/test';
import path from 'node:path';

const placement = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Air conditioner placement. Drag to move, or use arrow keys.' });
const photoFile = path.resolve('public/sample-room.jpg');

test('room studio renders without overflow and provides a visual preview', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Comfort, in the right place.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /ARTCOOL AI Mirror.*Mirror black/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.room-photo')).toHaveJSProperty('complete', true);
  await expect(page.locator('.model-option')).toHaveCount(6);
  await page.evaluate(() => document.fonts.ready);
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.viewport);
  expect(errors).toEqual([]);
  await page.screenshot({ path: `/tmp/liveac-${testInfo.project.name}.png`, fullPage: true });
});

test('upload, choose a design, adjust placement and export the resulting photo', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Upload a room photo', { exact: true }).setInputFiles(photoFile);
  await expect(page.getByAltText('Your uploaded room')).toBeVisible();
  await page.getByRole('button', { name: /ARTCOOL Gallery Premium.*Wood-look frame/ }).click();
  await expect(page.getByRole('button', { name: /ARTCOOL Gallery Premium.*Wood-look frame/ })).toHaveAttribute('aria-pressed', 'true');
  const before = await placement(page).boundingBox();
  expect(before).not.toBeNull();
  expect(Math.abs(before!.width / before!.height - 1)).toBeLessThan(.02);
  await placement(page).focus();
  await placement(page).press('ArrowRight');
  const after = await placement(page).boundingBox();
  expect(after!.x).toBeGreaterThan(before!.x);
  await page.getByLabel('Visual size', { exact: true }).fill('30');
  const resized = await placement(page).boundingBox();
  expect(resized!.width).toBeGreaterThan(after!.width);
  await page.getByLabel('View original room', { exact: true }).click();
  await expect(placement(page)).toHaveCount(0);
  await page.getByLabel('Show unit', { exact: true }).click();
  await expect(placement(page)).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save my preview' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('liveac-room-preview.jpg');
  expect(await download.failure()).toBeNull();
});

test('manual pointer dragging moves the unit and leaves it inside the photo', async ({ page }) => {
  await page.goto('/');
  const unit = placement(page);
  const box = await unit.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 45, box!.y + box!.height / 2 + 50, { steps: 5 });
  await page.mouse.up();
  const moved = await unit.boundingBox();
  const stage = await page.locator('.room-stage').boundingBox();
  expect(moved!.x).toBeGreaterThan(box!.x + 25);
  expect(moved!.y).toBeGreaterThan(box!.y + 25);
  expect(moved!.x).toBeGreaterThanOrEqual(stage!.x);
  expect(moved!.y).toBeGreaterThanOrEqual(stage!.y);
  expect(moved!.x + moved!.width).toBeLessThanOrEqual(stage!.x + stage!.width);
});

test('unconfigured AI reports the missing connection without uploading a photo', async ({ page }) => {
  await page.route('**/api/health', route => route.fulfill({json:{ok:true,aiConfigured:false}}));
  let uploads = 0;
  page.on('request', request => { if (request.url().endsWith('/api/recommend')) uploads += 1; });
  await page.goto('/');
  await expect(page.getByText('AI connection needs setup')).toBeVisible();
  await page.getByRole('button', { name: 'Find the best spot' }).click();
  await expect(page.getByRole('alert')).toContainText('Your photo has not been sent.');
  expect(uploads).toBe(0);
});

test('mocked AI journey requires consent, submits the photo, and applies only on request', async ({ page }) => {
  let submitted: Record<string, any> | null = null;
  await page.route('**/api/health', route => route.fulfill({ json: { ok: true, aiConfigured: true } }));
  await page.route('**/api/recommend', route => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ json: { placement: { x: .62, y: .17, width: .2, confidence: 'medium', summary: 'A balanced spot on the clear upper wall.', reasoning: ['Keeps the window clear.'], warnings: ['A qualified installer must confirm requirements.'] } } });
  });
  await page.goto('/');
  const before = await placement(page).getAttribute('style');
  await page.getByRole('button', { name: 'Find the best spot' }).click();
  await expect(page.getByRole('dialog')).toContainText('we’ll send this room photo');
  expect(submitted).toBeNull();
  await page.getByRole('button', { name: 'Analyze my photo' }).click();
  await expect(page.getByText('A balanced spot on the clear upper wall.')).toBeVisible();
  expect(submitted).not.toBeNull();
  expect(submitted!['image']).toMatch(/^data:image\/jpeg;base64,/);
  expect(submitted!['model'].name).toBe('ARTCOOL AI Mirror');
  expect(submitted!['wallWidthCm']).toBe(420);
  expect(submitted!['imageWidth']).toBe(1600);
  await expect(placement(page)).toHaveAttribute('style', before!);
  await page.getByRole('button', { name: 'Try this position' }).click();
  await expect(page.getByRole('button', { name: 'Position applied' })).toBeDisabled();
  await expect(placement(page)).toHaveAttribute('style', /left: 62%; top: 17%; width: 20%;/);
});

test('expanded preview preserves photo geometry and closes with Escape', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Expand preview', { exact: true }).click();
  await expect(page.getByLabel('Close expanded preview')).toBeVisible();
  const stage = await page.locator('.room-stage').boundingBox();
  expect(Math.abs(stage!.width / stage!.height - 4 / 3)).toBeLessThan(.02);
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Close expanded preview')).toHaveCount(0);
});
