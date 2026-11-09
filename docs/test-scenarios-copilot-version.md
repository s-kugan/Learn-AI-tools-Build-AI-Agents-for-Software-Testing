# EventHub Test Scenarios: Booking Management (Copilot version)

Independent scenario set for the booking management feature. It sits next to [test-scenarios.md](./test-scenarios.md), which is unchanged.

## Scope

**In scope:** list, detail, reference lookup, cancel, clear all, refund eligibility, FIFO pruning, seat accounting, ownership and auth for `/api/bookings*` and the `/bookings` and `/bookings/:id` pages.

**Out of scope:** the booking form and its field validation (Flow 3). Bookings are created as setup, except where creation triggers a management rule (FIFO pruning, seat checks).

## Sources

| Label | Source |
|---|---|
| BR §n | `eventhub-domain` business rules |
| Flow n | `eventhub-domain` user flows |
| API Ref | `eventhub-domain` API reference |
| Code | `backend/src/...` and `frontend/...` behaviour found by reading the source |

Expected results come from the documents and the local source, not from a live run. Where the code contradicts a documented rule, the scenario states the documented rule and carries a **Known issue** line. A failure there is an app defect.

## Code findings that drive scenarios

| ID | Finding | Where | Scenarios |
|---|---|---|---|
| F-1 | At 9 bookings, the oldest is deleted **before** the event and seat checks. A failed create (unknown event, too few seats) still loses a booking. | `bookingService.createBooking` | TC-300, TC-301 |
| F-2 | When every booking is on the same event, the oldest booking is deleted and a seat is permanently removed from `event.availableSeats` (`decrementSeats`). On a static event this affects all users. | `bookingService.createBooking` | TC-105, TC-106 |
| F-3 | Cancelling another user's booking returns 404, not 403, because `cancelBooking` looks up with `userId`. Reading returns 403. | `bookingService.cancelBooking` / `getBookingById` | TC-201 |
| F-4 | Ids and query values go through `Number()`. `abc` becomes `NaN`, which Prisma rejects. The error handler turns unknown errors into 500. | `bookingRepository` | TC-306, TC-310 |
| F-5 | The bookings page requests `limit: 10`, but a user can hold at most 9 bookings, so the page never paginates. | `frontend/app/bookings/page.tsx` | TC-402, TC-501 |
| F-6 | Prune, seat check and create are separate non-transactional calls. | `bookingService.createBooking` | TC-404 |
| F-7 | "Clear all" refetches only the current bookings query. It doesn't invalidate `events` or `booking` caches, and has no error handling. | `bookings/page.tsx`, `useBookings.ts` | TC-308, TC-311, TC-506 |
| F-8 | Cards and detail format prices with `maximumFractionDigits: 0`, so decimal prices are rounded in the UI. | `BookingCard.jsx`, `bookings/[id]/page.tsx` | TC-406 |
| F-9 | Auth middleware accepts only the exact `Bearer ` prefix. Tokens remain valid after the user is deleted. | `authMiddleware.js` | TC-206, TC-313 |
| F-10 | `status` is always `confirmed`, but the list accepts a `status` filter. | `bookingRepository.findAll` | TC-310 |

## Test data rules

- **Use a freshly registered user per test.** FIFO pruning and "Clear all" destroy bookings, so don't use the shared accounts.
- **Never overflow on a static event on the deployed site** (F-2). Create a dynamic event first, with enough seats, and use that for any test that goes past 9 bookings.
- **Create bookings sequentially** when order matters, because pruning uses `createdAt`.
- **Static events:** seeded in the data set, shared by all users. Don't change them.
- **Cross-user tests** need two registered users, A and B.
- **Don't log credentials** from the personal notes file into reports.

## Coverage summary

| Category | IDs | Count |
|---|---|---|
| Happy Path | TC-001 to TC-009 | 9 |
| Business Rule | TC-100 to TC-114 | 15 |
| Security | TC-200 to TC-213 | 14 |
| Negative | TC-300 to TC-313 | 14 |
| Edge Case | TC-400 to TC-411 | 12 |
| UI State | TC-500 to TC-511 | 12 |
| **Total** | | **76** |

---

## Happy Path

### TC-001: List shows my bookings newest first
**Category**: Happy Path
**Priority**: P0
**Preconditions**: Fresh user with 3 bookings on 3 different events, created one at a time.
**Steps**:
1. Open `/bookings`.
2. Read the order of the cards.
**Expected Results**: 3 cards, newest booking first. Each card shows the booking reference, a `confirmed` badge, `#id`, the event title, date, ticket count, city, booked date and total price.
**Business Rule**: Flow 4 step 2. `findAll` orders by `createdAt desc`.
**Suggested Layer**: E2E

