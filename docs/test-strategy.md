# EventHub Test Strategy: Booking Management

**Input:** the original 83 booking-management scenarios in `docs/test-scenarios.md`. The 28 event-creation scenarios appended under "Event Creation" are not included in this strategy's layer allocation or test-file mapping.

## Summary

- **Layer split:** 46 API, 25 Component, 7 E2E, 4 Unit, and 1 deferred.
- **Layer changes:** 14 of the original 72 scenarios changed layer, and the scenario file now reflects this. 7 moved from E2E to Component, 4 from API to Unit, 2 from Unit to Component, and 1 is deferred. The 11 scenarios added from the source are 5 API and 6 Component.
- **Defects:** 3 booking logic defects are confirmed in the real service code (D-8, D-9, D-10). 10 more are likely or conditional, including possible cross-user data exposure (D-1), and the docs are out of date in several places (D-14).
- **Test safety rule:** never let a test overflow the 9-booking limit on a static event on the deployed site. It permanently removes seats for every user (D-9).

## Evidence used

| Source | Status | What it means |
|---|---|---|
| `frontend/` | Read | UI decisions cite real code. |
| `backend/` | Read | API and Unit decisions cite real functions. |
| Service probe | **Run** | Ran the real `bookingService`, `eventService`, repositories, and `authMiddleware` against an in-memory stand-in for Prisma. It proves the logic, not database behaviour. |
| Prisma probe | **Inconclusive** | Bad values sent to Prisma with no database failed at connection before validation, even an obviously invalid filter. It says nothing about how bad input is handled. |
| Real database | Not run | Nothing ran against MySQL. Decimal handling, collation, and concurrency are predictions from reading the code. |
| Deployed app | Not run | The tests target the deployed site, which may differ from the local source. |
| Existing tests | Read | The only test is `tests/login.spec.ts`, which covers a different site. |

`backend/` and `frontend/` are at the workspace root, not under `eventhub/` as `CLAUDE.md` says.

## Distribution

Each scenario is counted once, at its primary layer. Times are rough estimates, not measurements.

| Layer | Count | Focus | Estimated time |
|---|---|---|---|
| Unit | 4 | Auth middleware and reference generation, plus the extra checks listed below | Under 5 s |
| API | 46 | Business rules, API contract, access control | About 1 to 2 min |
| Component (mocked browser) | 25 | Single-page UI states and refund logic | About 1 min |
| E2E | 7 | Critical multi-page journeys | About 2 to 3 min |
| Deferred | 1 | TC-113, which needs database access | None |
| **Total** | **83** | | **About 5 min** |

**This still isn't a wide-bottomed pyramid by scenario count**, because most scenarios describe behaviour through the API. The Unit layer gets wider through about 10 extra fast checks on critical logic (see "Rules tested at more than one layer").

## How each layer runs

| Layer | Tooling | Target |
|---|---|---|
| Unit | Node's built-in `node:test`, replacing `src/config/database.js` with a stub | Local `backend/` code |
| API | Playwright `request` fixture | `https://api.eventhub.rahulshettyacademy.com/api` |
| Component | Playwright browser with `page.route` mocks, as in best practices §6 | Frontend pages with all API calls mocked |
| E2E | Playwright browser with no mocks, using the API for setup | `https://eventhub.rahulshettyacademy.com` |

- **Unit:** the service probe showed this works with no product code changes and no new dependencies. Set `JWT_SECRET` to a test value, and don't run from `backend/`, so `backend/.env` isn't loaded.
- **Component:** the mocks must cover `GET /auth/me`, because `AuthGuard` and `useAuth` block the page until it responds, and must set `eventhub_token` in localStorage first.

## Prerequisites for `/generate-tests`

1. **Add a separate Playwright config.** The root `playwright.config.ts` points at `rahulshettyacademy.com`. I recommend `playwright.eventhub.config.ts` with `testDir: './tests/eventhub'`.
2. **Choose TypeScript** for Playwright tests to match the root project. Unit tests are plain JavaScript because they load CommonJS backend modules.
3. **Register a fresh user per test** for anything destructive. This adds test accounts to the shared deployed site on each run, so consider running the backend locally.
4. **Use only events the test creates for overflow tests** (D-9).
5. **Create at most 6 events per user.** A 7th deletes the oldest event and its bookings (`eventService.js:51-54`), which would break test setup without any obvious error.
6. **Create bookings one at a time** when order matters. Pruning order depends on `createdAt`, with no tiebreaker.
7. **Keep credentials out of spec files.** Read them from environment variables, even though best practices §5 shows them as constants.

