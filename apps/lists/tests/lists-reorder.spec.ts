import { expect, type Page, test } from '@playwright/test';

const openButtons = (page: Page) => page.getByRole('button', { name: /^Open .* list$/ });

// Real pointer events: the drag library's placeholder row only exists in a real drag,
// which the component tests' synthetic drop events skip.
test('a list dragged by its handle moves above the list it is dropped on', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('each_key_duplicate')) errors.push(message.text());
  });

  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/l/weekly-shop/weekly-shop');
  await expect(openButtons(page)).toHaveCount(2);
  const [first, second] = await openButtons(page).allTextContents();

  const moved = await page
    .getByRole('button', { name: /^Drag to reorder / })
    .nth(1)
    .boundingBox();
  const target = await page
    .getByRole('button', { name: /^Drag to reorder / })
    .nth(0)
    .boundingBox();
  if (!moved || !target) throw new Error('Drag handles are not visible');
  const x = moved.x + moved.width / 2;
  await page.mouse.move(x, moved.y + moved.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 15; step++) {
    await page.mouse.move(x, moved.y + moved.height / 2 - ((moved.y - target.y + 20) * step) / 15);
  }
  await page.mouse.up();

  await expect(openButtons(page)).toHaveText([second!, first!]);
  expect(errors).toEqual([]);
});
