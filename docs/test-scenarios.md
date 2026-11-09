# EventHub Test Scenarios: Booking Management

## Scope

**In scope:** everything that happens to a booking after it exists: list, detail, reference lookup, cancel, clear all, refund eligibility, FIFO pruning, seat release, and ownership.

**Out of scope:** booking form validation and the booking journey itself (Flow 3). Bookings are created only as setup, except where creation triggers a management rule such as FIFO pruning.

## Sources and confidence

| Source | Used for | Label in scenarios |
|---|---|---|
| `eventhub-domain` skill: `business-rules.md` | Business rules | BR §n |
| `eventhub-domain` skill: `user-flows.md` | User flows | Flow n |
| `eventhub-domain` skill: `api-reference.md` | Endpoints and error codes | API Ref |
| `eventhub-domain` skill: `ui-selectors.md` | Which controls exist | UI Selectors |
| Deployed API docs: `https://api.eventhub.rahulshettyacademy.com/api/docs/` | Booking contract | Swagger |
| `backend/` and `frontend/` source | Actual behaviour | File name and line |

**Expected results come from the source code and documents, not from running the app.** The tests target the deployed site, which may differ from the local source.

**Where the code contradicts a documented rule,** the expected result states the documented rule and a **Known issue** line names the defect. If a test fails that way, report it as an app bug and don't change the test to match. Defect IDs (D-n) are described in `docs/test-strategy.md`.

**Suggested Layer** uses E2E, API, Component, or Unit, plus Deferred for the one scenario that can't run yet. "Component" means one real page with a mocked API, because no component test runner is installed. See `docs/test-strategy.md` for the reasoning.

## Open questions

| ID | Question | What's known | Scenarios |
|---|---|---|---|
| OQ-9 | Does the deployed bookings page have a sandbox banner, and at what count does it appear? | BR §5 says it's conditional, but the local source has no banner on this page. | TC-501, TC-502 |
| OQ-10 | Do invalid IDs and query parameters return a 500? | The parsing is known, but whether Prisma errors reach the user as 500s needs a real run. | TC-304, TC-307, TC-405 |

The other questions are resolved. `docs/test-strategy.md` records the answers.

## Test data rules

- **Never overflow on a static event on the deployed site.** Going over the limit with all bookings on one event permanently removes that event's seats for every user (D-9). Use events the test creates, and check the event used for the 10th booking in every FIFO test.
- **Seat counts are per user.** `availableSeats` from `GET /events/:id` is calculated for the caller, so other users' normal bookings don't change it. Exact seat assertions are safe on either event type, but static counts may already be reduced by D-9, so compare before and after rather than against `totalSeats`.
- **Fresh users:** clear all and FIFO pruning remove the account's bookings, so use a freshly registered user for each test. Don't use the shared test accounts for these.
- **At most 6 events per user:** a 7th deletes the oldest event and its bookings.
- **Create bookings one at a time** when their order matters, because pruning order depends on `createdAt`.
- **Customer email:** avoid Gmail addresses when asserting customer data, because `normalizeEmail()` rewrites them.
- **Cross-user tests:** these need two separate users, A and B.

## Coverage summary

| Category | IDs | Count |
|---|---|---|
| Happy Path | TC-001 to TC-010 | 10 |
| Business Rule | TC-100 to TC-119 | 20 |
| Security | TC-200 to TC-215 | 16 |
| Negative | TC-300 to TC-312 | 13 |
| Edge Case | TC-400 to TC-414 | 15 |
| UI State | TC-500 to TC-508 | 9 |
| **Total** | | **83** |

---

## Happy Path

### TC-001: View list of own bookings
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in. `GET /bookings` is mocked to return 2 bookings on different events.
**Steps**:
1. Open `/bookings`.
**Expected Results**: Exactly 2 booking cards are shown, each identifying the correct event and booking. Each card has a View Details link.
**Business Rule**: Flow 4; BR §2 (users see their own bookings)
**Suggested Layer**: Component

### TC-002: Open booking details from the list
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in and has 1 booking.
**Steps**:
1. Open `/bookings`.
2. Click View Details.
**Expected Results**: The URL is `/bookings/:id`. The page shows the booking reference, the event title in the `h1`, customer details, quantity, total price, and event details, all matching the booking.
**Business Rule**: Flow 4; BR §1
**Suggested Layer**: E2E

### TC-003: Look up a booking by reference
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User has a booking with a known `bookingRef`.
**Steps**:
1. Call `GET /api/bookings/ref/:ref` with the user's token.
**Expected Results**: 200. `data` is the matching booking, with the same `id` and `bookingRef` and with event details included.
**Business Rule**: API Ref; Swagger `/bookings/ref/{ref}`
**Suggested Layer**: API

### TC-004: Cancel a booking from the detail page
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in and has 2 bookings, one of them on an event the test created.
**Steps**:
1. Open the detail page of the booking on the created event.
2. Click Cancel Booking.
3. In the dialog, click `confirm-dialog-yes` ("Yes, cancel it").
4. Read the event through the API.
**Expected Results**: The toast "Booking cancelled successfully" appears and the page redirects to `/bookings`. The cancelled booking is gone, the other booking is unchanged, and the event's seats are restored.
**Business Rule**: Flow 4; BR §1, §4
**Suggested Layer**: E2E

### TC-005: Clear all bookings
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in and has at least 3 bookings across different events.
**Steps**:
1. Open `/bookings`.
2. Register `page.once('dialog', ...)` to accept the native browser dialog, "Clear all your bookings? This cannot be undone."
3. Click the Clear all bookings button.
**Expected Results**: All bookings are removed in one action. "No bookings yet" appears, and `GET /api/bookings` returns an empty `data` array.
**Business Rule**: Flow 4; BR §1, §4 ("removes all bookings in one go")
**Suggested Layer**: E2E