## Layer assignments

Paths are shortened: `bookingService.js` and `eventService.js` are in `backend/src/services/`, and frontend paths are relative to `frontend/`.

### Unit (4)

| ID | Scenario | Priority | Source |
|---|---|---|---|
| TC-207 | Malformed or tampered tokens are rejected | P1 | `backend/src/middleware/authMiddleware.js:4-15` |
| TC-208 | Expired token is rejected | P2 | `backend/src/middleware/authMiddleware.js:9-14` |
| TC-406 | Reference first character for unusual event titles | P2 | `randomRef`, `bookingService.js:11-18` |
| TC-410 | References stay unique across repeat bookings | P2 | `generateUniqueRef`, `bookingService.js:21-32` |

### API (46)

| ID | Scenario | Priority | Endpoint | Function |
|---|---|---|---|---|
| TC-003 | Look up a booking by reference | P1 | `GET /bookings/ref/:ref` | `getBookingByRef` |
| TC-007 | Filter bookings by event | P2 | `GET /bookings?eventId=` | `findAll` |
| TC-100 | Reference matches the format and the event title | P0 | `POST /bookings`, `GET /bookings/:id` | `randomRef` |
| TC-101 | Total price equals ticket price times quantity | P0 | `POST /bookings` | `createBooking` |
| TC-102 | Tenth booking removes only the oldest | P0 | `POST /bookings` | `createBooking` |
| TC-103 | Repeated overflow removes bookings in creation order | P1 | `POST /bookings` | `findOldestUserBookingExcludingEvent` |
| TC-104 | Cancelling frees seats on a dynamic event | P0 | `DELETE /bookings/:id`, `GET /events/:id` | `cancelBooking`, `withPersonalSeats` |
| TC-105 | Clear all frees seats across dynamic events | P1 | `DELETE /bookings`, `GET /events/:id` | `clearAllBookings`, `withPersonalSeats` |
| TC-106 | Cancelling a static event booking | P1 | `DELETE /bookings/:id`, `GET /events/:id` | `cancelBooking`, `withPersonalSeats` |
| TC-107 | FIFO pruning releases the pruned booking's seats | P1 | `POST /bookings`, `GET /events/:id` | `createBooking`, `withPersonalSeats` |
| TC-108 | Repeat bookings on the same event are separate | P1 | `POST /bookings` | `createBooking` |
| TC-112 | Deleting an event removes its bookings | P1 | `DELETE /events/:id` | `deleteEvent`, `schema.prisma:55` |
| TC-114 | Cancelled booking is permanently removed | P1 | `DELETE /bookings/:id` | `cancelBooking` |
| TC-115 | Sold-out event can be booked again after a cancellation | P1 | `POST /bookings`, `DELETE /bookings/:id` | `createBooking`, `cancelBooking` |
| TC-116 | Tenth booking on the oldest booking's event | P1 | `POST /bookings` | `findOldestUserBookingExcludingEvent` |
| TC-117 | Overflow on one event doesn't permanently remove seats | P1 | `POST /bookings`, `DELETE /bookings`, `GET /events/:id` | `createBooking`, `decrementSeats` |
| TC-118 | Booking a static event doesn't change another user's seat count | P1 | `POST /bookings`, `GET /events/:id` | `withPersonalSeats` |
| TC-119 | Creating a 7th event removes the oldest event's bookings | P2 | `POST /events`, `GET /bookings/:id` | `createEvent`, `schema.prisma:55` |
| TC-200 | Cross-user booking read is denied | P0 | `GET /bookings/:id` | `getBookingById` |
| TC-202 | Cross-user cancellation is denied | P0 | `DELETE /bookings/:id` | `cancelBooking` |
| TC-203 | Cross-user reference lookup is denied | P0 | `GET /bookings/ref/:ref` | `getBookingByRef` |
| TC-204 | List never includes another user's bookings | P0 | `GET /bookings` | `findAll` |
| TC-205 | Clear all affects only the caller's bookings | P0 | `DELETE /bookings` | `deleteAllForUser` |
| TC-206 | Booking endpoints require a token | P0 | All 6 booking endpoints | `bookingRoutes.js:8` |
| TC-210 | Create request can't set server-controlled fields | P1 | `POST /bookings` | `createBooking` |
| TC-211 | Can't book another user's dynamic event | P1 | `POST /bookings` | `eventRepository.findById` |
| TC-213 | Injection strings in lookups are handled safely | P2 | `GET /bookings/ref/:ref`, `GET /bookings?status=` | `findByRef`, `findAll` |
| TC-300 | Read a booking that doesn't exist | P1 | `GET /bookings/:id` | `getBookingById` |
| TC-301 | Cancel a booking that doesn't exist | P1 | `DELETE /bookings/:id` | `cancelBooking` |
| TC-302 | Cancel the same booking twice | P1 | `DELETE /bookings/:id` | `cancelBooking` |
| TC-303 | Look up a reference that doesn't exist | P1 | `GET /bookings/ref/:ref` | `getBookingByRef` |
| TC-304 | Invalid booking IDs | P2 | `GET` and `DELETE /bookings/:id` | `findByIdOnly`, `findById` |
| TC-307 | Invalid list query parameters | P2 | `GET /bookings` | `findAll` |
| TC-308 | Bookings can't be edited through the API | P3 | `PUT` and `PATCH /bookings/:id` | No route, `app.js:103-105` |
| TC-310 | A failed booking at the limit keeps all 9 bookings | P0 | `POST /bookings` | `createBooking` |
| TC-400 | Ninth booking doesn't prune anything | P0 | `POST /bookings` | `createBooking` |
| TC-401 | Cancelling at the limit makes room | P1 | `DELETE /bookings/:id`, `POST /bookings` | `countUserBookings` |
| TC-402 | Clear all with no bookings | P2 | `DELETE /bookings` | `clearAllBookings` |
| TC-403 | Concurrent bookings at the limit | P2 | `POST /bookings` | `createBooking` |
| TC-404 | Concurrent cancels of the same booking | P2 | `DELETE /bookings/:id` | `cancelBooking` |
| TC-405 | Pagination boundaries | P2 | `GET /bookings?page=&limit=` | `getBookings` |
| TC-407 | Free event and decimal prices | P2 | `POST /bookings` | `createBooking` |
| TC-409 | Editing the event price after booking | P2 | `PUT /events/:id`, `GET /bookings/:id` | `updateEvent` |
| TC-411 | One user's pruning doesn't affect another user | P1 | `POST /bookings` | `countUserBookings` |
| TC-413 | Clear all resets the FIFO count | P2 | `DELETE /bookings`, `POST /bookings` | `clearAllBookings` |
| TC-414 | Reference lookup with altered formatting | P3 | `GET /bookings/ref/:ref` | `findByRef` |

