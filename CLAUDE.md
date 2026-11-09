# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a course workspace for building AI agents for software testing. It isn't a git repository. It holds one Playwright project at the root and the source of EventHub, the ticket booking app used as a test target.

| Path | Purpose |
|---|---|
| `tests/`, `pages/`, `playwright.config.ts` | TypeScript Playwright tests and page objects |
| `frontend/` | EventHub frontend: Next.js 14, with its own `package.json` |
| `backend/` | EventHub API: Express, Prisma, and MySQL, with its own `package.json` |
| `docs/` | `test-scenarios.md` and `test-strategy.md` for booking management |
| `.claude/skills/` | Skills for domain knowledge, test standards, and the test design workflow |

Tests target two deployed sites, and neither runs from local code:

| Tests | Site |
|---|---|
| `tests/login.spec.ts` | `https://rahulshettyacademy.com`, the `baseURL` in `playwright.config.ts` |
| `tests/eventhub/` | `https://eventhub.rahulshettyacademy.com`, with the API at `https://api.eventhub.rahulshettyacademy.com/api` |

## Commands

Run tests from the root:

```bash
npm test                                     # Run all tests
npx playwright test tests/eventhub/e2e/booking-journeys.spec.ts --reporter=line   # Run one file
npx playwright test -g "TC-004"              # Run tests by title
npx playwright show-report                   # Open the HTML report
```

Run the EventHub app locally (needs MySQL, `backend/.env`, and `frontend/.env.local`):

```bash
cd backend
npm run prisma:migrate                       # Apply the Prisma migrations
npm run seed                                 # Seed the static events
npm run dev                                  # API on :3001, Swagger at :3001/api/docs

cd frontend
npm run dev                                  # Frontend on :3000
npm run build                                # Build the frontend
npm run lint                                 # Lint the frontend
```

## Architecture

**Tests** use the page object model: locators and page actions go in `pages/`, and assertions go in the spec file. EventHub page objects are in `pages/eventhub/`. EventHub specs set their own `baseURL` with `test.use`, because the root config targets the other site.

**EventHub** backend requests flow through routes, controllers, services, and repositories in `backend/src/`. See the `eventhub-domain` skill for business rules, API reference, selectors, and user flows.

**Test design workflow:** `/create-scenarios` writes `docs/test-scenarios.md`, `/test-strategy` writes `docs/test-strategy.md`, `/generate-tests` writes and runs tests, and `/review-tests` reviews them. `/generate-tests` doesn't list the two docs as inputs, so name them when you want them used.

**MCP servers** (`.mcp.json`) let an agent run a single flow across several layers:

- `playwright` drives the UI in Edge
- `rest-api` calls `https://rahulshettyacademy.com`
- `mysql` reads test data from the local `rahulshettyacademy` database (Windows service `MySQL80`)
- `filesystem`, `csv-mcp-server`, and `excel-mcp-server` handle project files and spreadsheets

`excel-mcp-server` needs `SMITHERY_API_KEY` to be set.

Course exercises combine these servers with the files in `LLM-MCP (AI Agent)/`, including `EcomBasic.postman_collection.json` for the API contract and `newly-registered.csv` for registration output.

## Gotchas

- Running `frontend/` or `backend/` locally doesn't change the test target, so local code changes aren't exercised by the tests. The deployed site may also differ from the local source.
- `npm test` includes the EventHub tests, which register new users and create events on the deployed site on every run. Those accounts aren't cleaned up.
- Never overflow bookings on a static event on the deployed site. See the test data rules in `docs/test-scenarios.md`.
- `playwright-best-practices` lists `http://localhost:3000` as the base URL and shows `tests/pages/` for page objects. This project uses the deployed site and `pages/`.
- `.playwright-mcp/` and `test-results/` are generated output, and `__MACOSX/` is a leftover from course downloads. Exclude them from searches, along with `node_modules/` and `frontend/.next/`.
- `Learn-AI-tools-Build-AI-Agents-for-Software-Testing.txt` is the user's personal course notes and contains plaintext credentials. Don't copy its contents into other files.
