# Build AI Agents for Software Testing

Playwright tests for `rahulshettyacademy.com` and the EventHub ticket booking app.

## Run the tests with Docker

You only need [Docker](https://docs.docker.com/get-docker/) (Docker Desktop on Windows and macOS).
Node, the browsers, and the npm packages are all inside the image.

```bash
git clone <this-repo-url>
cd <repo-folder>
docker compose run --rm tests
```

The first run builds the image, which downloads about 2 GB. Later runs reuse it.

After a run, the HTML report is in `playwright-report/` and failure traces, screenshots,
and videos are in `test-results/` on your machine. Open the report in a browser
(`playwright-report/index.html`), or use `npx playwright show-report` if you have Node.

### Run a subset

Anything after `tests` replaces the default command:

```bash
docker compose run --rm tests npx playwright test tests/login.spec.ts
docker compose run --rm tests npx playwright test -g "TC-004" --reporter=line
```

### Rebuild after changing tests or dependencies

The test code is copied into the image, so rebuild after you edit it:

```bash
docker compose run --rm --build tests
```

The build also runs `npm run typecheck`, so a type error stops the build.

### Notes

- The tests run against the deployed sites, not local code. EventHub tests register
  new users and create events on every run.
- On Linux, files in `playwright-report/` and `test-results/` are owned by root because
  the container runs as root.
- The Playwright version in the `Dockerfile` base image must match `@playwright/test` in
  `package-lock.json`. Update both together.

## Run the tests without Docker

```bash
npm ci
npx playwright install --with-deps chromium
npm test
```
