import { spawnSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { networkInterfaces } from 'node:os';
import process from 'node:process';

import { expect, test } from '@playwright/test';

const patternRoute = '/patterns/list-overview-and-access.html';

test('guide routes expose proposed guidance and keyboard search reaches recovery advice', async ({ page, request }) => {
  for (const route of ['/', '/patterns/', '/foundations.html', '/contributing.html', patternRoute]) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(200);
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'Search', exact: true }).focus();
  await page.keyboard.press('Enter');
  const search = page.getByRole('searchbox');
  await expect(search).toBeFocused();
  await search.fill('unavailable');
  const destination = page.locator(`a[href="${patternRoute}#access-failure-and-recovery"]`);
  await expect(destination).toBeVisible();
  // Keyboard through the actual results; ranking is not a behavioural promise.
  for (let attempts = 0; attempts < 20; attempts++) {
    const activeId = await search.getAttribute('aria-activedescendant');
    if (activeId && (await destination.evaluate((element, id) => element.closest(`#${id}`) !== null, activeId))) break;
    await page.keyboard.press('ArrowDown');
  }
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`${patternRoute}#access-failure-and-recovery`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('List overview and access');
  const main = page.getByRole('main');
  await expect(main).toContainText('proposed');
  await expect(main).toContainText('This list is unavailable.');
  await expect(main).toContainText('List unavailable.');
  await expect(main).toContainText('transient refresh failure');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(search).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(search).toHaveCount(0);
});

test('preview refuses an occupied port and does not accept non-loopback connections', async () => {
  const duplicate = spawnSync(process.execPath, ['scripts/preview.mjs', '3407'], { encoding: 'utf8', timeout: 10_000 });
  expect(duplicate.error).toBeUndefined();
  expect(duplicate.status).not.toBe(0);
  expect(duplicate.stderr).toContain('Port 3407 is already in use');
  const addresses = Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => !entry.internal && entry.family === 'IPv4');
  expect(addresses.length, 'A non-loopback IPv4 interface is required to verify the binding').toBeGreaterThan(0);
  for (const { address } of addresses) {
    const connected = await new Promise<boolean>((resolve) => {
      const socket = createConnection({ host: address, port: 3407 });
      const finish = (open: boolean) => {
        socket.destroy();
        resolve(open);
      };
      socket.once('connect', () => finish(true));
      socket.once('error', () => finish(false));
      socket.setTimeout(1000, () => finish(false));
    });
    expect(connected, 'Preview accepted a non-loopback connection').toBe(false);
  }
});
