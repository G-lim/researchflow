# Two-Person Development Workflow

This workflow lets the frontend and backend move at the same time. Both sides use `docs/api-contract.md` as the shared contract.

## Responsibilities

| Area | Main owner | Shared check |
|---|---|---|
| React pages, components, page states, and API client | Frontend developer | Response fields and user flow |
| FastAPI routes, database work, external services, and processing jobs | Backend developer | Request fields and error behaviour |
| API contract, mock data, and integration checks | Both developers | Both developers agree before a breaking change |

Ownership shows who leads the work. It does not stop either developer from reviewing or helping with the other area.

## Repository Layout

```text
researchflow/
├── backend/                 FastAPI application
├── frontend/                React application
├── docs/
│   ├── api-contract.md      Shared API contract
│   ├── development-workflow.md
│   └── mock-data/           Fixed responses for frontend work
└── experiments/             Local feasibility work, ignored by Git
```

Existing backend tests are in `backend/tests/`. Temporary verification files are not included in repository. The `experiments/` folder is for local feasibility work.

## Original Development Slice

The first slice covered paper discovery and saving:

1. Search papers with `GET /api/papers/search`.
2. Save one result with `POST /api/papers`.
3. Show saved papers with `GET /api/papers`.

The application now also includes PDF retrieval and upload, parsing, analysis, evidence views, library queries, and collections. The original slice remains a useful integration check.

The frontend calls the real backend. `docs/mock-data/first-slice.json` retains examples for these three endpoints; it does not describe the whole application.

## Contract Rules

- The API contract is the shared source for routes, fields, status codes, and errors.
- A response field cannot change after frontend work starts unless both developers agree.
- Additive changes are allowed when old frontend code can still work.
- For a breaking change, update the contract and mock data before changing either application.
- The frontend must handle documented empty, loading, success, and error states.
- The backend must return documented errors and must not expose local paths or secret values.

The running backend provides its machine-readable schema at `/openapi.json` and interactive documentation at `/docs`. The Markdown contract explains behaviour and examples; it does not replace the generated schema.

## Frontend Work

- Keep all HTTP calls in one API client area.
- Read the backend base URL from local configuration.
- Use the fixed mock data while the matching endpoint is unfinished.
- Do not copy response conversion logic into page components.
- Treat nullable status fields as `null`, not as an empty string.

## Backend Work

- Keep changes within the agreed MVP scope.
- Validate query parameters and request bodies.
- Keep response field names equal to the contract.
- Allow the local frontend origin through backend configuration.
- Run existing tests and targeted checks for changed endpoints. Record results and remaining limits.

## Git Workflow

Both developers currently work on `main`, which must stay runnable. Agree who will edit shared files before starting. Keep each commit focused on one complete change.

Before pushing:

1. Review the changed files and exclude credentials, cached PDFs, local databases, and temporary test files.
2. Commit the intended work locally, or stash unfinished changes before pulling the latest `main`.
3. Resolve conflicts and restore any stashed work without discarding local changes.
4. Run checks for the combined code and compare API changes with the contract.
5. Ask the other developer to review shared contract changes, then push only the intended commits.

## Search and Library Integration Check

Check that:

- The frontend can search through the real backend.
- A user can save one search result.
- The saved paper appears in the library response.
- An empty search result is shown without an error.
- An already saved paper shows the documented conflict message.
- A failed external search returns matching cached results with their timestamp, or a clear error when no usable cache exists.
- Existing backend tests and targeted checks pass, with results recorded.

These checks cover search and saving only. Final acceptance must also cover library filters and collections, PDF download and upload, processing failures and retries, analysis, evidence, and retrieval of saved results after a backend restart.

