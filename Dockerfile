# Playwright test runner image.
# The base image tag must match the @playwright/test version in package-lock.json,
# so the bundled browsers match what the test runner expects.
FROM mcr.microsoft.com/playwright:v1.64.1-noble

WORKDIR /app

# Tell Playwright it runs non-interactively: no attempt to open the HTML report.
ENV CI=true \
    PLAYWRIGHT_HTML_OPEN=never

# Install dependencies first so this layer is cached until package files change.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the test code (see .dockerignore for what is left out).
COPY . .

# Fail the build early if the TypeScript doesn't type-check, same as CI.
RUN npm run typecheck

# Default: run the whole suite. Override by passing a command, for example
#   docker compose run --rm tests npx playwright test -g "TC-004"
CMD ["npx", "playwright", "test"]