### TC-006: Reach the new booking from the confirmation card
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User has just booked an event and sees the confirmation card.
**Steps**:
1. Note the reference on the card.
2. Click View My Bookings.
**Expected Results**: `/bookings` opens and the new booking appears with the same reference.
**Business Rule**: Flow 3 step 7; BR §1
**Suggested Layer**: E2E

### TC-007: Filter bookings by event
**Category**: Happy Path
**Priority**: P2
**Preconditions**: User has bookings on events X and Y.
**Steps**:
1. Call `GET /api/bookings?eventId=<X>`.
**Expected Results**: 200. Every returned booking has `eventId` X, and the pagination total counts only those bookings.
**Business Rule**: API Ref; Swagger `eventId` parameter
**Suggested Layer**: API

### TC-008: Check refund eligibility from the detail page
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User has a booking with quantity 1.
**Steps**:
1. Open the booking's detail page.
2. Click `#check-refund-btn`, labelled "Check eligibility for refund?".
**Expected Results**: The spinner appears, followed by a result starting "Eligible for refund."
**Business Rule**: Flow 4 step 5; BR §8
**Suggested Layer**: E2E

### TC-009: Cancel a booking from a list card
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User is logged in. The booking API is mocked to return 2 bookings, then 1 after the delete.
**Steps**:
1. Open `/bookings`.
2. On one card, click `cancel-booking-btn`.
3. Click `confirm-dialog-yes`.
**Expected Results**: The toast "Booking cancelled successfully" appears. The page stays on `/bookings`, unlike a cancel from the detail page, and the cancelled card disappears.
**Business Rule**: Flow 4; `BookingCard.jsx:35-40`, `:83`
**Suggested Layer**: Component

### TC-010: Manage bookings from the admin page
**Category**: Happy Path
**Priority**: P2
**Preconditions**: User is logged in. The booking API is mocked to return 2 confirmed bookings.
**Steps**:
1. Open `/admin/bookings`.
2. Click View on a booking.
3. Close the modal, then click Cancel on a booking and confirm.
4. Set the status filter to Cancelled.
**Expected Results**: The modal shows the booking's details. The toast "Booking cancelled" appears after cancelling. The filter sends `status=cancelled`, and with an empty mock response the page shows "No bookings found".
**Business Rule**: `app/admin/bookings/page.tsx:14-18`, `:162-168`. No domain flow covers this page.
**Suggested Layer**: Component

---

## Business Rules

### TC-100: Booking reference matches the format and the event title
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User has a dynamic event titled "Tech Summit".
**Steps**:
1. Create a booking on the event.
2. Read `bookingRef` from `POST /api/bookings`, `GET /api/bookings/:id`, and the list.
**Expected Results**: The value matches `^T-[A-Z0-9]{6}$` and is the same in all three responses. Swagger's `EVT-` format is out of date (D-14).
**Business Rule**: BR §1, §7
**Suggested Layer**: API

### TC-101: Total price equals ticket price times quantity
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User has an event with a known price.
**Steps**:
1. Create bookings with quantity 1, 3, and 10.
2. Read each booking back.
**Expected Results**: `totalPrice` equals `price x quantity` for each booking, in both the create and read responses. Compare numerically, because Prisma `Decimal` values normally serialize as strings.
**Business Rule**: BR §9
**Suggested Layer**: API

### TC-102: Tenth booking removes only the oldest
**Category**: Business Rule
**Priority**: P0
**Preconditions**: New user has exactly 9 bookings, created in a known order. The oldest is on event X.
**Steps**:
1. Create a 10th booking on event Y, a test-created event different from X.
2. Call `GET /api/bookings`.
3. Call `GET /api/bookings/:id` for the oldest booking.
**Expected Results**: The user still has 9 bookings. The oldest is gone and returns 404. The other 8 and the new booking remain.
**Business Rule**: BR §4
**Suggested Layer**: API

### TC-103: Repeated overflow removes bookings in creation order
**Category**: Business Rule
**Priority**: P1
**Preconditions**: New user has exactly 9 bookings across several events, created in a known order.
**Steps**:
1. Create 3 more bookings one at a time, on a test-created event with no existing bookings.
2. Check the list after each one.
**Expected Results**: The count stays at 9. Bookings 1, 2, and 3 are removed in that order, regardless of which event each one belongs to.
**Business Rule**: BR §4
**Suggested Layer**: API

### TC-104: Cancelling frees seats on a dynamic event
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User has a dynamic event with 50 seats and a booking for 4 tickets, so 46 are available.
**Steps**:
1. Call `DELETE /api/bookings/:id`.
2. Call `GET /api/events/:id`.
**Expected Results**: The delete succeeds and `availableSeats` returns to 50 immediately.
**Business Rule**: BR §4, §6; Swagger `DELETE /bookings/{id}`
**Suggested Layer**: API

### TC-105: Clear all frees seats across dynamic events
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has bookings on 2 dynamic events, including 2 bookings on the same event.
**Steps**:
1. Call `DELETE /api/bookings`.
2. Read both events.
**Expected Results**: Both events return to `availableSeats` equal to `totalSeats`.
**Business Rule**: BR §4, §6
**Suggested Layer**: API

### TC-106: Cancelling a static event booking
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has a booking for 2 tickets on a static event.
**Steps**:
1. Record `availableSeats` from `GET /api/events/:id`.
2. Cancel the booking.
3. Read the event again.
**Expected Results**: The caller's `availableSeats` increases by 2. The stored value never changes, because seats are calculated per user (`eventService.js:6-18`). BR §6 is out of date on this (D-14).
**Business Rule**: BR §4, §6; Swagger `DELETE /bookings/{id}`
**Suggested Layer**: API