### Component (25)

| ID | Scenario | Priority | Source |
|---|---|---|---|
| TC-001 | View list of own bookings | P0 | `app/bookings/page.tsx:94-98`, `BookingCard.jsx:44` |
| TC-009 | Cancel a booking from a list card | P1 | `BookingCard.jsx:35-40`, `:83` |
| TC-010 | Manage bookings from the admin page | P2 | `app/admin/bookings/page.tsx:14-18`, `:162-168` |
| TC-109 | Single-ticket booking is eligible for a refund | P1 | `app/bookings/[id]/page.tsx:27`, `:52-59` |
| TC-110 | Group booking is not eligible for a refund | P1 | `app/bookings/[id]/page.tsx:27`, `:61-68` |
| TC-111 | Refund check makes no backend call and changes nothing | P2 | `app/bookings/[id]/page.tsx:24-29` |
| TC-209 | Logged-out user can't view booking pages | P1 | `components/auth/AuthGuard.tsx:16-20`, `:30-32` |
| TC-212 | Script in customer fields doesn't execute | P2 | `app/bookings/[id]/page.tsx:183-185` |
| TC-215 | A 401 during a session logs the user out | P1 | `lib/api/client.js:28-31` |
| TC-305 | Open the page of a booking that doesn't exist | P2 | `app/bookings/[id]/page.tsx:118-129` |
| TC-306 | Reopen the page of a cancelled booking | P2 | `lib/hooks/useBookings.ts:16`, `:39-42` |
| TC-309 | Cancel and clear all failures are shown to the user | P2 | `app/bookings/page.tsx:27-36`, `app/bookings/[id]/page.tsx:107-110` |
| TC-311 | List load failure shows a retry option | P2 | `app/bookings/page.tsx:72-78` |
| TC-312 | A server error on the detail page is described accurately | P2 | `app/bookings/[id]/page.tsx:118-124` |
| TC-408 | Quantity shown on a booking matches every view | P2 | `BookingCard.jsx:66`, `app/bookings/[id]/page.tsx:190`, `app/events/[id]/page.tsx:40` |
| TC-412 | Leaving the page during the refund spinner | P3 | `app/bookings/[id]/page.tsx:24-29` |
| TC-500 | Empty bookings page | P1 | `app/bookings/page.tsx:80-92` |
| TC-501 | Banner is hidden with few bookings | P2 | `app/bookings/page.tsx` (no banner found) |
| TC-502 | Banner appears near the limit | P2 | `app/bookings/page.tsx` (no banner found) |
| TC-503 | Refund spinner timing | P1 | `app/bookings/[id]/page.tsx:26-28`, `:45-50` |
| TC-504 | Repeated clicks on the refund button | P3 | `app/bookings/[id]/page.tsx:35-43` |
| TC-505 | List shows 9 cards after pruning | P2 | `app/bookings/page.tsx:22-25`, `:97` |
| TC-506 | List updates after cancel and clear all without a manual reload | P2 | `app/bookings/page.tsx:32`, `lib/hooks/useBookings.ts:39-42` |
| TC-507 | Loading states on the list and detail pages | P3 | `app/bookings/page.tsx:66-70`, `app/bookings/[id]/page.tsx:114-116` |
| TC-508 | Declining a confirmation sends no delete request | P1 | `app/bookings/page.tsx:28`, `ConfirmDialog.jsx:20` |

