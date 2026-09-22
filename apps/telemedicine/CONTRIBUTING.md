# Contributing to Sabi Health

## Branches
- `main` — production. Only updated via merges from `develop`. Never push directly.
- `develop` — the working branch. All feature branches start from here and
  merge back into here.
- Feature branches: `feature/short-description`
  - Example: `feature/patient-appointments-page`
  - Example: `feature/vitals-api`

## Workflow
1. Pull the latest `develop`.
2. Create your branch from `develop`: `feature/your-feature-name`
3. Commit your work with clear messages (e.g. "Add appointment booking form").
4. Open a Pull Request into `develop`.
5. Get at least 1 review/approval before merging.
6. Delete your branch after it's merged.

## Code review
- Frontend PRs are reviewed by the other frontend developer.
- Backend PRs are reviewed by the other backend developer.
- If a PR touches both frontend and backend (e.g. a new API contract), tag
  both sides for review.

## Environment variables
- Never commit real API keys, secrets, or database URLs.
- Copy `.env.example` to `.env` locally and fill in your own values.
- Ask the project lead for staging/dev credentials if you don't have them.

## Adding a new page/section
- Add new folders inside `packages/patient-portal/src/pages/` only when you
  start building that section — don't pre-create empty folders for sections
  not yet in progress.
- Reuse components from `packages/design-system` wherever possible instead
  of creating new buttons/cards from scratch.