### TC-002: Open booking details from a card
**Category**: Happy Path
**Priority**: P0
**Preconditions**: Fresh user with one booking.
**Steps**:
1. Open `/bookings`.
2. Click **View Details**.
**Expected Results**: URL is `/bookings/:id`. The page shows the reference, a `confirmed` badge, the event title as `h1`, and the Event Details, Customer Details, Payment Summary and Booking Information sections. Values match the data used to create the booking.
**Business Rule**: Flow 4 steps 3-4
**Suggested Layer**: E2E

### TC-003: Get a booking by id through the API
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User A has a booking.
**Steps**:
1. `GET /api/bookings/:id` with A's token.
**Expected Results**: 200 and `{ success: true, data }`. `data` includes the booking fields and the embedded `event`.
**Business Rule**: API Ref, Bookings
**Suggested Layer**: API

### TC-004: Get a booking by reference through the API
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User A has a booking with a known `bookingRef`.
**Steps**:
1. `GET /api/bookings/ref/:ref` with A's token.
**Expected Results**: 200 and the same booking as `GET /api/bookings/:id`.
**Business Rule**: API Ref, Bookings
**Suggested Layer**: API

### TC-005: List bookings through the API with pagination data
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User A has 3 bookings.
**Steps**:
1. `GET /api/bookings`.
**Expected Results**: 200. `data` has 3 items. `pagination` is `{ total: 3, page: 1, limit: 10, totalPages: 1 }`.
**Business Rule**: Code: `bookingService.getBookings` defaults (page 1, limit 10)
**Suggested Layer**: API

### TC-006: Cancel a booking from the card
**Category**: Happy Path
**Priority**: P0
**Preconditions**: Fresh user with 2 bookings.
**Steps**:
1. Open `/bookings`.
2. Click **Cancel Booking** on one card.
3. Check the dialog text, then click **Yes, cancel it**.
**Expected Results**: The dialog title is "Cancel this booking?" and its text names the booking reference and seat count. After confirming, the toast "Booking cancelled successfully" appears and the card disappears. One card remains.
**Business Rule**: BR §4 (cancellation)
**Suggested Layer**: E2E

### TC-007: Cancel a booking from the detail page
**Category**: Happy Path
**Priority**: P0
**Preconditions**: Fresh user with one booking.
**Steps**:
1. Open `/bookings/:id`.
2. Click **Cancel Booking**, then **Yes, cancel it**.
**Expected Results**: Toast "Booking cancelled successfully" and redirect to `/bookings`, which shows the empty state.
**Business Rule**: Flow 4 step 6
**Suggested Layer**: E2E

### TC-008: Clear all bookings
**Category**: Happy Path
**Priority**: P0
**Preconditions**: Fresh user with 3 bookings.
**Steps**:
1. Open `/bookings`.
2. Click **Clear all bookings** and accept the browser confirmation "Clear all your bookings? This cannot be undone."
**Expected Results**: The button shows "Clearing…" while the request runs. Afterwards the list is empty and shows "No bookings yet". `GET /api/bookings` returns `total: 0`. The API message was "3 booking(s) cleared".
**Business Rule**: BR §4, Flow 4 step 7
**Suggested Layer**: E2E

### TC-009: Check refund eligibility for a single ticket
**Category**: Happy Path
**Priority**: P1
**Preconditions**: Fresh user with a booking of quantity 1.
**Steps**:
1. Open `/bookings/:id`.
2. Click `#check-refund-btn`.
3. Wait for `#refund-result`.
**Expected Results**: `#refund-spinner` shows first, then `#refund-result` reads "Eligible for refund. Single-ticket bookings qualify for a full refund."
**Business Rule**: BR §8
**Suggested Layer**: E2E

---

## Business Rules

### TC-100: Reference format and first letter
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Fresh user and events titled "Tech Summit", "alpha fest" and "9 Lives".
**Steps**:
1. Create one booking per event.
2. Read `bookingRef` for each.
**Expected Results**: Each matches `^[A-Z0-9]-[A-Z0-9]{6}$`. The first characters are `T`, `A` (uppercased) and `9`.
**Business Rule**: BR §7
**Suggested Layer**: API

### TC-101: Total price equals ticket price times quantity
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Event priced 250, user booking quantity 4.
**Steps**:
1. Create the booking.
2. Read it through the API and the detail page.
**Expected Results**: `totalPrice` is 1000. The detail page shows "Price per ticket $250" and "Total Paid $1,000".
**Business Rule**: BR §9
**Suggested Layer**: API

### TC-102: Tenth booking removes only the oldest
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Fresh user, dynamic events E1 to E3 with plenty of seats, 9 bookings: B1 first on E1, B2-B9 spread over E2 and E3.
**Steps**:
1. Create booking B10 on E2.
2. List bookings.
**Expected Results**: `total` is 9. B1 is gone, B2 to B10 remain. `GET /api/bookings/:B1` returns 404.
**Business Rule**: BR §4
**Suggested Layer**: API

