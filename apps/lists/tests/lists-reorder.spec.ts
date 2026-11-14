import { expect, type Locator, type Page, test } from '@playwright/test';

// Real pointer and touch input: the drag library's placeholder row only exists in a
// real drag, which the component tests' synthetic drop events skip.

function watchForRenderErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('each_key_duplicate')) errors.push(message.text());
  });
  return errors;
}

async function centre(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Drag handle is not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Steps from the second handle to just above the first, as a person would drag. */
function path(from: { x: number; y: number }, to: { x: number; y: number }) {
  return Array.from({ length: 15 }, (_, index) => ({
    x: from.x,
    y: from.y - ((from.y - to.y + 20) * (index + 1)) / 15
  }));
}

test('on desktop, a list dragged by its handle moves above the list it is dropped on', async ({ page }) => {
  const errors = watchForRenderErrors(page);
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/l/weekly-shop/weekly-shop');
  const sidebar = page.locator('aside');
  const openButtons = sidebar.getByRole('button', { name: /^Open .* list$/ });
  await expect(openButtons).toHaveCount(2);
  const [first, second] = await openButtons.allTextContents();

  const handles = sidebar.getByRole('button', { name: /^Drag to reorder / });
  const from = await centre(handles.nth(1));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (const point of path(from, await centre(handles.nth(0)))) await page.mouse.move(point.x, point.y);
  await page.mouse.up();

  await expect(openButtons).toHaveText([second!, first!]);
  expect(errors).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('a list dragged by touch in the list switcher moves above the other', async ({ page }) => {
    const errors = watchForRenderErrors(page);
    await page.goto('/l/weekly-shop/weekly-shop');
    await page.getByRole('button', { name: 'Weekly shop' }).first().tap();
    const sheet = page
      .locator('section')
      .filter({ has: page.getByRole('button', { name: 'Close list switcher' }) })
      .last();
    const openButtons = sheet.getByRole('button', { name: /^Open .* list$/ });
    await expect(openButtons).toHaveCount(2);
    const [first, second] = await openButtons.allTextContents();
    await sheet.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));

    const handles = sheet.getByRole('button', { name: /^Drag to reorder / });
    const from = await centre(handles.nth(1));
    const touch = await page.context().newCDPSession(page);
    const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', point?: { x: number; y: number }) =>
      touch.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [point] : [] });
    await send('touchStart', from);
    for (const point of path(from, await centre(handles.nth(0)))) {
      await send('touchMove', point);
      await page.waitForTimeout(16);
    }
    await send('touchEnd');

    await expect(openButtons).toHaveText([second!, first!]);
    expect(errors).toEqual([]);
  });
});