### E2E (7)

| ID | Scenario | Priority | Source |
|---|---|---|---|
| TC-002 | Open booking details from the list | P0 | `BookingCard.jsx:79-81`, `app/bookings/[id]/page.tsx:143-213` |
| TC-004 | Cancel a booking from the detail page | P0 | `app/bookings/[id]/page.tsx:101-112`, `:215-223` |
| TC-005 | Clear all bookings | P0 | `app/bookings/page.tsx:27-36`, `lib/api/bookings.ts:25-26` |
| TC-006 | Reach the new booking from the confirmation card | P1 | `app/events/[id]/page.tsx:40`, `:49` |
| TC-008 | Check refund eligibility from the detail page | P1 | `app/bookings/[id]/page.tsx:21-29` |
| TC-201 | Cross-user booking page shows Access Denied | P0 | `app/bookings/[id]/page.tsx:118-129` |
| TC-214 | Switching users doesn't show the previous user's bookings | **P0, raised from P1** | `lib/hooks/useBookings.ts:9`, `lib/hooks/useAuth.tsx:63-68`, `lib/providers.jsx:14` |

### Deferred (1)

| ID | Scenario | Priority | Why |
|---|---|---|---|
| TC-113 | Deleting a user removes their bookings | P3 | `authRoutes.js` has no delete route, so this needs a local database. The cascade is declared at `schema.prisma:38` and `:56`, so the risk is low. |

## Decision rationale

### Layer changes from the original suggestions

| ID | Was | Now | Why |
|---|---|---|---|
| TC-001 | E2E | Component | Rendering a list is one page. TC-002 and TC-006 exercise real list data. |
| TC-209 | E2E | Component | `AuthGuard` redirects with no token, so no backend is involved. |
| TC-212 | E2E | Component | The validator only checks length, so the payload reaches the UI unchanged, and a mock can supply it. `dangerouslySetInnerHTML` and `innerHTML` don't appear in `app/` or `components/`, so this is a regression guard. |
| TC-305 | E2E | Component | One page reacting to a 404, which TC-300 verifies at the API layer. |
| TC-306 | E2E | Component | The mock can return 200, then 404, which is enough to expose the stale cache in D-2. |
| TC-408 | E2E | Component | TC-101 covers correct values. This only checks that each view displays them. |
| TC-505 | E2E | Component | TC-102 proves the pruning. This only checks that 9 cards render. |
| TC-109, TC-110 | Unit | Component | See "Why the refund rule isn't a Unit test". |
| TC-207, TC-208 | API | Unit | `authMiddleware` needs no database, and the service probe already ran these cases. TC-208 can't run on the deployed site anyway, because a test can't sign an expired token without its secret. TC-206 proves the middleware is attached to the routes. |
| TC-406, TC-410 | API | Unit | Reference generation is pure logic. Collision retry can only be triggered by stubbing, so an API test wouldn't exercise it. |
| TC-113 | API | Deferred | No endpoint exists to call. |