### TC-103: Pruning order across repeated overflow
**Category**: Business Rule
**Priority**: P1
**Preconditions**: As TC-102, with B1 to B9 on at least 2 events.
**Steps**:
1. Create B10, then B11, then B12 on an event other than the oldest booking's event.
**Expected Results**: B1, B2 and B3 are removed in that order. `total` stays 9.
**Business Rule**: BR §4
**Suggested Layer**: API

### TC-104: Pruning prefers a booking on a different event
**Category**: Business Rule
**Priority**: P1
**Preconditions**: Fresh user with 9 bookings. The oldest (B1) is on event X. B2 is on event Y. The rest are on X or Y.
**Steps**:
1. Create B10 on event X.
**Expected Results**: The deleted booking is the oldest booking **not** on X, which is B2. B1 survives.
**Business Rule**: Code: `findOldestUserBookingExcludingEvent`. BR §4 says "oldest", so this is a documented-rule difference.
**Suggested Layer**: API

### TC-105: Same-event overflow permanently removes a seat (dynamic event)
**Category**: Business Rule
**Priority**: P1
**Preconditions**: Fresh user, one dynamic event with 100 seats, 9 bookings of quantity 1 on it. `availableSeats` is 91.
**Steps**:
1. Create a 10th booking on the same event, quantity 1.
2. Read the event's `availableSeats`.
**Expected Results**: Bookings total 9. The oldest was removed. Documented rule: available seats are `totalSeats - sum(booked)`, so 91. **Known issue (F-2):** the code also reduces `event.availableSeats` by 1, which can make the count 90 and shrink capacity for every future booking.
**Business Rule**: BR §6
**Suggested Layer**: API

### TC-106: Same-event overflow on a static event must not be run on the deployed site
**Category**: Business Rule
**Priority**: P3
**Preconditions**: Local environment only, with seeded data.
**Steps**:
1. Create 9 bookings on one static event.
2. Create a 10th on the same event.
3. Read `availableSeats` as a different user.
**Expected Results**: The seat count for the second user must not change, because static seats are shared and per-user bookings are subtracted per user. **Known issue (F-2):** the second user's count drops by the booked quantity.
**Business Rule**: BR §2, BR §6
**Suggested Layer**: API

### TC-107: Cancelling frees seats on a dynamic event
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Dynamic event with 20 seats. User books 5.
**Steps**:
1. Read `availableSeats` (15).
2. Cancel the booking.
3. Read `availableSeats` again.
**Expected Results**: 15 before, 20 after.
**Business Rule**: BR §4, BR §6
**Suggested Layer**: API

### TC-108: Clear all frees seats across events
**Category**: Business Rule
**Priority**: P1
**Preconditions**: Two dynamic events, one booking of 3 on each.
**Steps**:
1. Clear all bookings.
2. Read both events.
**Expected Results**: Both events are back to `totalSeats`.
**Business Rule**: BR §4
**Suggested Layer**: API

### TC-109: Same event can be booked repeatedly as separate bookings
**Category**: Business Rule
**Priority**: P1
**Preconditions**: Fresh user and one dynamic event.
**Steps**:
1. Book the event twice with quantities 2 and 3.
2. List bookings and read seats.
**Expected Results**: Two bookings with different references. Seats drop by 5 in total.
**Business Rule**: BR §6
**Suggested Layer**: API

### TC-110: Group booking is not eligible for a refund
**Category**: Business Rule
**Priority**: P1
**Preconditions**: Booking with quantity 3.
**Steps**:
1. Open the detail page and click `#check-refund-btn`.
**Expected Results**: After the spinner, `#refund-result` reads "Not eligible for refund. Group bookings (3 tickets) are non-refundable."
**Business Rule**: BR §8
**Suggested Layer**: E2E

### TC-111: Refund check is frontend-only
**Category**: Business Rule
**Priority**: P2
**Preconditions**: Booking with any quantity. Network log enabled.
**Steps**:
1. Click `#check-refund-btn` and wait for the result.
2. Re-read the booking through the API.
**Expected Results**: No request is sent to the API for the check. The booking and seat counts are unchanged.
**Business Rule**: BR §8
**Suggested Layer**: E2E

### TC-112: Deleting an event removes its bookings
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User with a dynamic event and one booking on it, plus one booking on another event.
**Steps**:
1. Delete the dynamic event through `DELETE /api/events/:id`.
2. List bookings.
**Expected Results**: Only the booking on the other event remains. `GET /api/bookings/:id` for the removed one returns 404.
**Business Rule**: Data model: Booking cascade with Event
**Suggested Layer**: API

### TC-113: Creating a 7th event removes the oldest event's bookings
**Category**: Business Rule
**Priority**: P2
**Preconditions**: User with 6 events. One booking on the oldest event.
**Steps**:
1. Create a 7th event.
2. List bookings.
**Expected Results**: The booking on the oldest event is gone.
**Business Rule**: BR §3 plus cascade
**Suggested Layer**: API

