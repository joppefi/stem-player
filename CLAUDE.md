# Commit guidelines

Use [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <Description>`

- `type` — `feat`, `fix`, `refactor`, `style`, `chore`, `revert` (standard conventional-commit types apply generally; these are the ones used so far in this repo)
- `scope` — one of:
  - `backend` — FastAPI app (`backend/`)
  - `frontend` — React Router SPA (`frontend/`)
  - `e2e` — changes that cut across both, e.g. a feature with paired backend + frontend work, or generated-client/codegen changes
- `Description` — imperative mood, capitalized, no trailing period

Example: `feat(frontend): Add grid controls`

A longer body is welcome for non-trivial commits (what changed and why, not a restatement of the diff), but never add `Co-Authored-By` or `Claude-Session` footers.
