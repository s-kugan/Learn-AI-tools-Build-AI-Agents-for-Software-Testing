import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ShopPage } from '../pages/ShopPage';

const USERNAME = 'rahulshettyacademy';
const PASSWORD = 'Learning@830$3mK2';

test.describe('Login Page Practise', () => {
  test('should log in and show iphone X product on the shop page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const shopPage = new ShopPage(page);

    await loginPage.goto();
    await loginPage.login(USERNAME, PASSWORD);

    await expect(page).toHaveURL('/angularpractice/shop');
    await expect(shopPage.getProductByName('iphone X')).toBeVisible();
  });
});
