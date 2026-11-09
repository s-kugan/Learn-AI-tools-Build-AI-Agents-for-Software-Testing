# Test Code Review

> **Status:** the fixes below have been applied, except item 9, which needs the developers. Scores and line numbers describe the code as reviewed, before the fixes. The API helpers are now in `tests/eventhub/helpers/eventhubApi.ts`.

**Reviewed:** all of `tests/**/*.spec.ts`, their page objects, and the Playwright settings in `playwright.config.ts`.

**Standard:** the `playwright-best-practices` skill. "BP §n" means section n of that skill.

| File | Score | Critical | Important | Suggestion |
|---|---|---|---|---|
| `tests/eventhub/e2e/booking-journeys.spec.ts` | **8/10** | 0 | 3 | 4 |
| `tests/login.spec.ts` | **8/10** | 0 | 0 | 3 |
| `playwright.config.ts` | Not scored | 0 | 1 | 0 |

**How this was checked:**

- Every EventHub selector was checked against `frontend/` source.
- Both specs passed in earlier or current runs: `booking-journeys.spec.ts` 12 of 12 with two workers, and `login.spec.ts` 1 of 1 during this review.
- `login.spec.ts` targets an external site with no source here, so its selectors are proven only by the passing run.
- The specs were not type-checked, because the project has no `tsconfig.json` or TypeScript compiler.

---

## `tests/eventhub/e2e/booking-journeys.spec.ts`

Includes `pages/eventhub/EventHubLoginPage.ts`, `BookingsPage.ts`, and `BookingDetailPage.ts`.

### What's Good

- **Isolation:** each test registers its own user and books only events it creates, so tests share no state (BP §11) and static events stay safe.
- **Page objects:** locators and actions are in page classes, and all assertions are in the spec (BP §5).
- **Waiting:** there are no `waitForTimeout` calls, and assertions auto-wait (BP §9).
- **Data:** IDs and references come from the API at run time, never hard-coded (BP §11). `faker` and `moment` are used as required (BP §8).
- **Backend checks:** TC-004 and TC-005 confirm the result through the API as well as the UI.
- **Structure:** the tests use `// -- Step N --` comments and descriptive names with scenario IDs (BP §5).
- **Scenario match:** the steps and expected results match TC-002, TC-004, and TC-005 in `docs/test-scenarios.md`, and the assertions agree with BR §1 and §4.

### Selectors verified in source

| Selector | Source |
|---|---|
| `getByPlaceholder('you@email.com')`, `getByLabel('Password')`, `#login-btn` | `app/login/page.tsx:207`, `:214`, `:241` |
| Link `Browse Events →` | `app/page.tsx:48` |
| `getByTestId('booking-card')`, `.booking-ref`, link `View Details` | `BookingCard.jsx:44`, `:49`, `:79-80` |
| Button `Clear all bookings`, text `No bookings yet` | `app/bookings/page.tsx:60`, `:82` |
| `span.font-mono.font-bold`, `h1`, button `Cancel Booking` | `app/bookings/[id]/page.tsx:157`, `:164`, `:167` |
| `getByTestId('confirm-dialog-yes')` | `ConfirmDialog.jsx:23` |
| Field labels: Event, Category, Date, Venue, City, Name, Email, Phone, Tickets, Price per ticket, Total Paid | `app/bookings/[id]/page.tsx:174-193` |
| Toast `Booking cancelled successfully` | `app/bookings/[id]/page.tsx:104` |

### Issues Found

#### [IMPORTANT] 1. Number checks can pass on wrong values (lines 105-107)

**Rule:** BP §11, "No assertions after action": an assertion that can't detect the failure proves little.

```ts
await expect(detailPage.field('Tickets')).toContainText('2');
await expect(detailPage.field('Price per ticket')).toContainText(`$${event.price}`);
await expect(detailPage.totalPaid).toContainText(`$${Number(event.price) * 2}`);
```

These are substring matches, so a page showing 12 tickets passes the check for `2`, and a page showing `$4000` passes the check for `$400`. Quantity and price are the numbers users care about most on this page.

**Fix:** match the whole row.

