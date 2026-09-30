import { expect, test } from '@playwright/test';
import { calculateExpression } from '../src/financial/calculateExpression';
import { phoneError } from '../src/phone';
import { login } from './auth-helpers';

test('calculator handles exact decimals, precedence, percentages and invalid operations', () => {
  for (const [input, result] of [
    ['0.1+0.2', '0.3'],
    ['1000−200×2', '600'],
    ['500×10%', '50'],
    ['1÷3', '0.33333333'],
    ['-10+5', '-5'],
    ['10÷-2', '-5'],
  ])
    expect(calculateExpression(input)).toBe(result);
  for (const input of ['5/0', '1+', 'alert(1)', '1..2'])
    expect(() => calculateExpression(input)).toThrow();
});

test('phone validation respects country lengths and numbering patterns', () => {
  expect(phoneError('+919876543210')).toBe('');
  expect(phoneError('+91987654321')).toContain('10 digits');
  expect(phoneError('+9198765432101')).toContain('10 digits');
  expect(phoneError('+911234567890')).toContain('valid mobile');
  expect(phoneError('+447911123456', 'GB')).toBe('');
  expect(phoneError('+14155552671', 'US')).toBe('');
  expect(phoneError('+1415555267', 'US')).not.toBe('');
});

test('required fields focus, correction sheet, blank optional transfers and calculator', async ({
  page,
}, info) => {
  await login(page, 'Owner', '+9198' + String(Date.now()).slice(-8));
  await page.getByRole('button', { name: 'Create shop', exact: true }).click();
  await expect(page.getByLabel('Shop name', { exact: true })).toBeFocused();
  await page.getByLabel('Shop name', { exact: true }).fill('Usability shop');
  await page.getByRole('button', { name: 'Create shop', exact: true }).click();
  await page.getByLabel('Hishob tab', { exact: true }).click();
  await page.getByRole('button', { name: 'Calculator', exact: true }).click();
  await page.getByLabel('Calculation', { exact: true }).fill('0.1+0.2');
  await page.getByRole('button', { name: 'Calculate result', exact: true }).click();
  await expect(page.getByLabel('Calculator result', { exact: true })).toHaveText('0.3');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy result', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('0.3');
  await page.setViewportSize({ width: 320, height: 740 });
  await page.screenshot({ path: info.outputPath('calculator-mobile.png'), fullPage: true });
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  for (const size of [
    { width: 740, height: 320 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.getByRole('button', { name: 'Calculator', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Close calculator', exact: true }),
    ).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeInViewport();
    await page.getByRole('button', { name: 'Close calculator', exact: true }).click();
  }
  await page.getByLabel('Opening cash', { exact: true }).fill('1000');
  await page.getByRole('button', { name: 'Start today’s Hishob', exact: true }).click();
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click();
  await page.getByRole('button', { name: 'Save transaction', exact: true }).click();
  await expect(page.getByLabel('Amount (₹)', { exact: true })).toBeFocused();
  await page.getByLabel('Amount (₹)', { exact: true }).fill('200');
  await page.getByLabel('Description', { exact: true }).fill('Test cash sale');
  await page.getByRole('button', { name: 'Save transaction', exact: true }).click();
  await page.getByRole('button', { name: /View transactions/ }).click();
  await page.getByRole('button', { name: 'Delete · Test cash sale', exact: true }).click();
  await expect(page.getByLabel('Deletion reason', { exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
  await expect(page.getByLabel('Deletion reason', { exact: true })).toBeFocused();
  await page.getByLabel('Deletion reason', { exact: true }).fill('Duplicate test entry');
  await page.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
  await page
    .getByRole('button', { name: /back/i })
    .or(page.getByRole('link', { name: /back/i }))
    .click();
  await page.getByRole('button', { name: 'Close day', exact: true }).click();
  await expect(page.getByLabel('Cash removed for bank at closing', { exact: true })).toHaveValue(
    '',
  );
  await expect(page.getByLabel('Cash taken home at closing', { exact: true })).toHaveValue('');
  await page.getByLabel('Actual cash in galla', { exact: true }).fill('1000');
  await page.getByRole('button', { name: 'Close today’s Hishob', exact: true }).click();
  await expect(page.getByText('Cash kept in galla · ₹1,000', { exact: true })).toBeVisible();
});

test('login waits for interaction before showing phone errors', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue as Owner', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText(/national digits/)).toHaveCount(0);
  await page.getByLabel('Mobile number', { exact: true }).fill('98765');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByLabel('Mobile number', { exact: true })).toBeFocused();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await page.getByLabel('Mobile number', { exact: true }).fill('9876543210');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