### TC-107: FIFO pruning releases the pruned booking's seats
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has 9 bookings, and the oldest is for 3 tickets on event X, which can be static or dynamic.
**Steps**:
1. Record X's `availableSeats`.
2. Create a 10th booking on a different event.
3. Read X again.
**Expected Results**: X's `availableSeats` increases by 3 for the caller.
**Business Rule**: BR §4; `eventService.js:6-18`
**Suggested Layer**: API

### TC-108: Repeat bookings on the same event are separate
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has a dynamic event with 50 seats.
**Steps**:
1. Book the event twice, with quantities 2 and 3.
2. Read the list and the event.
**Expected Results**: There are 2 bookings with different IDs and references. `availableSeats` is 45.
**Business Rule**: BR §6
**Suggested Layer**: API

### TC-109: Single-ticket booking is eligible for a refund
**Category**: Business Rule
**Priority**: P1
**Preconditions**: The booking API is mocked to return a booking with quantity 1. `page.clock` is installed to skip the 4-second wait.
**Steps**:
1. Open the booking's detail page and run the refund check.
**Expected Results**: The result reads "Eligible for refund. Single-ticket bookings qualify for a full refund."
**Business Rule**: BR §8
**Suggested Layer**: Component

### TC-110: Group booking is not eligible for a refund
**Category**: Business Rule
**Priority**: P1
**Preconditions**: The booking API is mocked to return bookings with quantity 2 and quantity 10. `page.clock` is installed to skip the 4-second wait.
**Steps**:
1. Open each booking's detail page and run the refund check.
**Expected Results**: The results read "Not eligible for refund. Group bookings (2 tickets) are non-refundable." and "Not eligible for refund. Group bookings (10 tickets) are non-refundable."
**Business Rule**: BR §8
**Suggested Layer**: Component

### TC-111: Refund check makes no backend call and changes nothing
**Category**: Business Rule
**Priority**: P2
**Preconditions**: User is on a booking's detail page.
**Steps**:
1. Monitor network requests.
2. Run the refund check.
3. Read the booking through the API.
**Expected Results**: No refund request is sent. The booking and its event's seats are unchanged.
**Business Rule**: BR §8 ("frontend-only logic")
**Suggested Layer**: Component

### TC-112: Deleting an event removes its bookings
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has a dynamic event with 2 bookings, and a booking on a different event.
**Steps**:
1. Call `DELETE /api/events/:id`.
2. Read the deleted event's bookings and list the user's bookings.
**Expected Results**: Both bookings on the deleted event return 404. The booking on the other event remains.
**Business Rule**: Flow 5 step 6; Booking data model (cascade delete)
**Suggested Layer**: API

### TC-113: Deleting a user removes their bookings
**Category**: Business Rule
**Priority**: P3
**Preconditions**: Test user has bookings. No user deletion endpoint is documented, so this needs database access in a local environment.
**Steps**:
1. Delete the user row.
2. Query bookings for that `userId`.
**Expected Results**: No bookings remain for the user. Other users' bookings are unaffected.
**Business Rule**: BR §2; Booking data model (cascade delete)
**Suggested Layer**: Deferred

### TC-114: Cancelled booking is permanently removed
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has a booking with a known ID and reference.
**Steps**:
1. Cancel the booking.
2. Call `GET /api/bookings/:id` and `GET /api/bookings/ref/:ref`.
3. Call `GET /api/bookings?status=cancelled`.
**Expected Results**: Both lookups return 404. The `cancelled` filter returns no bookings, because nothing ever sets that status.
**Business Rule**: BR §1; `bookingService.js:126-136`
**Suggested Layer**: API

### TC-115: Sold-out event can be booked again after a cancellation
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has a dynamic event with 2 seats, fully booked by one booking.
**Steps**:
1. Try to book 1 more ticket.
2. Cancel the existing booking.
3. Try to book 1 ticket again.
**Expected Results**: The first attempt returns 400 with `Only 0 seat(s) available, but 1 requested`. The last attempt returns 201. API Ref's message is out of date.
**Business Rule**: BR §4, §6; API Ref; Swagger `POST /bookings`
**Suggested Layer**: API

### TC-116: Tenth booking on the oldest booking's event
**Category**: Business Rule
**Priority**: P1
**Preconditions**: New user has 9 bookings. The oldest is on test-created event X, and the other 8 are on test-created event Y.
**Steps**:
1. Create a 10th booking on event X.
2. List bookings.
**Expected Results**: The user has 9 bookings and the oldest is gone, as BR §4 states. **Known issue:** the code skips bookings on the new booking's event, so the oldest survives and the second-oldest is removed (D-10). This looks deliberate, so either the rule or the code needs changing.
**Business Rule**: BR §4; `bookingService.js:73-74`
**Suggested Layer**: API

### TC-117: Overflow on one event doesn't permanently remove seats
**Category**: Business Rule
**Priority**: P1
**Preconditions**: New user has 9 bookings of 1 ticket each, all on one **test-created** event with 50 seats. **Never run the API version on a static event on the deployed site.**
**Steps**:
1. Create a 10th booking on the same event.
2. Clear all bookings.
3. Read the event.
**Expected Results**: `availableSeats` returns to 50 once the user has no bookings. A Unit version also checks that another user's count on a static event is unchanged. **Known issue:** the code permanently reduces the event's seats by the new booking's quantity. The probe showed 49 of 50 here, and another user's static count dropping from 500 to 490 (D-9).
**Business Rule**: BR §2, §4, §6; `bookingService.js:94-97`
**Suggested Layer**: API

