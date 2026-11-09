---
name: playwright-best-practices
description: Playwright E2E test automation standards — locator strategy, assertion patterns, test structure, POM, API mocking, auth patterns, wait strategies, and anti-patterns. Use when writing, reviewing, or debugging Playwright tests.
user-invocable: false
---

# Playwright Test Automation Best Practices for EventHub

## Overview
This document defines the testing standards, patterns, and best practices for writing Playwright E2E tests in the EventHub project. All test automation agents and code reviewers MUST follow these guidelines.

---

## 1. Project Test Setup

### Config Reference
- **Test directory**: `./tests`
- **Base URL**: `http://localhost:3000`
- **Timeout**: 30s per test, 5s per assertion
- **Browser**: Chromium only (Desktop Edge)
- **Parallel execution**: Disabled (`fullyParallel: false`)
- **Reporter**: HTML
- **Screenshots**: Only on failure
- **Video**: Retain on failure

### File Naming Convention
- Test files: `tests/<feature-name>.spec.ts`
- Use descriptive kebab-case names: `booking-flow.spec.ts`, `cross-user-booking.spec.ts`
- Group related tests in the same file using `test.describe()`

---

## Language choice
Always choose typescript to write test and page object files.

## 2. Locator Strategy (Priority Order)
Always choose locators in this priority order for reliability and readability:

### Priority 1: data-testid (Most Preferred)
```typescript
page.getByTestId('event-card')
page.getByTestId('book-now-btn')
```
Use for: Elements that need stable test hooks. Ask developers to add `data-testid` attributes.

### Priority 2: Accessibility Roles
```typescript
page.getByRole('link', { name: 'Browse Events ->' });
page.getByRole('button', { name: 'Submit' });
```
Use for: Links, buttons, headings — anything with semantic HTML roles.

### Priority 3: Labels and Placeholders
```typescript
page.getByLabel('Full Name')
page.getByLabel('Password')
page.getByPlaceholder('you@email.com')
page.getByPlaceholder('+91 98765 43210')
```
Use for: Form inputs that have associated labels or placeholder text.

### Priority 4: Element IDs
```typescript
page.locator('#login-btn')
page.locator('#event-title-input')
page.locator('#customer-email')
page.locator('#check-refund-btn')
```
Use for: Elements with explicit, stable IDs. Prefer `getByTestId` over raw IDs.

### Priority 5: CSS Classes (Last Resort)
```typescript
page.locator('.confirm-booking-btn')
page.locator('.booking-ref')
```
Use for: Only when no better locator exists. Classes can change with styling.

### NEVER Use
- XPath selectors (fragile, hard to read)
- Complex CSS chains (`.parent > .child:nth-child(3)`)
- Index-based selectors without filtering

---

## 3. Filtering and Scoping Patterns

### Filter cards by content
```typescript
const eventCards = page.getByTestId('event-card');
const targetCard = eventCards.filter({ hasText: eventTitle }).first();
```

### Filter by nested element
```typescript
const matchingCard = bookingCards.filter({
  has: page.locator('.booking-ref', { hasText: bookingRef })
});
```

### Scope actions to a parent
```typescript
await targetCard.getByTestId('book-now-btn').click();
```

---

## 4. Assertion Patterns

### Visibility Checks
```typescript
await expect(page.getByText('Event created!')).toBeVisible();
await expect(banner).not.toBeVisible();
```

### URL Assertions
```typescript
await expect(page).toHaveURL(`${BASE_URL}/bookings`);
await expect(page).toHaveURL(/\/events\/\d+/);  // Regex for dynamic IDs
```

### Content Assertions
```typescript
await expect(result).toContainText('Eligible for refund');
await expect(matchingCard).toContainText(eventTitle);
```

### Numeric/Value Assertions
```typescript
expect(await eventCards.count()).toBe(6);
expect(seatsAfterBooking).toBe(seatsBeforeBooking - 1);
```

### Custom Timeout for Slow Operations
```typescript
await expect(targetCard).toBeVisible({ timeout: 5000 });
await expect(page.locator('#refund-spinner')).not.toBeVisible({ timeout: 6000 });
```

---

## 5. Test Structure Patterns

### Standard Test Structure
```typescript
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

// Credentials as constants at top
const USER_EMAIL = 'rahulshetty1@gmail.com';
const USER_PASSWORD = 'Magiclife1!';

// Reusable helpers
async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder('you@email.com').fill(USER_EMAIL);
  await page.getByLabel('Password').fill(USER_PASSWORD);
  await page.locator('#login-btn').click();
  await expect(page.getByRole('link', { name: 'Browse Events ->' })).toBeVisible();
}

test('descriptive test name that explains what is validated', async ({ page }) => {
  // Step 1: Setup (login, navigate)
  await login(page);

  // Step 2: Action (interact with UI)
  // ...

  // Step 3: Assert (verify outcomes)
  // ...
});
```

