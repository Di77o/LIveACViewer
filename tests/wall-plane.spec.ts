import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const corners = [
  { x: .1, y: .1 },
  { x: .82, y: .18 },
  { x: .9, y: .8 },
  { x: .08, y: .9 },
];
const placement = (page: Page) => page.getByRole('button', { name: 'Air conditioner placement. Drag to move, or use arrow keys.' });

async function clickCorners(page: Page, points = corners) {
  const stage = page.locator('.room-stage');
  await stage.scrollIntoViewIfNeeded();
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  for (const point of points) await stage.click({ position: { x: point.x * box!.width, y: point.y * box!.height } });
}
async function markWall(page: Page) {
  await page.getByRole('button', { name: 'Mark wall', exact: true }).click();
  await clickCorners(page);
  await expect(page.getByText('PLANE SET', { exact: true })).toBeVisible();
  await page.getByLabel('3D unit depth').uncheck();
  await page.getByLabel(/Keep original unit proportions/).uncheck();
  await expect(page.locator('.unit-plane')).toHaveAttribute('style', /matrix3d\(/);
}

async function projectedCenter(page: Page) {
  return placement(page).evaluate(element => {
    const plane = element.parentElement!;
    const matrix = new DOMMatrix(getComputedStyle(plane).transform);
    const unit = element as HTMLElement;
    const x = parseFloat(unit.style.left) / 100 * plane.clientWidth;
    const y = parseFloat(unit.style.top) / 100 * plane.clientHeight;
    const point = new DOMPoint(x, y).matrixTransform(matrix);
    return { x: point.x / point.w / plane.clientWidth, y: point.y / point.w / plane.clientHeight };
  });
}

test('manual wall marking anchors perspective, permits edits, and exports a projected JPEG', async ({ page }, testInfo) => {
  await page.goto('/');
  await markWall(page);
  const before = await placement(page).getAttribute('style');
  await placement(page).focus();
  await placement(page).press('ArrowRight');
  expect(await placement(page).getAttribute('style')).not.toBe(before);

  // Pointer motion is transformed back into wall coordinates rather than moving
  // the unit in flat image coordinates.
  await placement(page).scrollIntoViewIfNeeded();
  const unitBox = await placement(page).boundingBox();
  const centerBefore = await projectedCenter(page);
  await page.mouse.move(unitBox!.x + unitBox!.width / 2, unitBox!.y + unitBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(unitBox!.x + unitBox!.width / 2 + 20, unitBox!.y + unitBox!.height / 2 + 18, { steps: 5 });
  await page.mouse.up();
  const centerAfter = await projectedCenter(page);
  expect(centerAfter.x).toBeGreaterThan(centerBefore.x);
  expect(centerAfter.y).toBeGreaterThan(centerBefore.y);

  const corner = page.getByRole('button', { name: 'Top right wall corner. Drag or use arrow keys to adjust.' });
  const transformBefore = await page.locator('.unit-plane').getAttribute('style');
  await corner.focus();
  await corner.press('ArrowDown');
  expect(await page.locator('.unit-plane').getAttribute('style')).not.toBe(transformBefore);
  const cornerBox = await corner.boundingBox();
  const cornerStyleBefore = await corner.getAttribute('style');
  await page.mouse.move(cornerBox!.x + cornerBox!.width / 2, cornerBox!.y + cornerBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(cornerBox!.x + cornerBox!.width / 2 - 9, cornerBox!.y + cornerBox!.height / 2 + 6, { steps: 3 });
  await page.mouse.up();
  expect(await corner.getAttribute('style')).not.toBe(cornerStyleBefore);

  await page.getByLabel(/Marked wall width/).fill('500');
  await page.getByLabel(/Marked wall height/).fill('220');
  await page.getByLabel(/Marked wall height/).blur();
  await expect(page.getByLabel(/Marked wall width/)).toHaveValue('500');
  await expect(page.getByLabel(/Marked wall height/)).toHaveValue('220');
  await expect(placement(page)).toHaveAttribute('style', /width: 18.7%;/);
  const projected = await projectedCenter(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save my preview' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('liveac-room-preview.jpg');
  expect(await download.failure()).toBeNull();
  const bytes = await readFile((await download.path())!);
  expect(bytes.byteLength).toBeGreaterThan(1000);
  expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xd8]);

  // Compare the exported composite to the source photo at the actual CSS-
  // projected center: the dark unit must be painted at that projected location.
  const difference = await page.evaluate(async ({ jpeg, center }) => {
    async function readPixel(src: string) {
      const image = new Image(); image.src = src; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
      return [...context.getImageData(Math.round(center.x * 1600), Math.round(center.y * 1200), 1, 1).data];
    }
    const [composite, source] = await Promise.all([readPixel(`data:image/jpeg;base64,${jpeg}`), readPixel('/sample-room.jpg')]);
    return composite.slice(0, 3).reduce((sum, value, index) => sum + Math.abs(value - source[index]), 0);
  }, { jpeg: bytes.toString('base64'), center: projected });
  expect(difference).toBeGreaterThan(40);
  await page.locator('.room-stage').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `/tmp/liveac-wall-plane-${testInfo.project.name}.png`, fullPage: true });
});