### TC-114: Booking status is always confirmed
**Category**: Business Rule
**Priority**: P2
**Preconditions**: Fresh user with one booking.
**Steps**:
1. Read the booking through the API, the list and the detail page.
**Expected Results**: `status` is `confirmed` everywhere, and the success badge is shown. After cancellation the booking doesn't exist (no `cancelled` state).
**Business Rule**: Data model: Booking status
**Suggested Layer**: API

---

## Security

### TC-200: Cross-user read is denied
**Category**: Security
**Priority**: P0
**Preconditions**: User A has booking `id`. User B is registered.
**Steps**:
1. `GET /api/bookings/:id` with B's token.
**Expected Results**: 403 with `success: false` and "You are not authorized to view this booking". No booking data in the body.
**Business Rule**: BR §2
**Suggested Layer**: API

### TC-201: Cross-user cancel is denied and leaves the booking intact
**Category**: Security
**Priority**: P0
**Preconditions**: As TC-200.
**Steps**:
1. `DELETE /api/bookings/:id` with B's token.
2. Read the booking with A's token.
**Expected Results**: The request is rejected (403 documented; the code returns **404** because of F-3). The booking still exists for A. Record the status actually returned and flag a mismatch with API Ref.
**Business Rule**: BR §2
**Suggested Layer**: API

### TC-202: Cross-user reference lookup is denied
**Category**: Security
**Priority**: P0
**Preconditions**: User A booking with known reference.
**Steps**:
1. `GET /api/bookings/ref/:ref` with B's token.
**Expected Results**: 403 "You do not own this booking". No data returned.
**Business Rule**: BR §2
**Suggested Layer**: API

### TC-203: Cross-user page shows Access Denied
**Category**: Security
**Priority**: P0
**Preconditions**: User A booking id. Signed in as B.
**Steps**:
1. Open `/bookings/:idOfA`.
**Expected Results**: The page shows "Access Denied" and "You are not authorized to view this booking." No booking fields are visible. **View My Bookings** is available.
**Business Rule**: Flow 6
**Suggested Layer**: E2E

### TC-204: List and clear all are scoped to the caller
**Category**: Security
**Priority**: P0
**Preconditions**: A and B each have 2 bookings.
**Steps**:
1. List as B and check ids.
2. B clears all.
3. List as A.
**Expected Results**: B sees only B's two bookings. After B clears all, A still has 2.
**Business Rule**: BR §2
**Suggested Layer**: API

### TC-205: The booking list can't be widened with query parameters
**Category**: Security
**Priority**: P1
**Preconditions**: A and B have bookings.
**Steps**:
1. As B, call `GET /api/bookings?userId=<A>`.
2. As B, call `GET /api/bookings?eventId=<event A booked>`.
**Expected Results**: Results are B's bookings only. `userId` is ignored.
**Business Rule**: BR §2
**Suggested Layer**: API

### TC-206: All booking endpoints reject missing auth
**Category**: Security
**Priority**: P0
**Preconditions**: None.
**Steps**:
1. Without a token, call `GET /api/bookings`, `GET /api/bookings/1`, `GET /api/bookings/ref/X-AAAAAA`, `POST /api/bookings`, `DELETE /api/bookings` and `DELETE /api/bookings/1`.
2. Repeat with header `Authorization: Token abc` and `Authorization: bearer <valid token>`.
**Expected Results**: Every call returns 401 "Unauthorized". (Lower-case `bearer` is rejected by the exact-prefix check, F-9.)
**Business Rule**: API Ref error scenarios
**Suggested Layer**: API

### TC-207: Tampered and malformed tokens are rejected
**Category**: Security
**Priority**: P0
**Preconditions**: A valid token.
**Steps**:
1. Call `GET /api/bookings` with: a token with the signature altered, a token signed with another secret, an `alg: none` token, and the text `Bearer `.
**Expected Results**: 401 "Invalid or expired token" (or "Unauthorized" for the empty value). No data is returned.
**Business Rule**: Auth: JWT
**Suggested Layer**: API

### TC-208: Expired token is rejected
**Category**: Security
**Priority**: P1
**Preconditions**: A token signed with the correct secret whose `exp` is in the past (generate locally, or run against a local backend).
**Steps**:
1. `GET /api/bookings` with it.
**Expected Results**: 401 "Invalid or expired token".
**Business Rule**: Auth: 7-day expiry
**Suggested Layer**: API

### TC-209: Logged-out user can't use booking pages
**Category**: Security
**Priority**: P0
**Preconditions**: No token in `localStorage`.
**Steps**:
1. Open `/bookings` and `/bookings/1` directly.
**Expected Results**: The user is sent to `/login`. No booking data is rendered.
**Business Rule**: Auth guard
**Suggested Layer**: E2E

