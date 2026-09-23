# AGENTS.md

Guidance for AI coding agents (Codex, Cursor, Copilot, Claude Code, ...) working on repo-ready.

## Commands

- Install dependencies: `npm install`
- Lint: `npm run lint`
- Test: `npm test`

## Conventions

- Keep changes focused; match the style of the surrounding code.
- Add or update tests for any behavior change and make sure the full test suite passes.
- Update README.md and CHANGELOG.md when user-facing behavior changes.
- Never commit secrets, credentials or `.env` files.