### TC-118: Booking a static event doesn't change another user's seat count
**Category**: Business Rule
**Priority**: P1
**Preconditions**: Users A and B both exist. Neither has bookings on the chosen static event.
**Steps**:
1. As A and as B, record `availableSeats` for the event.
2. As A, book 2 tickets.
3. As A and as B, read the event again.
**Expected Results**: A's count drops by 2 and B's count is unchanged.
**Business Rule**: BR §2; `eventService.js:6-18`
**Suggested Layer**: API

### TC-119: Creating a 7th event removes the oldest event's bookings
**Category**: Business Rule
**Priority**: P2
**Preconditions**: New user has 6 test-created events and a booking on the oldest one.
**Steps**:
1. Create a 7th event.
2. Read the booking and list the user's events.
**Expected Results**: The oldest event is gone, the booking returns 404, and the user still has 6 events.
**Business Rule**: BR §3; Booking data model (cascade delete); `eventService.js:51-54`
**Suggested Layer**: API

---

## Security

### TC-200: Cross-user booking read is denied by the API
**Category**: Security
**Priority**: P0
**Preconditions**: User A has a booking.
**Steps**:
1. Call `GET /api/bookings/:id` with User B's token.
**Expected Results**: 403. The response contains no booking data.
**Business Rule**: BR §2; API Ref; Flow 6
**Suggested Layer**: API

### TC-201: Cross-user booking page shows Access Denied
**Category**: Security
**Priority**: P0
**Preconditions**: User A has a booking with a known ID.
**Steps**:
1. Log in as User B.
2. Open `/bookings/<A's booking ID>`.
**Expected Results**: The page shows "Access Denied". None of A's reference, customer details, or cancel and refund controls are shown.
**Business Rule**: BR §2; Flow 6
**Suggested Layer**: E2E

### TC-202: Cross-user cancellation is denied
**Category**: Security
**Priority**: P0
**Preconditions**: User A has a booking.
**Steps**:
1. Call `DELETE /api/bookings/:id` with User B's token.
2. Read the booking as User A.
**Expected Results**: 404, with `Booking with id N not found`. A's booking still exists and the event's seats are unchanged. The docs say 403 (D-14), but the booking is safe either way.
**Business Rule**: BR §2 (sandbox isolation)
**Suggested Layer**: API

### TC-203: Cross-user reference lookup is denied
**Category**: Security
**Priority**: P0
**Preconditions**: User A has a booking with a known reference.
**Steps**:
1. Call `GET /api/bookings/ref/:ref` with User B's token.
**Expected Results**: 403, with `You do not own this booking`. The response contains no booking data. This is a separate code path from lookup by ID, so it needs its own check.
**Business Rule**: BR §2
**Suggested Layer**: API

### TC-204: List never includes another user's bookings
**Category**: Security
**Priority**: P0
**Preconditions**: Users A and B both have bookings on the same static event.
**Steps**:
1. As User B, call `GET /api/bookings`.
2. As User B, call `GET /api/bookings?eventId=<shared event>`.
**Expected Results**: Both responses contain only B's bookings, and the pagination totals don't count A's.
**Business Rule**: BR §2
**Suggested Layer**: API

### TC-205: Clear all affects only the caller's bookings
**Category**: Security
**Priority**: P0
**Preconditions**: Users A and B both have bookings, including on the same static event.
**Steps**:
1. As User B, call `DELETE /api/bookings`.
2. As User A, list bookings.
**Expected Results**: B has no bookings. All of A's bookings remain unchanged.
**Business Rule**: BR §2, §4
**Suggested Layer**: API

### TC-206: Booking endpoints require a token
**Category**: Security
**Priority**: P0
**Preconditions**: A booking with a known ID and reference exists.
**Steps**:
1. Without a token, call `GET /api/bookings`, `GET /api/bookings/:id`, `GET /api/bookings/ref/:ref`, `POST /api/bookings`, `DELETE /api/bookings`, and `DELETE /api/bookings/:id`.
**Expected Results**: Each returns 401, with `Unauthorized`. No bookings are created or removed.
**Business Rule**: API Ref ("Bearer Token Required"; missing token returns 401)
**Suggested Layer**: API

### TC-207: Malformed or tampered tokens are rejected
**Category**: Security
**Priority**: P1
**Preconditions**: `authMiddleware` runs with a test `JWT_SECRET`, and a valid token signed with it is available.
**Steps**:
1. Call the middleware with a malformed token.
2. Call it with the wrong scheme (`Basic`).
3. Call it with a valid token whose payload was changed without re-signing.
4. Call it with a token signed by a different key.
5. Call it with a token using `alg: none`.
**Expected Results**: The wrong scheme returns 401 with `Unauthorized`. The others return 401 with `Invalid or expired token`. `next()` is never called.
**Business Rule**: Tech stack (JWT auth); API Ref
**Suggested Layer**: Unit

### TC-208: Expired token is rejected
**Category**: Security
**Priority**: P2
**Preconditions**: `authMiddleware` runs with a test `JWT_SECRET`, and a token signed with it has already expired.
**Steps**:
1. Call the middleware with the expired token.
**Expected Results**: 401, with `Invalid or expired token`. `next()` isn't called.
**Business Rule**: Tech stack (JWT, 7-day expiry)
**Suggested Layer**: Unit

### TC-209: Logged-out user can't view booking pages
**Category**: Security
**Priority**: P1
**Preconditions**: Browser has no session token. No API mock is needed.
**Steps**:
1. Open `/bookings`.
2. Open `/bookings/:id`.
**Expected Results**: No booking data is shown. `AuthGuard` redirects to `/login`.
**Business Rule**: API Ref (auth required); BR §1
**Suggested Layer**: Component