test('redrawing can be undone or cancelled; removing a plane and replacing a photo clear it', async ({ page }) => {
  await page.goto('/');
  await markWall(page);
  const originalTransform = await page.locator('.unit-plane').getAttribute('style');
  await page.getByRole('button', { name: 'Redraw wall' }).click();
  await clickCorners(page, corners.slice(0, 2));
  await expect(page.getByText('Tap corner 3: bottom right')).toBeVisible();
  await page.getByRole('button', { name: 'Undo corner' }).click();
  await expect(page.getByText('Tap corner 2: top right')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel marking' }).click();
  await expect(page.getByText('PLANE SET', { exact: true })).toBeVisible();
  await expect(page.locator('.unit-plane')).toHaveAttribute('style', originalTransform!);
  await page.getByRole('button', { name: 'Remove plane' }).click();
  await expect(page.getByText('PLANE SET', { exact: true })).toHaveCount(0);
  await expect(page.locator('.unit-plane')).toHaveAttribute('style', 'transform: none;');
  await markWall(page);
  await page.getByLabel('Upload a room photo', { exact: true }).setInputFiles(path.resolve('public/sample-room.jpg'));
  await expect(page.getByAltText('Your uploaded room')).toBeVisible();
  await expect(page.getByText('PLANE SET', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mark wall', exact: true })).toBeVisible();
  await expect(page.locator('.unit-plane')).toHaveAttribute('style', 'transform: none;');
});

test('mocked wall detection requests consent, previews corners, and waits for explicit application', async ({ page }) => {
  let submitted: Record<string, unknown> | null = null;
  await page.route('**/api/health', route => route.fulfill({ json: { ok: true, aiConfigured: true } }));
  await page.route('**/api/detect-wall', route => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ json: { wall: { corners, confidence: 'medium', summary: 'The clear upper wall follows this perspective.', warnings: ['Review the four corners before applying.'] } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Detect wall with AI' }).click();
  await expect(page.getByRole('dialog')).toContainText('To detect a wall, we’ll send this room photo');
  expect(submitted).toBeNull();
  await expect(page.locator('.unit-plane')).toHaveAttribute('style', 'transform: none;');
  await page.getByRole('button', { name: 'Analyze my photo' }).click();
  await expect(page.getByText('The clear upper wall follows this perspective.')).toBeVisible();
  expect(submitted).not.toBeNull();
  expect(submitted!['image']).toMatch(/^data:image\/jpeg;base64,/);
  expect(submitted!['imageWidth']).toBe(1600);
  expect(submitted!['imageHeight']).toBe(1200);
  await expect(page.locator('.wall-marker')).toHaveCount(4);
  await expect(page.locator('.unit-plane')).toHaveAttribute('style', 'transform: none;');
  await page.getByRole('button', { name: 'Use detected wall' }).click();
  await expect(page.getByText('PLANE SET', { exact: true })).toBeVisible();
  await expect(page.getByLabel('3D unit depth')).toBeChecked();
  await expect(page.locator('.unit-depth-scene')).toBeVisible();
  await expect(page.locator('.unit-plane')).toHaveAttribute('style', 'transform: none;');
  await expect(page.locator('button.wall-corner')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Use detected wall' })).toHaveCount(0);
});

test('without an AI key the wall detector sends nothing and manual marking still works', async ({ page }) => {
  await page.route('**/api/health', route => route.fulfill({json:{ok:true,aiConfigured:false}}));
  let requests = 0;
  page.on('request', request => { if (request.url().endsWith('/api/detect-wall')) requests += 1; });
  await page.goto('/');
  await expect(page.getByText('AI connection needs setup')).toBeVisible();
  await page.getByRole('button', { name: 'Detect wall with AI' }).click();
  await expect(page.getByRole('alert')).toContainText('Your photo has not been sent.');
  expect(requests).toBe(0);
  await page.getByLabel('Dismiss error').click();
  await markWall(page);
});
