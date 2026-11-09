import { Page, Locator } from '@playwright/test';

/** Page object for the EventHub "My Bookings" list. */
export class BookingsPage {
  readonly page: Page;
  readonly bookingCards: Locator;
  readonly clearAllButton: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.bookingCards = page.getByTestId('booking-card');
    this.clearAllButton = page.getByRole('button', { name: 'Clear all bookings' });
    this.emptyState = page.getByRole('heading', { name: 'No bookings yet' });
  }

  async goto() {
    await this.page.goto('/bookings');
  }

  cardByRef(bookingRef: string): Locator {
    return this.bookingCards.filter({
      has: this.page.locator('.booking-ref', { hasText: bookingRef }),
    });
  }

  async openDetails(bookingRef: string) {
    await this.cardByRef(bookingRef).getByRole('link', { name: 'View Details' }).click();
  }

  /** Clicks Clear all, accepts the native browser dialog, and returns its message. */
  async clearAll(): Promise<string> {
    let message = '';
    this.page.once('dialog', async (dialog) => {
      message = dialog.message();
      await dialog.accept();
    });
    await this.clearAllButton.click();
    return message;
  }
}