### Multi-Step Test with Comments
Use `// -- Step N: Description --` comment blocks to separate logical steps:
```typescript
test('create event, book it, verify seats', async ({ page }) => {
  // -- Step 1: Log in --
  await login(page);

  // -- Step 2: Create event --
  // ... actions ...

  // -- Step 3: Book the event --
  // ... actions ...

  // -- Step 4: Verify seat reduction --
  // ... assertions ...
});
```

### Page Object Model (POM)

For larger test suites, extract page interactions into reusable page classes:

```typescript
// pages/LoginPage.ts
class LoginPage {
  constructor(page) {
    this.page = page;
    this.emailInput = page.getByPlaceholder('you@email.com');
    this.passwordInput = page.getByLabel('Password');
    this.loginBtn = page.locator('#login-btn');
  }

  async goto() {
    await this.page.goto(`${BASE_URL}/login`);
  }

  async login(email, password) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginBtn.click();
  }
}
```

```typescript
// In test file
const loginPage = new LoginPage(page);
await loginPage.goto();
await loginPage.login(USER_EMAIL, USER_PASSWORD);
```

**POM Rules:**
- One page class per page/major component
- Store locators as class properties in the constructor
- Methods represent user actions, not low-level steps
- Keep assertions in test files, not in page objects
- Page files live in `tests/pages/` directory

---

## 6. API Mocking (Route Interception)

### When to Mock
- Testing UI behavior for specific data states (e.g., empty list, exact count)
- Testing conditional UI elements (banners, feature flags)
- Isolating frontend logic from backend state

### Pattern
```typescript
await page.route('**/api/events**', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(mockedResponse),
  });
});
```

### Mock Data
Define mock responses as constants at the top of the file:
```typescript
const SIX_EVENTS_RESPONSE = {
  data: [...],
  pagination: { page: 1, totalPages: 1, total: 6, limit: 12 },
};
```

---

```typescript

### Test Users
| User          | Email                       | Password    | Purpose          |
|---------------|----------------------------|-------------|------------------|
| Gmail User    | rahulshetty1@gmail.com     | Magiclife1! | Primary tester   |
| Yahoo User    | rahulshetty1@yahoo.com     | Magiclife1! | Cross-user tests |

---

## 8. Dynamic Data Handling

### Unique Test Data
use npm faker module to generate unique test data
Generate unique data to avoid test pollution:
```typescript
use moment date npm package for date related activities.
const now = moment();
const nextWeek = now.add(7, 'days');
```



## 9. Wait Strategies

### DO: Use auto-waiting with expect
```typescript
await expect(page.getByText('Event created!')).toBeVisible();  // Auto-waits
```

### DO: Use waitUntil for navigation
```typescript
await page.goto(`${BASE_URL}/bookings/${id}`, { waitUntil: 'domcontentloaded' });
```

### DON'T: Use arbitrary sleeps
```typescript
// BAD - Never do this
await page.waitForTimeout(2000);
```

### Exception: Testing timed UI (spinners)
```typescript
// OK when testing that a spinner shows for a specific duration
await expect(page.locator('#refund-spinner')).toBeVisible();
await expect(page.locator('#refund-spinner')).not.toBeVisible({ timeout: 6000 });
```

---

## 10. Debugging Tips

### Console Logging in Tests
```typescript
console.log(`Created event: "${eventTitle}"`);
console.log(`Booking confirmed. Ref: ${bookingRef}`);
console.log(`Seats before: ${before}, after: ${after}`);
```

### Run Single Test
```bash
npx playwright test tests/booking-flow.spec.ts --reporter=line
```

### Run with UI Mode
```bash
npx playwright test --ui
```

### View HTML Report
```bash
npx playwright show-report
```

---

## 11. Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Do Instead |
|-------------|-------------|-----------|
| `page.waitForTimeout(N)` | Flaky, wastes time | Use `expect().toBeVisible()` |
| `page.locator('div > span:nth-child(2)')` | Fragile CSS path | Use `data-testid` |
| Hardcoded booking/event IDs | Tests break when DB changes | Generate data dynamically |
| `test.only()` left in code | Skips other tests in CI | Remove before commit |
| No assertions after action | Test passes but proves nothing | Always assert outcomes |
| Shared state between tests | Order-dependent failures | Each test self-contained |
| Testing implementation details | Breaks on refactor | Test user-visible behavior |
