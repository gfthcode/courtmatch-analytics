import { expect, test } from '@playwright/test';

test.describe('CourtMatch side drawer', () => {
  test('opens, highlights the current route, and closes with Escape', async ({ page }) => {
    await page.goto('methodology/');
    await page.getByRole('button', { name: '打开导航' }).click();
    const drawer = page.getByRole('dialog', { name: 'CourtMatch 主导航' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('link', { name: /方法论/ })).toHaveAttribute('aria-current', 'page');
    await drawer.getByRole('button', { name: '关闭导航' }).press('Escape');
    await expect(drawer).toBeHidden();
  });

  test('navigates to the player directory and closes automatically', async ({ page }) => {
    await page.goto('methodology/');
    await page.getByRole('button', { name: '打开导航' }).click();
    await page.getByRole('dialog', { name: 'CourtMatch 主导航' }).getByRole('link', { name: /球员数据/ }).click();
    await expect(page).toHaveURL(/\/players\/?$/);
    await expect(page.getByRole('heading', { name: '球员数据' })).toBeVisible();
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});
