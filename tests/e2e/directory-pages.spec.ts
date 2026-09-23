import { expect, test } from '@playwright/test';

test('player and team directories expose real routes', async ({ page }) => {
  await page.goto('players/');
  await expect(page.getByRole('heading', { name: '球员数据' })).toBeVisible();
  await page.getByRole('link', { name: /Stephen Curry|斯蒂芬/ }).first().click();
  await expect(page).toHaveURL(/\/players\/[^/]+\/?$/);
  await page.goto('teams/');
  await expect(page.getByRole('heading', { name: '球队数据' })).toBeVisible();
  await page.getByRole('link', { name: /查看球队详情/ }).first().click();
  await expect(page).toHaveURL(/\/teams\/[^/]+\/?$/);
});