### TC-210: Create request can't set server-controlled fields
**Category**: Security
**Priority**: P1
**Preconditions**: User A is logged in, and User B's ID is known.
**Steps**:
1. Call `POST /api/bookings` with a valid body plus `userId` set to B, `totalPrice` set to 1, `bookingRef` set to a chosen value, and `status` set to `cancelled`.
**Expected Results**: 201, with the extra fields ignored. The booking belongs to A, the price is calculated, the reference is generated, and the status is `confirmed`.
**Business Rule**: Swagger `CreateBookingInput`; BR §7, §9
**Suggested Layer**: API

### TC-211: Can't book another user's dynamic event
**Category**: Security
**Priority**: P1
**Preconditions**: User A has a dynamic event. User B has fewer than 9 bookings, because at the limit a failed request also deletes a booking (D-8).
**Steps**:
1. As User B, call `POST /api/bookings` with A's event ID.
2. List B's bookings and read A's event as A.
**Expected Results**: 404, with `Event with id N not found`. No booking is created for B, and A's event seats are unchanged.
**Business Rule**: BR §2 ("each user only sees their own dynamic events")
**Suggested Layer**: API

### TC-212: Script in customer fields doesn't execute
**Category**: Security
**Priority**: P2
**Preconditions**: The booking API is mocked to return `customerName` set to `<img src=x onerror=window.__xss=1>`. The validator only checks length, so this value can reach the UI unchanged.
**Steps**:
1. Open `/bookings`.
2. Open the booking's detail page.
3. Check `window.__xss` on both pages.
**Expected Results**: The value shows as plain text and `window.__xss` stays undefined.
**Business Rule**: Swagger `CreateBookingInput` (only length is constrained); BR §2
**Suggested Layer**: Component

### TC-213: Injection strings in lookups are handled safely
**Category**: Security
**Priority**: P2
**Preconditions**: User is logged in and another user has bookings.
**Steps**:
1. Call `GET /api/bookings/ref/` with a URL-encoded `' OR '1'='1`.
2. Call `GET /api/bookings?status=` with the same value.
**Expected Results**: The lookup returns 404. The filter returns 200 with an empty list. No other user's data, SQL errors, or stack traces are returned.
**Business Rule**: BR §2; Swagger `/bookings/ref/{ref}`
**Suggested Layer**: API

### TC-214: Switching users doesn't show the previous user's bookings
**Category**: Security
**Priority**: P0
**Preconditions**: Users A and B have different bookings. A is logged in and has `/bookings` open.
**Steps**:
1. Click `logout-btn`.
2. Log in as B through the login form.
3. Click `nav-bookings`. **Don't use `page.goto` at any point after logging in as A,** because a page reload wipes the cache and hides the bug.
**Expected Results**: Only B's bookings appear. A's bookings never appear, even briefly from the client-side cache. **Known issue:** query keys don't include the user and logout doesn't clear the cache, so this will probably fail (D-1).
**Business Rule**: BR §2; Flow 6; `useBookings.ts:9`; `useAuth.tsx:63-68`; `providers.jsx:14`
**Suggested Layer**: E2E

### TC-215: A 401 during a session logs the user out
**Category**: Security
**Priority**: P1
**Preconditions**: User is logged in with a token set. `GET /auth/me` succeeds, and `GET /bookings` is mocked to return 401.
**Steps**:
1. Open `/bookings`.
**Expected Results**: `eventhub_token` is removed from localStorage and the browser goes to `/login`.
**Business Rule**: API Ref; `lib/api/client.js:28-31`
**Suggested Layer**: Component

---

## Negative

### TC-300: Read a booking that doesn't exist
**Category**: Negative
**Priority**: P1
**Preconditions**: User is logged in.
**Steps**:
1. Call `GET /api/bookings/999999999`.
**Expected Results**: 404 with `success: false` and an error message.
**Business Rule**: Swagger `GET /bookings/{id}`
**Suggested Layer**: API

### TC-301: Cancel a booking that doesn't exist
**Category**: Negative
**Priority**: P1
**Preconditions**: User is logged in.
**Steps**:
1. Call `DELETE /api/bookings/999999999`.
**Expected Results**: 404 with `success: false`.
**Business Rule**: Swagger `DELETE /bookings/{id}`
**Suggested Layer**: API

### TC-302: Cancel the same booking twice
**Category**: Negative
**Priority**: P1
**Preconditions**: User has a booking for 3 tickets on a dynamic event.
**Steps**:
1. Cancel the booking.
2. Cancel it again.
3. Read the event.
**Expected Results**: The second call returns 404. Seats are restored only once, so `availableSeats` doesn't exceed `totalSeats`.
**Business Rule**: Swagger `DELETE /bookings/{id}`; BR §6
**Suggested Layer**: API

### TC-303: Look up a reference that doesn't exist
**Category**: Negative
**Priority**: P1
**Preconditions**: User is logged in.
**Steps**:
1. Call `GET /api/bookings/ref/Z-000000`.
**Expected Results**: 404 with an error like `Booking with reference "Z-000000" not found`.
**Business Rule**: Swagger `/bookings/ref/{ref}`
**Suggested Layer**: API

### TC-304: Invalid booking IDs
**Category**: Negative
**Priority**: P2
**Preconditions**: User is logged in.
**Steps**:
1. Call `GET` and `DELETE /api/bookings/:id` with `abc`, `0`, `-1`, `1.5`, and a value larger than the integer maximum.
**Expected Results**: `0` and `-1` return 404. Every other value returns a 4xx, never a 500. No bookings are changed. **Known issue:** IDs aren't validated, so `abc`, `1.5`, and the oversized value will probably return 500 (D-11, OQ-10).
**Business Rule**: Swagger (`id` is an integer)
**Suggested Layer**: API