```ts
await expect(detailPage.field('Tickets')).toHaveText(/^Tickets\s*2$/);
await expect(detailPage.field('Price per ticket')).toHaveText(new RegExp(`^Price per ticket\\s*\\$${event.price}$`));
await expect(detailPage.totalPaid).toHaveText(new RegExp(`^Total Paid\\s*\\$${Number(event.price) * 2}$`));
```

#### [IMPORTANT] 2. Generated emails aren't guaranteed to be unique (line 18)

**Rule:** BP §8, "Generate unique data to avoid test pollution".

```ts
const email = faker.internet.email({ provider: 'example.com' }).toLowerCase();
```

Faker builds these from names and short numbers. Runs produced addresses like `ricky58@example.com` and `aubrey97@example.com`. Accounts on the deployed site are never deleted, so the pool of free addresses keeps shrinking. A repeat returns 409, and the `expect(...).toBe(201)` on line 21 fails with an unrelated-looking error. This hasn't happened yet, but it would look like random flakiness when it does.

**Fix:**

```ts
const email = `e2e.${faker.string.uuid()}@example.com`;
```

#### [IMPORTANT] 3. The "other booking is unchanged" check doesn't confirm the request worked (lines 120-122, 140-143)

**Rule:** BP §11, "No assertions after action".

```ts
const otherBookingBefore = await (
  await request.get(`${API_URL}/bookings/${otherBooking.id}`, { headers: user.headers })
).json();
...
expect(otherBookingAfter).toEqual(otherBookingBefore);
```

Neither response's status is checked, so two identical error responses would compare as equal. Line 135 partly covers this by checking the card in the UI, but the API check itself proves nothing in that case. The same request is also written out twice.

**Fix:** add a helper that follows the same pattern as `getAvailableSeats`.

```ts
async function getBooking(request: APIRequestContext, user: User, bookingId: number) {
  const response = await request.get(`${API_URL}/bookings/${bookingId}`, { headers: user.headers });
  expect(response.status()).toBe(200);
  return (await response.json()).data;
}
```

#### [SUGGESTION] 4. Some locators depend on page structure or styling (`BookingDetailPage.ts:14`, `:30`)

**Rule:** BP §2, Priority 1: "Ask developers to add `data-testid` attributes", and Priority 5: CSS classes are a last resort.

```ts
this.bookingRef = page.locator('span.font-mono.font-bold');
return this.page.getByText(label, { exact: true }).locator('..');
```

No better hook exists today. `ui-selectors.md` lists the first selector, and the second is commented in the page object, so they are acceptable for now.

**Fix:** ask for `data-testid` on the detail page's reference and field values, then update the page object. Restyling the page would currently break these.

#### [SUGGESTION] 5. The empty state has a role-based locator available (`BookingsPage.ts:14`)

**Rule:** BP §2, Priority 2: use roles for headings.

```ts
this.emptyState = page.getByText('No bookings yet');
```

`EmptyState.tsx:21` renders the title as an `h3`.

**Fix:**

```ts
this.emptyState = page.getByRole('heading', { name: 'No bookings yet' });
```

#### [SUGGESTION] 6. The login page object holds a home page locator (`EventHubLoginPage.ts:16`)

**Rule:** BP §5, POM rules: "One page class per page/major component".

```ts
this.browseEventsLink = page.getByRole('link', { name: 'Browse Events →' });
```

This link is on the home page (`app/page.tsx:48`), which is where login lands.

**Fix:** move it to a small `HomePage` class when another test needs the home page. It's harmless at this size.

#### [SUGGESTION] 7. API helpers return untyped data (lines 27, 45)

**Rule:** BP "Language choice": tests are written in TypeScript.

`createEvent` and `createBooking` return `any`, so a mistyped field such as `booking.bookingReference` wouldn't be caught until the test ran, and the project has no type-check step either.

**Fix:** add small `Event` and `Booking` types for the fields the tests use. Do this when moving the helpers to a shared file, which the remaining E2E and API specs will need.

---

## `tests/login.spec.ts`

Includes `pages/LoginPage.ts` and `pages/ShopPage.ts`.

### What's Good

