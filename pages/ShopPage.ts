import { Page, Locator } from '@playwright/test';

/**
 * Page object for the Angular Practice shop page.
 * https://rahulshettyacademy.com/angularpractice/shop
 */
export class ShopPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Returns a locator for a product card title matching the given exact name.
   */
  getProductByName(productName: string): Locator {
    return this.page.getByRole('link', { name: productName, exact: true });
  }
}