### TC-305: Open the page of a booking that doesn't exist
**Category**: Negative
**Priority**: P2
**Preconditions**: User is logged in. `GET /bookings/:id` is mocked to return 404.
**Steps**:
1. Open `/bookings/999999999`.
**Expected Results**: The title is "Booking not found", with a View My Bookings link. Cancel and refund controls aren't shown.
**Business Rule**: Flow 4; Swagger `GET /bookings/{id}`
**Suggested Layer**: Component

### TC-306: Reopen the page of a cancelled booking
**Category**: Negative
**Priority**: P2
**Preconditions**: User has opened a booking's detail page. The mock returns the booking, then 200 for the delete, then 404 for later reads.
**Steps**:
1. Cancel the booking from the detail page.
2. After the redirect, use browser Back within 30 seconds.
**Expected Results**: "Booking not found" appears. Cached booking data isn't shown as if the booking were active. **Known issue:** cancelling doesn't invalidate the detail page's query, so this will probably fail (D-2).
**Business Rule**: BR §4; Swagger `DELETE /bookings/{id}`
**Suggested Layer**: Component

### TC-307: Invalid list query parameters
**Category**: Negative
**Priority**: P2
**Preconditions**: User has at least 1 booking.
**Steps**:
1. Call `GET /api/bookings` with `status=foo`, then `eventId=abc`, then `eventId=999999999`.
**Expected Results**: `status=foo` and the unknown event return 200 with an empty `data` array. `eventId=abc` returns a 4xx, never a 500. **Known issue:** `eventId` isn't validated, so it will probably return 500 (D-11, OQ-10).
**Business Rule**: Swagger `GET /bookings` parameters
**Suggested Layer**: API

### TC-308: Bookings can't be edited through the API
**Category**: Negative
**Priority**: P3
**Preconditions**: User has a booking.
**Steps**:
1. Call `PUT` and `PATCH /api/bookings/:id` with `quantity` set to 1 and `totalPrice` set to 1.
2. Read the booking.
**Expected Results**: Both return 404, with `Route PUT ... not found` or the `PATCH` equivalent, and the booking is unchanged.
**Business Rule**: API Ref (no update endpoint); Swagger
**Suggested Layer**: API

### TC-309: Cancel and clear all failures are shown to the user
**Category**: Negative
**Priority**: P2
**Preconditions**: `DELETE /api/bookings` and `DELETE /api/bookings/:id` are mocked to return 500.
**Steps**:
1. Try to cancel from the detail page.
2. Try to clear all from the list page.
**Expected Results**: The UI shows an error and doesn't report success. Bookings stay visible and aren't removed optimistically. **Known issue:** clear all has no `catch`, so its failure will probably show nothing (D-3).
**Business Rule**: Swagger (500 `ErrorResponse`); Flow 4
**Suggested Layer**: Component

### TC-310: A failed booking at the limit keeps all 9 bookings
**Category**: Negative
**Priority**: P0
**Preconditions**: New user has exactly 9 bookings, and a test-created event has 1 seat.
**Steps**:
1. Call `POST /api/bookings` with an event ID that doesn't exist.
2. List bookings.
3. Call `POST /api/bookings` for 5 tickets on the 1-seat event.
4. List bookings.
**Expected Results**: The requests return 404 and 400. The user still has all 9 bookings after each one. **Known issue:** the oldest booking is deleted before the event and seats are checked, so a failed request removes a real booking. The probe showed 9 bookings dropping to 8 (D-8).
**Business Rule**: BR §4 (pruning applies when a booking is added); `bookingService.js:70-92`
**Suggested Layer**: API

### TC-311: List load failure shows a retry option
**Category**: Negative
**Priority**: P2
**Preconditions**: User is logged in. `GET /bookings` is mocked to return 500, then 200 after the retry. Allow for the app's one automatic retry.
**Steps**:
1. Open `/bookings`.
2. Click Retry.
**Expected Results**: "Couldn't load bookings" appears with a Retry button, not the empty state. After Retry, the bookings appear.
**Business Rule**: `app/bookings/page.tsx:72-78`
**Suggested Layer**: Component

### TC-312: A server error on the detail page is described accurately
**Category**: Negative
**Priority**: P2
**Preconditions**: User is logged in. `GET /bookings/:id` is mocked to return 500.
**Steps**:
1. Open `/bookings/:id`.
**Expected Results**: The page indicates a problem loading the booking and doesn't claim the booking doesn't exist. **Known issue:** every error other than 403 shows "Booking not found" (D-5).
**Business Rule**: Swagger (500 `ErrorResponse`); `app/bookings/[id]/page.tsx:118-124`
**Suggested Layer**: Component

---

## Edge Cases

### TC-400: Ninth booking doesn't prune anything
**Category**: Edge Case
**Priority**: P0
**Preconditions**: New user has exactly 8 bookings.
**Steps**:
1. Create a 9th booking.
2. List bookings.
**Expected Results**: All 9 bookings exist, including the oldest.
**Business Rule**: BR §4 (limit boundary)
**Suggested Layer**: API

### TC-401: Cancelling at the limit makes room
**Category**: Edge Case
**Priority**: P1
**Preconditions**: New user has exactly 9 bookings.
**Steps**:
1. Cancel a booking from the middle of the order.
2. Create a new booking.
**Expected Results**: The count is 9. The oldest booking is still there because no pruning was needed.
**Business Rule**: BR §4
**Suggested Layer**: API

### TC-402: Clear all with no bookings
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has no bookings.
**Steps**:
1. Call `DELETE /api/bookings`.
**Expected Results**: 200, with `0 booking(s) cleared`.
**Business Rule**: API Ref; BR §4
**Suggested Layer**: API