- **Page objects:** locators and actions are in page classes, and assertions are in the spec (BP §5).
- **Clear intent:** one test with one clear purpose and a descriptive name (BP §5).
- **Assertions:** it uses auto-waiting assertions, and it checks both the URL and the page content (BP §4, §9).
- **Locators:** the login page uses stable IDs (BP §2, Priority 4).

### Issues Found

#### [SUGGESTION] 1. The product locator isn't exact, though its comment says it is (`ShopPage.ts:17-20`)

**Rule:** BP §2, Priority 2 and 5: prefer roles over CSS classes.

```ts
* Returns a locator for a product card title matching the given exact name.
...
return this.productTitles.filter({ hasText: productName });
```

`hasText` is a case-insensitive substring match, so `iphone X` would also match a product called `iphone XL`. `toBeVisible` would then fail on a strict mode error.

**Fix:**

```ts
return this.page.getByRole('link', { name: productName, exact: true });
```

#### [SUGGESTION] 2. Login values are written inline (line 11)

**Rule:** BP §5, "Credentials as constants at top".

```ts
await loginPage.login('rahulshettyacademy', '<password>');
```

**Fix:** move both values to `USERNAME` and `PASSWORD` constants at the top of the file. This only follows the BP §5 pattern and doesn't change how the password is stored.

#### [SUGGESTION] 3. The URL check repeats the site address (line 13)

**Rule:** BP §4, URL Assertions: build the expected URL from the base URL.

```ts
await expect(page).toHaveURL('https://rahulshettyacademy.com/angularpractice/shop');
```

`playwright.config.ts` already sets this as `baseURL`.

**Fix:**

```ts
await expect(page).toHaveURL('/angularpractice/shop');
```

---

## `playwright.config.ts`

### [IMPORTANT] 1. Failed runs leave no trace, screenshot, or video (lines 7-10)

**Rule:** BP §1, Config Reference: "Screenshots: Only on failure", "Video: Retain on failure".

```ts
use: {
  baseURL: 'https://rahulshettyacademy.com',
  trace: 'on-first-retry',
},
```

`on-first-retry` records only on a retry, and `retries` isn't set, so no trace is ever recorded. This had a real cost: the first TC-004 timeout left no trace, and it had to be reproduced with `--trace=on` to diagnose it.

**Fix:**

```ts
use: {
  baseURL: 'https://rahulshettyacademy.com',
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
},
```

---

## Differences from the standard that aren't counted as issues

These differ from the best-practices skill for a good reason. The skill is what should change.

| BP rule | This project | Why it's reasonable |
|---|---|---|
| §1: base URL `http://localhost:3000` | The deployed site | `CLAUDE.md` and `docs/test-strategy.md` target the deployed site |
| §1: `fullyParallel: false` | `fullyParallel: true` | Each EventHub test has its own user, and 12 of 12 passed with two workers |
| §1: 30s test timeout | 60s for `booking-journeys.spec.ts` | 30s caused real timeouts in headed runs, and line 74 explains why |
| §1: `tests/<feature-name>.spec.ts` | `tests/eventhub/e2e/` | Follows the layout in `docs/test-strategy.md` |
| §5: page objects in `tests/pages/` | `pages/` and `pages/eventhub/` | `CLAUDE.md` and the existing page objects use `pages/` |

## Recommended Fixes

In priority order:

1. **`playwright.config.ts`:** record traces, screenshots, and video on failure, so the next failure can be diagnosed straight away.
2. **`booking-journeys.spec.ts:18`:** use UUID emails to prevent future 409 failures.
3. **`booking-journeys.spec.ts:105-107`:** match the whole row for the ticket and price checks.
4. **`booking-journeys.spec.ts:120-122`, `:140-142`:** add a `getBooking` helper that checks the status.
5. **`BookingsPage.ts:14`:** use the heading role for the empty state.
6. **`ShopPage.ts:20`:** make the product locator exact, as its comment says.
7. **`login.spec.ts:11`, `:13`:** use constants and a relative URL.
8. **When adding the next spec:** move the API helpers to a shared typed file, and add a `HomePage` page object if needed.
9. **Ask the developers:** add `data-testid` to the booking detail page's reference and field values.