### Contested decisions

**Why the refund rule isn't a Unit test.** It's a textbook unit test, but it's written inline as `quantity === 1` inside a component that isn't exported (`app/bookings/[id]/page.tsx:21-29`), and `node:test` can't render a `.tsx` page. Extracting it means changing product code, so that should be your decision. Until then, mocked-browser tests cover quantities 1, 2, and 10. `page.clock` skips the 4-second wait.

**Why FIFO and price rules stay at API when the logic could be unit tested.** The service probe shows they can run at Unit, which is where the rule says to push them. But Unit tests run the local code, while the API tests prove what the deployed site does. These are P0 rules, so they run at both layers, with API as the primary.

**Why TC-008 stays at E2E when its logic is tested lower down.** TC-109 and TC-110 use mocked data, so they wouldn't notice if the real API's `quantity` field changed shape. One real run covers that risk, at the cost of 4 seconds.

**Why TC-201 stays at E2E when TC-200 covers the 403.** TC-200 proves the API denies access, but not that the page hides the data. Cross-user access is also a documented P0 flow (Flow 6) that deserves one test with no mocks.

**Why TC-214 stays at E2E and moves up to P0.** A mock could reproduce the cache behaviour, but this is possible cross-user data exposure, so it should be proven against real accounts. See TC-214: a test using `page.goto` would pass even if the bug exists.

**Why TC-005 stays at E2E.** TC-105 and TC-205 cover the backend. Only a real run shows the native `confirm()` dialog, the call through a different API client (`lib/api/bookings.ts`), and the refetch working together.

### Rules tested at more than one layer

The Unit column includes the extra fast checks, which use the same scenario IDs.

| Critical rule | Unit | API | Component | E2E |
|---|---|---|---|---|
| Cross-user isolation | TC-202, TC-203 | TC-200, TC-202, TC-203, TC-204, TC-205, TC-118 | | TC-201, TC-214 |
| Authentication required | TC-207, TC-208 | TC-206 | TC-209, TC-215 | |
| Cancelling frees seats | TC-104 | TC-104, TC-302, TC-404 | | TC-004 |
| Clear all | | TC-105, TC-205, TC-402 | TC-309, TC-506 | TC-005 |
| FIFO limit of 9 | TC-102, TC-103, TC-400, TC-401, TC-116, TC-117, TC-310 | TC-102, TC-103, TC-116, TC-117, TC-310, TC-400, TC-401, TC-411 | TC-505 | |
| Reference format | TC-100, TC-406, TC-410 | TC-100 | | TC-006 |
| Price calculation | TC-101 | TC-101, TC-407 | TC-408 | |
| Refund eligibility | | | TC-109, TC-110, TC-503 | TC-008 |

## Defects

If a test confirms one of these, **report it as an app bug and don't change the test to match.**

**Status key:** *Confirmed* means the service probe ran the real code and showed it. *Likely* means it comes from reading the code and hasn't been run.

