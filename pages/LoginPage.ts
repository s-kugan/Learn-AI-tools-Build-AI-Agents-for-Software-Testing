import { Page, Locator } from '@playwright/test';

/**
 * Page object for the Login Page Practise page.
 * https://rahulshettyacademy.com/loginpagePractise/
 */
export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly termsCheckbox: Locator;
  readonly signInButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('#username');
    this.passwordInput = page.locator('#password');
    this.termsCheckbox = page.locator('#terms');
    this.signInButton = page.locator('#signInBtn');
  }

  async goto() {
    await this.page.goto('/loginpagePractise/');
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.termsCheckbox.check();
    await this.signInButton.click();
  }
}