### TC-210: Server-controlled fields can't be set on create
**Category**: Security
**Priority**: P1
**Preconditions**: User B, valid token.
**Steps**:
1. `POST /api/bookings` with extra fields `userId: <A>`, `status: "cancelled"`, `totalPrice: 1`, `bookingRef: "Z-AAAAAA"`.
**Expected Results**: The booking is created for B. `userId` is B, `status` is `confirmed`, `totalPrice` is price times quantity and `bookingRef` is generated. Extra fields are ignored.
**Business Rule**: Code: `createBooking` builds data explicitly
**Suggested Layer**: API

### TC-211: A user can't book another user's dynamic event
**Category**: Security
**Priority**: P1
**Preconditions**: User A owns a dynamic event.
**Steps**:
1. As B, `POST /api/bookings` for that event id.
**Expected Results**: 404 "Event with id N not found". No booking is created.
**Business Rule**: BR §2
**Suggested Layer**: API

### TC-212: Script content in customer fields is not executed
**Category**: Security
**Priority**: P1
**Preconditions**: Booking created with name `<img src=x onerror=alert(1)>` and email `x@example.com`.
**Steps**:
1. Open the detail page and the list.
2. Listen for dialogs.
**Expected Results**: The text is displayed as plain text. No dialog opens and no element is injected.
**Business Rule**: XSS
**Suggested Layer**: E2E

### TC-213: Injection strings in reference lookup are inert
**Category**: Security
**Priority**: P1
**Preconditions**: Authenticated user.
**Steps**:
1. `GET /api/bookings/ref/' OR '1'='1`.
2. `GET /api/bookings/ref/%00` and a 1000-character reference.
**Expected Results**: 404 (not found) each time. No other user's data. No 500 and no stack trace in the body.
**Business Rule**: SQL injection
**Suggested Layer**: API

---

## Negative

### TC-300: Failed booking at the limit still loses the oldest booking
**Category**: Negative
**Priority**: P0
**Preconditions**: Fresh user with 9 bookings. Event X has too few seats for a request.
**Steps**:
1. `POST /api/bookings` for X with quantity above the seats left.
2. List bookings.
**Expected Results**: 400 "Only N seat(s) available, but M requested". **Expected:** all 9 bookings remain. **Known issue (F-1):** the oldest is deleted before the check, so only 8 remain.
**Business Rule**: BR §4 (pruning is meant to make room for a successful booking)
**Suggested Layer**: API

### TC-301: Booking an unknown event at the limit loses the oldest booking
**Category**: Negative
**Priority**: P0
**Preconditions**: Fresh user with 9 bookings.
**Steps**:
1. `POST /api/bookings` with `eventId: 999999999`.
2. List bookings.
**Expected Results**: 404 "Event with id 999999999 not found" and 9 bookings. **Known issue (F-1):** one is removed first.
**Business Rule**: BR §4
**Suggested Layer**: API

### TC-302: Read a booking that doesn't exist
**Category**: Negative
**Priority**: P1
**Preconditions**: Authenticated user.
**Steps**:
1. `GET /api/bookings/999999999`.
**Expected Results**: 404 "Booking with id 999999999 not found".
**Business Rule**: API Ref
**Suggested Layer**: API

### TC-303: Cancel a booking that doesn't exist
**Category**: Negative
**Priority**: P1
**Preconditions**: Authenticated user.
**Steps**:
1. `DELETE /api/bookings/999999999`.
**Expected Results**: 404 "Booking with id 999999999 not found".
**Business Rule**: API Ref
**Suggested Layer**: API

### TC-304: Cancel the same booking twice
**Category**: Negative
**Priority**: P1
**Preconditions**: One booking.
**Steps**:
1. `DELETE /api/bookings/:id` twice.
**Expected Results**: First call 200 "Booking cancelled". Second call 404.
**Business Rule**: Cancel is a hard delete
**Suggested Layer**: API

### TC-305: Look up a reference that doesn't exist
**Category**: Negative
**Priority**: P1
**Preconditions**: Authenticated user.
**Steps**:
1. `GET /api/bookings/ref/X-000000`.
**Expected Results**: 404 `Booking with reference "X-000000" not found`.
**Business Rule**: API Ref
**Suggested Layer**: API

### TC-306: Non-numeric booking id
**Category**: Negative
**Priority**: P2
**Preconditions**: Authenticated user.
**Steps**:
1. `GET /api/bookings/abc`, `GET /api/bookings/-1`, `GET /api/bookings/1.5` and `DELETE /api/bookings/abc`.
**Expected Results**: A client error (400 or 404) with a readable message. **Known issue (F-4):** `Number('abc')` is `NaN`, so Prisma may reject it and the API may return 500. Record the real status.
**Business Rule**: API Ref (validation errors are 400)
**Suggested Layer**: API

