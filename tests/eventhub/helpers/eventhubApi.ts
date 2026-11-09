import { expect, APIRequestContext } from '@playwright/test';
import { faker } from '@faker-js/faker';
import moment from 'moment';

export const API_URL = 'https://api.eventhub.rahulshettyacademy.com/api';

export type User = { email: string; password: string; headers: { Authorization: string } };

export type EventData = {
  id: number;
  title: string;
  category: string;
  venue: string;
  city: string;
  eventDate: string;
  price: string;
  totalSeats: number;
};

export type BookingData = {
  id: number;
  bookingRef: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  quantity: number;
};

/** Clear all and cancel remove the account's bookings, so each test gets its own user. */
export async function registerUser(request: APIRequestContext): Promise<User> {
  // Accounts are never deleted, so the address must not depend on a limited pool of names.
  const email = `e2e.${faker.string.uuid()}@example.com`;
  const password = faker.internet.password({ length: 12 });
  const response = await request.post(`${API_URL}/auth/register`, { data: { email, password } });
  expect(response.status()).toBe(201);
  const { token } = await response.json();
  return { email, password, headers: { Authorization: `Bearer ${token}` } };
}

/** Uses a test-owned event, never a static one (see test data rules in docs/test-scenarios.md). */
export async function createEvent(request: APIRequestContext, user: User): Promise<EventData> {
  const response = await request.post(`${API_URL}/events`, {
    headers: user.headers,
    data: {
      title: `E2E ${faker.string.alphanumeric(10)}`,
      category: 'Conference',
      venue: faker.location.street(),
      city: 'Mumbai',
      eventDate: moment().add(7, 'days').toISOString(),
      // A whole-dollar price under $1,000 total, so the formatted price has no rounding or commas.
      price: faker.number.int({ min: 100, max: 300 }),
      totalSeats: 50,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).data;
}

export async function createBooking(
  request: APIRequestContext,
  user: User,
  eventId: number,
  quantity: number,
): Promise<BookingData> {
  const response = await request.post(`${API_URL}/bookings`, {
    headers: user.headers,
    data: {
      eventId,
      customerName: faker.person.fullName(),
      customerEmail: faker.internet.email({ provider: 'example.com' }).toLowerCase(),
      customerPhone: faker.string.numeric(10),
      quantity,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).data;
}

export async function getBooking(request: APIRequestContext, user: User, bookingId: number): Promise<BookingData> {
  const response = await request.get(`${API_URL}/bookings/${bookingId}`, { headers: user.headers });
  expect(response.status()).toBe(200);
  return (await response.json()).data;
}

export async function getAvailableSeats(request: APIRequestContext, user: User, eventId: number): Promise<number> {
  const response = await request.get(`${API_URL}/events/${eventId}`, { headers: user.headers });
  expect(response.status()).toBe(200);
  return (await response.json()).data.availableSeats;
}