| ID | Severity | Status | Finding | Evidence | Test |
|---|---|---|---|---|---|
| D-8 | **High** | Confirmed | **A failed booking can delete a real one.** At the limit, the oldest booking is deleted before the event and seats are checked. In the probe, a request for an unknown event returned an error, and the user went from 9 bookings to 8. Too many seats had the same effect. | `bookingService.js:70-79` runs before `:82-92` | TC-310 |
| D-1 | **High** | Likely | User B may see User A's bookings for up to 30 seconds after A logs out and B logs in on the same tab. Query keys don't include the user, logout doesn't clear the cache, and login navigates without a page reload. | `useBookings.ts:9`, `useAuth.tsx:47-53`, `:63-68`, `providers.jsx:14` | TC-214 |
| D-13 | **High if it applies** | Unknown | `JWT_SECRET` falls back to a hard-coded value. If the deployed site doesn't set it, anyone could forge a token for any user. A test shouldn't forge tokens against the live site, so the site's owner needs to check this. | `backend/src/config/env.js:8` | Manual check |
| D-9 | Medium to high | Confirmed | **Overflowing on the same event permanently removes seats.** When all 9 bookings are on one event, a 10th on that event reduces the event's shared seat count. In the probe, another user's view of a static event dropped from 500 to 490, and on a dynamic event a seat stayed lost after clear all (49 of 50). A code comment shows it's deliberate, but it breaks user isolation (BR §2) and nothing restores the seats. | `bookingService.js:94-97` | TC-117 |
| D-10 | Medium | Confirmed | **FIFO doesn't always remove the oldest booking.** It skips bookings on the new booking's event, so the oldest can survive. This contradicts BR §4. It looks deliberate, so either the rule or the code needs changing. | `bookingService.js:73-74` | TC-116 |
| D-2 | Medium | Likely | A cancelled booking's page can still show it as active, with a working Cancel button. Cancelling invalidates `['bookings']`, which doesn't match the detail page's `['booking', id]` key. | `useBookings.ts:16`, `:39-42` | TC-306 |
| D-3 | Medium | Likely | A failed clear all shows no error. The handler has `try/finally` with no `catch`. | `app/bookings/page.tsx:30-35` | TC-309 |
| D-4 | Medium | Likely | Clear all doesn't invalidate `['events']` as cancelling does, so seat counts on event pages can be stale for up to 30 seconds. | `app/bookings/page.tsx:32`, `useBookings.ts:39-42` | TC-506 |
| D-11 | Medium | Likely | Booking IDs and list parameters aren't validated. Values like `abc`, `1.5`, `?eventId=abc`, and `?page=-1` probably return 500, because `errorHandler` doesn't map Prisma validation errors. The Prisma probe couldn't confirm this. | `bookingRoutes.js:148`, `:240`, `:369`, `bookingRepository.js:8-11`, `:37`, `errorHandler.js:61-66` | TC-304, TC-307, TC-405 |
| D-12 | Medium | Likely | The limit isn't safe under concurrency, because there's no transaction. Parallel requests starting from 8 bookings could all see 8 and end at 11. Parallel requests at 9 could delete the same booking, so a valid request gets a 404. | `bookingService.js:70-79`, `errorHandler.js:44-50` | TC-403 |
| D-5 | Low | Likely | Any detail page error other than 403, including a 500 or network failure, shows "Booking not found". | `app/bookings/[id]/page.tsx:118-124` | TC-312 |
| D-6 | Low | Likely | Prices display rounded to whole dollars, so a $59.97 total shows as $60. | `app/bookings/[id]/page.tsx:17-18`, `BookingCard.jsx:11`, `app/admin/bookings/page.tsx:22-23` | TC-407 |
| D-7 | Low | Likely | The bookings page has no sandbox banner (BR §5), and clear all shows even with no bookings (`ui-selectors.md`). | `app/bookings/page.tsx:55-61`; banner only at `app/events/page.tsx:81` | TC-500, TC-501, TC-502 |
| D-14 | Low | Confirmed by reading | The docs are out of date. Swagger shows `EVT-` references, atomic seat updates, a `cancelled` status, and a 1 to 100 `limit`, omits 401 and 403, and doesn't list `DELETE /bookings`. The domain docs say cross-user cancel returns 403 (it returns 404), and BR §6 says static seats are fixed (they're computed per user). Editing `totalSeats` also doesn't change `availableSeats` (`eventService.js:87`). | `bookingRoutes.js:45`, `:254-255`, `:331-332`, `:321`; `eventService.js:6-18` | Update docs |

## Open questions from the scenarios

