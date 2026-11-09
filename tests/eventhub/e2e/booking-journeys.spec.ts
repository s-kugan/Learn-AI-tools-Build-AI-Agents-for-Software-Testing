import { test, expect, Page } from '@playwright/test';
import moment from 'moment';
import { EventHubLoginPage } from '../../../pages/eventhub/EventHubLoginPage';
import { HomePage } from '../../../pages/eventhub/HomePage';
import { BookingsPage } from '../../../pages/eventhub/BookingsPage';
import { BookingDetailPage } from '../../../pages/eventhub/BookingDetailPage';
import {
  API_URL,
  User,
  registerUser,
  createEvent,
  createBooking,
  getBooking,
  getAvailableSeats,
} from '../helpers/eventhubApi';

const BASE_URL = 'https://eventhub.rahulshettyacademy.com';

// The root config targets a different site.
test.use({ baseURL: BASE_URL });

async function logIn(page: Page, user: User) {
  const loginPage = new EventHubLoginPage(page);
  await loginPage.goto();
  await loginPage.login(user.email, user.password);
  await expect(new HomePage(page).browseEventsLink).toBeVisible();
}

test.describe('Booking management journeys', () => {
  // Browser start, slow page loads on the deployed site, and API setup can use up the default 30s.
  test.describe.configure({ timeout: 60_000 });

  test('TC-002: View Details opens the booking with all its details', async ({ page, request }) => {
    // -- Step 1: Set up a user with one booking --
    const user = await registerUser(request);
    const event = await createEvent(request, user);
    const booking = await createBooking(request, user, event.id, 2);

    // -- Step 2: Open the booking from the list --
    await logIn(page, user);
    const bookingsPage = new BookingsPage(page);
    await bookingsPage.goto();
    await bookingsPage.openDetails(booking.bookingRef);

    // -- Step 3: Verify the detail page --
    const detailPage = new BookingDetailPage(page);
    await expect(page).toHaveURL(`/bookings/${booking.id}`);
    await expect(detailPage.bookingRef).toHaveText(booking.bookingRef);
    await expect(detailPage.eventTitle).toHaveText(event.title);

    await expect(detailPage.field('Event')).toContainText(event.title);
    await expect(detailPage.field('Category')).toContainText(event.category);
    await expect(detailPage.field('Date')).toContainText(moment(event.eventDate).format('dddd, D MMMM YYYY'));
    await expect(detailPage.field('Venue')).toContainText(event.venue);
    await expect(detailPage.field('City')).toContainText(event.city);

    await expect(detailPage.field('Name')).toContainText(booking.customerName);
    await expect(detailPage.field('Email')).toContainText(booking.customerEmail);
    await expect(detailPage.field('Phone')).toContainText(booking.customerPhone);

    // Match the whole row, because a substring would also accept 12 tickets or $4000.
    await expect(detailPage.field('Tickets')).toHaveText(/^Tickets\s*2$/);
    await expect(detailPage.field('Price per ticket')).toHaveText(new RegExp(`^Price per ticket\\s*\\$${event.price}$`));
    await expect(detailPage.totalPaid).toHaveText(new RegExp(`^Total Paid\\s*\\$${Number(event.price) * 2}$`));
  });

  test('TC-004: Cancelling from the detail page removes only that booking and restores seats', async ({ page, request }) => {
    // -- Step 1: Set up a user with two bookings on different events --
    const user = await registerUser(request);
    const event = await createEvent(request, user);
    const otherEvent = await createEvent(request, user);
    const booking = await createBooking(request, user, event.id, 2);
    const otherBooking = await createBooking(request, user, otherEvent.id, 1);

    const seatsBeforeCancel = await getAvailableSeats(request, user, event.id);
    expect(seatsBeforeCancel).toBe(event.totalSeats - 2);
    const otherBookingBefore = await getBooking(request, user, otherBooking.id);

    // -- Step 2: Cancel from the detail page --
    await logIn(page, user);
    const detailPage = new BookingDetailPage(page);
    await detailPage.goto(booking.id);
    await detailPage.cancelBooking();

    // -- Step 3: Verify the toast, redirect, and remaining list --
    await expect(page.getByText('Booking cancelled successfully')).toBeVisible();
    await expect(page).toHaveURL('/bookings');
    const bookingsPage = new BookingsPage(page);
    await expect(bookingsPage.bookingCards).toHaveCount(1);
    await expect(bookingsPage.cardByRef(otherBooking.bookingRef)).toBeVisible();

    // -- Step 4: Verify the backend state --
    const cancelled = await request.get(`${API_URL}/bookings/${booking.id}`, { headers: user.headers });
    expect(cancelled.status()).toBe(404);
    expect(await getBooking(request, user, otherBooking.id)).toEqual(otherBookingBefore);
    expect(await getAvailableSeats(request, user, event.id)).toBe(seatsBeforeCancel + 2);
  });

  test('TC-005: Clear all removes every booking in one action', async ({ page, request }) => {
    // -- Step 1: Set up a user with three bookings on different events --
    const user = await registerUser(request);
    for (let i = 0; i < 3; i++) {
      const event = await createEvent(request, user);
      await createBooking(request, user, event.id, 1);
    }

    // -- Step 2: Clear all from the list page --
    await logIn(page, user);
    const bookingsPage = new BookingsPage(page);
    await bookingsPage.goto();
    await expect(bookingsPage.bookingCards).toHaveCount(3);
    const dialogMessage = await bookingsPage.clearAll();

    // -- Step 3: Verify the list and the backend --
    expect(dialogMessage).toBe('Clear all your bookings? This cannot be undone.');
    await expect(bookingsPage.emptyState).toBeVisible();
    await expect(bookingsPage.bookingCards).toHaveCount(0);

    const response = await request.get(`${API_URL}/bookings`, { headers: user.headers });
    expect(response.status()).toBe(200);
    expect((await response.json()).data).toEqual([]);
  });
});
