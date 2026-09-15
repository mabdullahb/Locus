# Contributing

Thanks for taking a look. This is a small project, so the process is light.

## Before you start

- Open an issue for anything non-trivial so we can agree on the shape before you
  write code.
- By contributing you agree your work is licensed under AGPL-3.0-or-later, the
  same as the rest of the project.

## Setup

Follow the setup steps in `README.md`. You need Postgres and Redis running and a
filled-in `.env`.

## Working on a change

- Branch off `main`.
- Keep commits focused. One logical change per commit, present-tense summary
  line.
- Match the surrounding code style. Prettier and ESLint configs are in the repo.
- `npx tsc --noEmit` must pass.
- Add or update tests. See `TESTING.md`:
  - new function gets a test
  - bug fix gets a regression test that fails on the old code
  - new branch (if/else, switch) gets a test for each side
- `npm test` must pass. Do not commit code that breaks existing tests.
- If your change touches the rendered UI, run `npm run test:e2e` too.

## Pull requests

- Describe what changed and why, and how you tested it.
- Link the issue it closes.
- Expect review comments. Nothing personal.

## What not to send

- Changes that widen the scraping surface or add proxy-evasion features. This
  project already sits on thin ice with Google's Terms of Service and is not
  looking to push further.
- Secrets, real API keys, or `.env` files in the diff.