| Question | Answer |
|---|---|
| OQ-1: Reference format | **Resolved:** the title's first character, then 6 random characters. Swagger is out of date. |
| OQ-2: Static seats after a cancel | **Resolved:** the caller's count goes back up. The stored value never changes. |
| OQ-3: Seats after pruning | **Resolved:** released, except in the same-event overflow (D-9). |
| OQ-4: Deleted or `cancelled` | **Resolved:** permanently deleted. Nothing ever sets `cancelled`, so the UI's handling of it never runs. |
| OQ-5: Access responses | **Resolved:** 401 with no token or a bad token. Cross-user read by ID or reference returns 403, cross-user cancel returns 404, and booking another user's event returns 404. |
| OQ-6: Logged-out, missing, and empty UI | **Resolved:** `AuthGuard` redirects to `/login`. A missing booking shows "Booking not found", and an empty list shows "No bookings yet". |
| OQ-7: Clear all response | **Resolved:** 200 with `N booking(s) cleared`, including when N is 0. |
| OQ-8: Confirmation and landing page | **Resolved:** cancel uses an in-page dialog, then shows a toast and redirects to `/bookings`. Clear all uses a native browser dialog and stays on the page. |
| OQ-9: Banner threshold | **Changed:** no banner in the local source, so check the deployed site. |
| OQ-10: Invalid values | **Partly resolved:** see TC-304, TC-307, and TC-405. Whether Prisma errors become 500s needs a real run. |
| OQ-11: Price edits | **Resolved:** the stored total doesn't change. |

## Anti-patterns

### In existing tests

There's only one test file, and it doesn't cover EventHub.

| Finding | Location | Fix |
|---|---|---|
| No EventHub tests, so critical booking flows have no coverage at any layer | `tests/` | This strategy |
| Plaintext password in the spec | `tests/login.spec.ts:11` | Read it from an environment variable, and rotate it if the file is ever shared |
| Absolute URL even though `baseURL` is set | `tests/login.spec.ts:13` | `toHaveURL('/angularpractice/shop')` |
| All tests are E2E (1 of 1) | `tests/` | A one-test suite is too small to judge, but don't let EventHub follow that shape |

The other anti-patterns on the checklist (validation, API error codes, or pure logic tested at E2E) don't appear in the existing test.

### To avoid when generating tests

| Source | Problem | Do this instead |
|---|---|---|
| `ui-selectors.md`: `#booking-card` | The ID repeats on every card (`BookingCard.jsx:44`), as do `#booking-id` and `#cancel-booking-btn` | `getByTestId('booking-card')` |
| `ui-selectors.md`: clear all "link" | It's a button | `getByRole('button', { name: 'Clear all bookings' })` |
| Best practices §4: `expect(await locator.count())` | The assertion doesn't retry, so it can be flaky | `await expect(locator).toHaveCount(n)` |
| Best practices §9: `waitUntil: 'networkidle'` | Playwright discourages it, and it's unreliable | Web-first assertions |
| Best practices §5: credentials as constants | Credentials end up in source files | Environment variables |

## Recommended test files

| File | Scenarios |
|---|---|
| `tests/eventhub/unit/auth-middleware.test.js` | TC-207, 208 |
| `tests/eventhub/unit/booking-service.test.js` | TC-406, 410, plus the extra Unit checks |
| `tests/eventhub/api/booking-lifecycle.spec.ts` | TC-003, 007, 100, 101, 104 to 106, 108, 112, 114, 115, 118, 300 to 304, 307, 308, 402, 404, 405, 407, 409, 414 |
| `tests/eventhub/api/booking-fifo.spec.ts` | TC-102, 103, 107, 116, 117, 119, 310, 400, 401, 403, 411, 413 |
| `tests/eventhub/api/booking-security.spec.ts` | TC-200, 202 to 206, 210, 211, 213 |
| `tests/eventhub/ui/booking-list.spec.ts` | TC-001, 009, 010, 309, 311, 408, 500 to 502, 505 to 508 |
| `tests/eventhub/ui/booking-detail.spec.ts` | TC-209, 212, 215, 305, 306, 312, 412 |
| `tests/eventhub/ui/booking-refund.spec.ts` | TC-109 to 111, 503, 504 |
| `tests/eventhub/e2e/booking-journeys.spec.ts` | TC-002, 004 to 006, 008 |
| `tests/eventhub/e2e/booking-isolation.spec.ts` | TC-201, 214 |

Keep the `.test.js` Unit files out of Playwright's `testMatch` and run them with `node --test`.

## Suggested build order

1. **Unit tests for FIFO and auth:** they're the fastest to write, need no site access, and lock in D-8, D-9, and D-10.
2. **P0 API tests, including TC-310:** these show whether the deployed site has the same behaviour.
3. **TC-214 and TC-201:** confirm or rule out D-1.
4. **Remaining E2E journeys.**
5. **Component tests:** these need the shared mock and auth helpers first.
6. **Remaining API tests at P1 to P3.**
