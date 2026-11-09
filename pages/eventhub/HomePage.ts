import { Page, Locator } from '@playwright/test';

/** Page object for the EventHub home page, where login lands. */
export class HomePage {
  readonly page: Page;
  readonly browseEventsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.browseEventsLink = page.getByRole('link', { name: 'Browse Events →' });
  }
}