### TC-403: Concurrent bookings at the limit
**Category**: Edge Case
**Priority**: P2
**Preconditions**: Two runs with new users, one starting at exactly 9 bookings and one at exactly 8. All existing bookings are on event X.
**Steps**:
1. Send 3 `POST /api/bookings` requests in parallel, on a test-created event Y different from X.
2. List bookings.
**Expected Results**: Every valid request succeeds, and the user ends with no more than 9 bookings. Seat counts agree with the remaining bookings. **Known issue:** there's no transaction, so the run from 8 could end at 11, and the run from 9 could return 404 for valid requests (D-12). The result may be intermittent.
**Business Rule**: BR §4, §6
**Suggested Layer**: API

### TC-404: Concurrent cancels of the same booking
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has a booking for 3 tickets on a dynamic event with 50 seats.
**Steps**:
1. Send 2 `DELETE /api/bookings/:id` requests in parallel.
2. Read the event.
**Expected Results**: One returns 200 and the other 404. `availableSeats` is 50, because seats are calculated and can't be restored twice.
**Business Rule**: Swagger ("atomically restores"); BR §6
**Suggested Layer**: API

### TC-405: Pagination boundaries
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has 9 bookings.
**Steps**:
1. Call `GET /api/bookings` with `limit` set to 1, 9, 100, 0, 101, and -1.
2. Call it with no `limit`.
3. Call it with `page` set to 999, 0, and -1.
**Expected Results**: `limit` values of 1, 9, and 100 return up to that many bookings. With no `limit`, or with `limit=0`, the default of 10 applies. `page=999` returns an empty `data` array, and `page=0` is treated as 1. `limit=101` and `limit=-1` should return a 4xx, per Swagger's range of 1 to 100. **Known issue:** that range isn't enforced, so these will probably be accepted (D-14), and `page=-1` should return a 4xx but will probably return 500 (D-11, OQ-10).
**Business Rule**: Swagger `limit` (default 10, range 1 to 100) and `page` (minimum 1); BR §4
**Suggested Layer**: API

### TC-406: Reference first character for unusual event titles
**Category**: Edge Case
**Priority**: P2
**Preconditions**: `createBooking` runs against stubbed repositories, with event titles "tech talk", "2026 Summit", "#1 Show", "Éclair Fest", and an emoji title.
**Steps**:
1. Create a booking for each title and read `bookingRef`.
**Expected Results**: The first character of the title is used as is, uppercased: `T-`, `2-`, `#-`, and `É-`, each followed by 6 characters. An emoji title produces a broken half-character, so add one API check to see whether MySQL accepts it. `#` must be URL-encoded in a reference lookup.
**Business Rule**: BR §7 (uppercase first letter)
**Suggested Layer**: Unit

### TC-407: Free event and decimal prices
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has events priced at 0 and 19.99.
**Steps**:
1. Book 1 ticket on the free event.
2. Book 3 tickets on the 19.99 event.
3. Read both through the API and on the detail pages.
**Expected Results**: The API returns totals of 0 and 59.97, compared numerically. **Known issue:** the UI rounds to whole dollars, so 59.97 shows as $60 (D-6). Assert the API value and report the UI rounding.
**Business Rule**: BR §9; Event data model (`price` is Decimal, >= 0)
**Suggested Layer**: API

### TC-408: Quantity shown on a booking matches every view
**Category**: Edge Case
**Priority**: P2
**Preconditions**: The booking API is mocked to return a booking with the maximum quantity of 10.
**Steps**:
1. Compare quantity and total on the confirmation card, list card, and detail page.
2. Run the refund check.
**Expected Results**: All views agree, and the refund result says "Group bookings (10 tickets) are non-refundable".
**Business Rule**: Booking data model (quantity 1 to 10); BR §8, §9
**Suggested Layer**: Component

### TC-409: Editing the event price after booking
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has a dynamic event priced at 100 and a booking for 2 tickets.
**Steps**:
1. Change the event price to 200 with `PUT /api/events/:id`. The request needs the full event body with a future date, because `PUT` uses the create validator.
2. Read the booking.
**Expected Results**: `totalPrice` stays 200. The detail page shows the event's current price per ticket beside the stored total, so the two can disagree.
**Business Rule**: Booking data model (stored `totalPrice`); BR §9
**Suggested Layer**: API

### TC-410: References stay unique across repeat bookings
**Category**: Edge Case
**Priority**: P2
**Preconditions**: `createBooking` runs against stubbed repositories, with `findByRef` stubbed to control collisions.
**Steps**:
1. Create 9 bookings with no collisions and compare the references.
2. Stub `findByRef` to report a collision once, then create a booking.
3. Stub it to report a collision every time, then create a booking.
**Expected Results**: References are all different and match the format. A single collision triggers a retry and a new reference. After 10 attempts, a fallback code is used. **Known issue:** that fallback has 8 characters, not the documented 6 (`bookingService.js:30-31`).
**Business Rule**: BR §7 ("guaranteed unique via collision retry")
**Suggested Layer**: Unit

### TC-411: One user's pruning doesn't affect another user
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User A has 9 bookings on a static event, and User B has 3 on the same event. A also has a dynamic event of their own.
**Steps**:
1. As A, create a 10th booking on A's own dynamic event. **Don't use the static event,** or this test triggers D-9 on shared data.
2. As B, list bookings.
**Expected Results**: A's oldest booking is removed. All of B's bookings remain, even if one is older than all of A's.
**Business Rule**: BR §2, §4 ("per user")
**Suggested Layer**: API

