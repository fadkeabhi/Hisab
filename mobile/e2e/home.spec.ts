import { expect, test } from '@playwright/test';
import { login } from './auth-helpers';

test('home shows daily progress, fits four clear tabs and recovers attendance errors', async ({
  page,
}, info) => {
  const suffix = String(Date.now()).slice(-8);
  await login(page, 'Owner', '+9195' + suffix);
  await page.getByLabel('Shop name', { exact: true }).fill('Market Road Store');
  const created = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/shops'),
  );
  await page.getByRole('button', { name: 'Create shop', exact: true }).click();
  const response = await created;
  const shop = await response.json();
  const endpoint = `${response.url()}/${shop.id}`;
  const headers = { Origin: new URL(page.url()).origin, 'X-Hishob-Client': 'web' };
  await expect(page.getByText('Hello, Prajwal', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Add your team to start recording attendance.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(4);
  await expect(page.getByLabel('Account tab', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open account', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('home-empty.png') });
  const staff: string[] = [];
  for (const [name, prefix] of [
    ['Asha', '+9194'],
    ['Ravi', '+9193'],
  ]) {
    const added = await page.request.post(`${endpoint}/workers`, {
      headers,
      data: { name, mobile: prefix + suffix },
    });
    expect(added.ok()).toBeTruthy();
    staff.push((await added.json()).id);
  }
  const today = await (await page.request.get(`${endpoint}/attendance/today`)).json();
  const mark = async (workerId: string, status: string) => {
    const saved = await page.request.put(`${endpoint}/workers/${workerId}/attendance`, {
      headers,
      data: { date: today.date, status, note: 'Home overview test' },
    });
    expect(saved.ok()).toBeTruthy();
  };
  const refreshHome = async () => {
    await page.getByLabel('Team tab', { exact: true }).click();
    await page.getByLabel('Home tab', { exact: true }).click();
  };
  await mark(staff[0], 'PRESENT');
  await refreshHome();
  const progress = page.getByRole('progressbar', { name: 'Attendance recorded', exact: true });
  await expect(progress).toHaveAttribute('aria-valuenow', '1');
  await expect(progress).toHaveAttribute('aria-valuemax', '2');
  await expect(
    page.getByText('1 person still needs attendance recorded.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open attendance', exact: true })).toContainText(
    'Mark attendance',
  );
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const label of ['Home', 'Attendance', 'Cashbook', 'Team']) {
      const tab = page.getByLabel(`${label} tab`, { exact: true });
      await expect(tab).toBeInViewport();
      const bounds = await tab.getByText(label, { exact: true }).boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    }
    await expect(
      page.getByRole('button', { name: 'Open attendance', exact: true }),
    ).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`home-${viewport.width}.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await mark(staff[1], 'LEAVE');
  await refreshHome();
  await expect(progress).toHaveAttribute('aria-valuenow', '2');
  await expect(
    page.getByText('Everyone’s attendance is recorded for today.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open attendance', exact: true })).toContainText(
    'View attendance',
  );
  const todayRoute = '**/shops/*/attendance/today';
  await page.route(todayRoute, (route) =>
    route.fulfill({ status: 503, json: { detail: 'Attendance temporarily unavailable' } }),
  );
  await refreshHome();
  await expect(
    page.getByText('Couldn’t refresh. Counts show the last loaded attendance.', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('Attendance is unavailable right now.', { exact: true }),
  ).toBeVisible();
  await expect(progress).toHaveCount(0);
  await expect(
    page.getByText('Everyone’s attendance is recorded for today.', { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('home-error.png') });
  await page.unroute(todayRoute);
  await page.getByRole('button', { name: 'Retry attendance', exact: true }).click();
  await expect(progress).toHaveAttribute('aria-valuenow', '2');
  await page.getByRole('button', { name: 'Open account', exact: true }).click();
  await expect(page.getByText('Your account', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(4);
  await page.getByLabel('Home tab', { exact: true }).click();
  await expect(page.getByText('Hello, Prajwal', { exact: true })).toBeVisible();
});