### TC-307: Open the page of a booking that doesn't exist
**Category**: Negative
**Priority**: P1
**Preconditions**: Signed in.
**Steps**:
1. Open `/bookings/999999999`.
**Expected Results**: "Booking not found" with "This booking doesn't exist or may have been cancelled." and a **View My Bookings** button.
**Business Rule**: Code: detail page error state
**Suggested Layer**: E2E

### TC-308: Reopen the page of a cancelled booking
**Category**: Negative
**Priority**: P1
**Preconditions**: Booking cancelled from its detail page.
**Steps**:
1. Use the browser back button, or open `/bookings/:id` again.
**Expected Results**: "Booking not found". The cancelled booking's data isn't shown. (React Query may show cached data briefly because `['booking', id]` isn't invalidated, F-7. Record what is seen.)
**Business Rule**: BR §4
**Suggested Layer**: E2E

### TC-309: Bookings can't be edited
**Category**: Negative
**Priority**: P2
**Preconditions**: One booking.
**Steps**:
1. Send `PUT` and `PATCH` to `/api/bookings/:id` with a changed `quantity`.
**Expected Results**: 404 (no route). The booking is unchanged.
**Business Rule**: API Ref (no update endpoint)
**Suggested Layer**: API

### TC-310: Invalid list query parameters
**Category**: Negative
**Priority**: P2
**Preconditions**: User with 3 bookings.
**Steps**:
1. Call `GET /api/bookings` with `page=0`, `page=-1`, `page=abc`, `limit=0`, `limit=-5`, `limit=abc`, `eventId=abc`, `status=cancelled`.
**Expected Results**: Each returns a controlled response. Zero and `abc` fall back to defaults (page 1, limit 10). `status=cancelled` returns an empty list (F-10). **Known issue (F-4):** `page=-1` gives a negative `skip` and `eventId=abc` gives `NaN`, which can cause a 500. A negative `limit` may return rows in reverse. Record each status.
**Business Rule**: Code: `getBookings`, `findAll`
**Suggested Layer**: API

### TC-311: Cancel and clear all failures are shown to the user
**Category**: Negative
**Priority**: P2
**Preconditions**: A booking exists. Requests are mocked to return 500.
**Steps**:
1. On `/bookings`, cancel a booking.
2. Click **Clear all bookings** and accept.
**Expected Results**: Step 1 shows an error toast with the message, the dialog closes and the card stays. **Known issue (F-7):** step 2 has no `catch`, so no message is shown. The button returns to "Clear all bookings".
**Business Rule**: Usability
**Suggested Layer**: Component

### TC-312: List load failure offers a retry
**Category**: Negative
**Priority**: P2
**Preconditions**: `GET /api/bookings` is mocked to fail.
**Steps**:
1. Open `/bookings`.
2. Remove the failure and click **Retry**.
**Expected Results**: "Couldn't load bookings" and "Failed to connect to the server. Please try again." appear. After **Retry** the bookings are shown.
**Business Rule**: Code: `EmptyState` with Retry
**Suggested Layer**: Component

### TC-313: Deleted user's token can't create or list bookings sensibly
**Category**: Negative
**Priority**: P3
**Preconditions**: User whose account was deleted in the database, still holding a valid token (F-9).
**Steps**:
1. `GET /api/bookings`.
2. `POST /api/bookings` for a static event.
**Expected Results**: List returns an empty set. Create returns a controlled error (the foreign key failure maps to 400 "Related record does not exist"), not a 500.
**Business Rule**: Data model: Booking cascade with User
**Suggested Layer**: API

---

## Edge Cases

### TC-400: Ninth booking prunes nothing
**Category**: Edge Case
**Priority**: P0
**Preconditions**: Fresh user with 8 bookings.
**Steps**:
1. Create a 9th booking.
**Expected Results**: `total` is 9 and the first booking is still present.
**Business Rule**: BR §4
**Suggested Layer**: API

### TC-401: Cancelling at the limit makes room without pruning
**Category**: Edge Case
**Priority**: P1
**Preconditions**: Fresh user with 9 bookings.
**Steps**:
1. Cancel the newest booking.
2. Create a new booking.
**Expected Results**: After step 1, 8 bookings. After step 2, 9 bookings, and the oldest of the original set is still present.
**Business Rule**: BR §4
**Suggested Layer**: API

### TC-402: Nine bookings fit on one page
**Category**: Edge Case
**Priority**: P1
**Preconditions**: Fresh user with 9 bookings.
**Steps**:
1. Open `/bookings`.
2. Call `GET /api/bookings?limit=9` and `?limit=4&page=3`.
**Expected Results**: 9 cards and no pagination controls on the page (F-5, which requests `limit: 10`). With `limit=9`, `totalPages` is 1. With `limit=4&page=3`, `data` has 1 item and `totalPages` is 3.
**Business Rule**: BR §4 (page shows max 9)
**Suggested Layer**: E2E

### TC-403: Clear all with no bookings
**Category**: Edge Case
**Priority**: P2
**Preconditions**: Fresh user, no bookings.
**Steps**:
1. Open `/bookings` and click **Clear all bookings**, accept.
2. `DELETE /api/bookings` through the API.
**Expected Results**: The empty state stays. The API returns 200 "0 booking(s) cleared". No error.
**Business Rule**: Code: `deleteMany` returns count 0
**Suggested Layer**: E2E

### TC-404: Two parallel bookings at the limit
**Category**: Edge Case
**Priority**: P2
**Preconditions**: Fresh user with 9 bookings on dynamic events.
**Steps**:
1. Send two `POST /api/bookings` at the same time.
**Expected Results**: The user ends with 9 bookings. **Known risk (F-6):** both requests may read count 9, delete the same booking (one then fails with a 404 or 500), or both end with 10 bookings. Record the outcome.
**Business Rule**: BR §4
**Suggested Layer**: API

### TC-405: Two parallel cancels of one booking
**Category**: Edge Case
**Priority**: P2
**Preconditions**: One booking.
**Steps**:
1. Send two `DELETE /api/bookings/:id` at the same time.
**Expected Results**: One 200 and one 404. A 500 from the second delete (Prisma P2025 is mapped to 404, which is acceptable) is a defect.
**Business Rule**: Cancel is a hard delete
**Suggested Layer**: API

### TC-406: Decimal and free event prices
**Category**: Edge Case
**Priority**: P2
**Preconditions**: Dynamic events priced 0, 49.99 and 0.5. One booking each (quantity 3).
**Steps**:
1. Read `totalPrice` through the API.
2. Read the list card and detail page.
**Expected Results**: The API returns 0, 149.97 and 1.5. **Known issue (F-8):** the UI rounds to whole dollars ($150 and $2), so the displayed total doesn't match the API.
**Business Rule**: BR §9
**Suggested Layer**: E2E

### TC-407: Ten tickets, the maximum quantity
**Category**: Edge Case
**Priority**: P2
**Preconditions**: Dynamic event with 10 seats.
**Steps**:
1. Book quantity 10.
2. Book quantity 1 on the same event.
**Expected Results**: The first booking succeeds and `availableSeats` becomes 0. The second returns 400 "Only 0 seat(s) available, but 1 requested". The card shows "10 tickets".
**Business Rule**: BR §6
**Suggested Layer**: API

### TC-408: A sold-out event can be booked again after cancelling
**Category**: Edge Case
**Priority**: P1
**Preconditions**: As TC-407, sold out.
**Steps**:
1. Cancel the 10-ticket booking.
2. Book quantity 2.
**Expected Results**: The second booking succeeds and seats are 8.
**Business Rule**: BR §4
**Suggested Layer**: API

### TC-409: Reference lookup with different case and spacing
**Category**: Edge Case
**Priority**: P3
**Preconditions**: Booking with reference `T-A3B2C1`.
**Steps**:
1. Look up `t-a3b2c1`, ` T-A3B2C1`, and `T-A3B2C1/`.
**Expected Results**: The result is consistent and documented. MySQL's default collation is case-insensitive, so the lower-case form may match. Spaces and a trailing slash don't match as a different booking. No 500.
**Business Rule**: Code: `findUnique({ bookingRef })`
**Suggested Layer**: API

### TC-410: Edit the event price after booking
**Category**: Edge Case
**Priority**: P2
**Preconditions**: Dynamic event priced 100 with one booking of 2.
**Steps**:
1. `PUT /api/events/:id` with price 500.
2. Open the booking detail page.
**Expected Results**: Total Paid stays $200 (stored at booking time). "Price per ticket" is read from the live event, so it shows $500. Record the mismatch as a presentation inconsistency.
**Business Rule**: BR §9
**Suggested Layer**: E2E

### TC-411: One user's pruning doesn't affect another user
**Category**: Edge Case
**Priority**: P1
**Preconditions**: A and B each have 9 bookings, including some on the same event.
**Steps**:
1. A creates a 10th booking.
2. List B's bookings.
**Expected Results**: B still has all 9.
**Business Rule**: BR §2, BR §4
**Suggested Layer**: API

---

## UI State

### TC-500: Empty bookings page
**Category**: UI State
**Priority**: P0
**Preconditions**: Fresh user with no bookings.
**Steps**:
1. Open `/bookings`.
2. Click **Browse Events**.
**Expected Results**: "No bookings yet" and "You haven't booked any events yet. Browse upcoming events and grab your tickets!" with an icon. **Browse Events** goes to `/events`. No cards.
**Business Rule**: Code: empty state
**Suggested Layer**: E2E

### TC-501: No sandbox banner on the bookings page
**Category**: UI State
**Priority**: P2
**Preconditions**: User with 8 and then 9 bookings.
**Steps**:
1. Open `/bookings` at each count.
**Expected Results**: BR §5 says a conditional banner about the "9 bookings" limit appears on this page. **Known gap:** the local source has no banner. Confirm on the deployed site and record the result; if the banner exists, it must be hidden at low counts and visible near 9.
**Business Rule**: BR §5
**Suggested Layer**: E2E

### TC-502: Loading skeletons
**Category**: UI State
**Priority**: P2
**Preconditions**: `GET /api/bookings` delayed by 2 seconds.
**Steps**:
1. Open `/bookings`.
**Expected Results**: 5 skeleton cards show first and are replaced by real cards or the empty state. The detail page shows a spinner while loading.
**Business Rule**: Code: `BookingCardSkeleton`
**Suggested Layer**: Component

### TC-503: Refund spinner timing
**Category**: UI State
**Priority**: P2
**Preconditions**: Booking of any quantity.
**Steps**:
1. Click `#check-refund-btn`.
2. Check the page right away and again after 4 seconds.
**Expected Results**: The button is replaced by `#refund-spinner` ("Checking your refund eligibility…"). The result appears after about 4 seconds and the spinner is gone. Don't assert exact timing. Use an expectation with a timeout of at least 6 seconds.
**Business Rule**: BR §8
**Suggested Layer**: E2E

### TC-504: Refund button can't be triggered twice
**Category**: UI State
**Priority**: P3
**Preconditions**: Booking of quantity 1.
**Steps**:
1. Click `#check-refund-btn` twice quickly.
**Expected Results**: Only one spinner is shown and one result. The button isn't present during checking.
**Business Rule**: BR §8
**Suggested Layer**: E2E

### TC-505: Refund state resets when leaving the page
**Category**: UI State
**Priority**: P3
**Preconditions**: Booking of quantity 1.
**Steps**:
1. Click `#check-refund-btn`.
2. Navigate away during the spinner and come back.
**Expected Results**: The page shows the initial **Check eligibility for refund?** button. No console errors.
**Business Rule**: BR §8
**Suggested Layer**: E2E

### TC-506: Event seat counts after Clear all are not stale
**Category**: UI State
**Priority**: P2
**Preconditions**: Dynamic event with 20 seats. A 5-seat booking. The event page was visited (it shows 15).
**Steps**:
1. Open `/bookings` through client navigation, then Clear all.
2. Go to the event page with the navigation bar.
**Expected Results**: The event shows 20 seats. **Known issue (F-7):** "Clear all" refetches only `bookings`, so cached `events` data can show 15 until it goes stale.
**Business Rule**: BR §4
**Suggested Layer**: E2E

### TC-507: List updates after cancel and after Clear all without reloading
**Category**: UI State
**Priority**: P1
**Preconditions**: Fresh user with 3 bookings.
**Steps**:
1. Cancel one from a card, then clear all.
**Expected Results**: The card count goes 3, then 2, then the empty state, with no manual reload.
**Business Rule**: Flow 4
**Suggested Layer**: E2E

### TC-508: Declining a confirmation sends no request
**Category**: UI State
**Priority**: P1
**Preconditions**: Fresh user with 2 bookings.
**Steps**:
1. Click **Cancel Booking** and then close the dialog (or its cancel control).
2. Click **Clear all bookings** and dismiss the browser confirmation.
**Expected Results**: No `DELETE` request is sent and both bookings remain.
**Business Rule**: Code: `ConfirmDialog`, `confirm()`
**Suggested Layer**: E2E

### TC-509: Buttons are disabled while an action runs
**Category**: UI State
**Priority**: P3
**Preconditions**: `DELETE` calls delayed by 2 seconds.
**Steps**:
1. Start Clear all and observe the button.
2. Start a card cancel and observe the dialog.
**Expected Results**: The button shows "Clearing…" and is disabled. The dialog's confirm control shows a loading state and can't be clicked again, so only one request is sent.
**Business Rule**: Code: `disabled={clearing}`, `isLoading={isPending}`
**Suggested Layer**: Component

### TC-510: Plural and singular ticket wording
**Category**: UI State
**Priority**: P3
**Preconditions**: Bookings of quantity 1 and 2.
**Steps**:
1. Read both cards.
**Expected Results**: "1 ticket" and "2 tickets".
**Business Rule**: Code: `BookingCard`
**Suggested Layer**: Component

### TC-511: Session switch doesn't leak cached bookings
**Category**: UI State
**Priority**: P1
**Preconditions**: A and B each have bookings.
**Steps**:
1. Sign in as A, open `/bookings`, then log out.
2. Sign in as B in the same tab without reloading.
3. Open `/bookings`.
**Expected Results**: B sees only B's bookings. A's cards never show, even briefly.
**Business Rule**: BR §2, Flow 6
**Suggested Layer**: E2E
