import { Page, Locator } from '@playwright/test';

/** Page object for the EventHub booking detail page. */
export class BookingDetailPage {
  readonly page: Page;
  readonly bookingRef: Locator;
  readonly eventTitle: Locator;
  readonly totalPaid: Locator;
  readonly cancelButton: Locator;
  readonly confirmCancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.bookingRef = page.locator('span.font-mono.font-bold');
    this.eventTitle = page.locator('h1');
    this.totalPaid = this.field('Total Paid');
    this.cancelButton = page.getByRole('button', { name: 'Cancel Booking' });
    this.confirmCancelButton = page.getByTestId('confirm-dialog-yes');
  }

  async goto(bookingId: number) {
    await this.page.goto(`/bookings/${bookingId}`);
  }

  /**
   * The label/value row for a field such as "Name" or "Venue".
   * The rows have no test IDs, so this finds the label and takes its parent.
   */
  field(label: string): Locator {
    return this.page.getByText(label, { exact: true }).locator('..');
  }

  async cancelBooking() {
    await this.cancelButton.click();
    await this.confirmCancelButton.click();
  }
}