### TC-412: Leaving the page during the refund spinner
**Category**: Edge Case
**Priority**: P3
**Preconditions**: User is on a booking's detail page.
**Steps**:
1. Start the refund check.
2. Navigate to `/bookings` before 4 seconds pass.
3. Open a different booking's detail page.
**Expected Results**: No errors appear in the console. The earlier result doesn't appear on the second booking's page.
**Business Rule**: BR §8
**Suggested Layer**: Component

### TC-413: Clear all resets the FIFO count
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has 9 bookings.
**Steps**:
1. Clear all bookings.
2. Create 9 new bookings.
**Expected Results**: All 9 new bookings exist and none is pruned.
**Business Rule**: BR §4
**Suggested Layer**: API

### TC-414: Reference lookup with altered formatting
**Category**: Edge Case
**Priority**: P3
**Preconditions**: User has a booking with a known reference.
**Steps**:
1. Call `GET /api/bookings/ref/:ref` with the reference in lowercase.
2. Call it with URL-encoded surrounding spaces.
**Expected Results**: Lowercase should match, because the table uses `utf8mb4_unicode_ci`, and trailing spaces may match too. Either way, it must return only the caller's own booking or a 404, never a 500.
**Business Rule**: Swagger `/bookings/ref/{ref}`; BR §2, §7
**Suggested Layer**: API

---

## UI State

### TC-500: Empty bookings page
**Category**: UI State
**Priority**: P1
**Preconditions**: User is logged in. `GET /bookings` is mocked to return no bookings.
**Steps**:
1. Open `/bookings`.
**Expected Results**: The title is "No bookings yet", with a Browse Events link. There are no booking cards and no clear all control. **Known issue:** the control always renders in the local source, which contradicts `ui-selectors.md` (D-7).
**Business Rule**: UI Selectors (clear all is "visible at top when bookings exist")
**Suggested Layer**: Component

### TC-501: Banner is hidden with few bookings
**Category**: UI State
**Priority**: P2
**Preconditions**: The booking API is mocked to return 1 booking. First check whether the deployed site has this banner at all (OQ-9).
**Steps**:
1. Open `/bookings`.
**Expected Results**: The sandbox banner isn't visible. If the deployed site has no banner at any count, report it and mark this test `test.fixme`.
**Business Rule**: BR §5
**Suggested Layer**: Component

### TC-502: Banner appears near the limit
**Category**: UI State
**Priority**: P2
**Preconditions**: The booking API is mocked to return 9 bookings. First check whether the deployed site has this banner at all (OQ-9).
**Steps**:
1. Open `/bookings`.
2. Lower the mocked count one at a time to find the threshold.
**Expected Results**: The banner is visible at 9 and mentions the sandbox limit. Record the threshold and assert the boundary once it's confirmed. **Known issue:** the local source has no banner on this page (D-7). If the deployed site doesn't either, report it and mark this test `test.fixme`.
**Business Rule**: BR §5
**Suggested Layer**: Component

### TC-503: Refund spinner timing
**Category**: UI State
**Priority**: P1
**Preconditions**: User is on a booking's detail page.
**Steps**:
1. Install `page.clock`.
2. Click `#check-refund-btn`.
3. Fast-forward just under 4 seconds, then past 4 seconds.
**Expected Results**: The spinner appears straight away and the result stays hidden. After about 4 seconds, the spinner disappears and the result appears.
**Business Rule**: BR §8
**Suggested Layer**: Component

### TC-504: Repeated clicks on the refund button
**Category**: UI State
**Priority**: P3
**Preconditions**: User is on a booking's detail page.
**Steps**:
1. Click `#check-refund-btn` once.
2. Check that the button has gone while checking and after the result appears.
**Expected Results**: The button is removed when checking starts and doesn't return. Only one spinner and one result are ever shown, and a second check isn't possible.
**Business Rule**: BR §8
**Suggested Layer**: Component

### TC-505: List shows 9 cards after pruning
**Category**: UI State
**Priority**: P2
**Preconditions**: The booking API is mocked to return 9 bookings. TC-102 proves the pruning itself.
**Steps**:
1. Open `/bookings`.
**Expected Results**: Exactly 9 cards are shown, and no pagination controls lead to another page.
**Business Rule**: BR §4 ("shows max 9 bookings")
**Suggested Layer**: Component

### TC-506: List updates after cancel and clear all without a manual reload
**Category**: UI State
**Priority**: P2
**Preconditions**: User has 3 bookings.
**Steps**:
1. Cancel a booking and return to `/bookings` without reloading.
2. Clear all without reloading.
**Expected Results**: The list shows the current bookings after each action. After clear all, the empty state appears. **Known issue:** clear all doesn't refresh event data, so seat counts on event pages can be stale for up to 30 seconds (D-4).
**Business Rule**: BR §4; Tech stack (React Query)
**Suggested Layer**: Component

### TC-507: Loading states on the list and detail pages
**Category**: UI State
**Priority**: P3
**Preconditions**: Booking API responses are delayed with a mock.
**Steps**:
1. Open `/bookings`.
2. Open `/bookings/:id`.
**Expected Results**: While loading, neither page shows the empty state, a not-found message, or Access Denied. Those appear only after the response confirms them.
**Business Rule**: Tech stack (React Query); Flow 4
**Suggested Layer**: Component

### TC-508: Declining a confirmation sends no delete request
**Category**: UI State
**Priority**: P1
**Preconditions**: User is logged in. The booking API is mocked, and the test records delete requests.
**Steps**:
1. On a card, click `cancel-booking-btn`, then click Cancel in the dialog.
2. On a detail page, click Cancel Booking, then click Cancel in the dialog.
3. On the list, click Clear all bookings and dismiss the native dialog.
**Expected Results**: No delete request is sent, and all bookings stay visible.
**Business Rule**: `app/bookings/page.tsx:28`; `ConfirmDialog.jsx:20`
**Suggested Layer**: Component
