# Backend

The backend uses Python, FastAPI, and SQLite. Route and response shapes come from `../docs/api-contract.md`.

Paper search and library routes:

```text
GET  /api/papers/search
POST /api/papers
GET  /api/papers
GET  /api/papers/{paper_id}
DELETE /api/papers/{paper_id}
```

PDF retrieval, parsing, structured full-text analysis, and source evidence queries are available.

Existing tests in `tests/` cover paper search. Local feasibility work stays in the ignored root `experiments/` folder.

## Local Setup

Run these commands from the `backend` folder:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app
```

The API runs at `http://127.0.0.1:8000`. Interactive API documentation is available at `http://127.0.0.1:8000/docs`.

On Windows, do not use `--reload` for PDF processing. It selects an event loop that does not support the worker's asynchronous subprocess. Restart the backend manually after code changes.

Run tests with:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

## Configuration

The frontend origins default to:

```text
http://localhost:5173
http://127.0.0.1:5173
```

Set `FRONTEND_ORIGINS` to a comma-separated list when the frontend uses other origins.

Casual OpenAlex requests can run without a key. Set `OPENALEX_API_KEY` in the local environment when the project needs its own allowance. Never store the key in a source file.

## Paper Search

```text
GET /api/papers/search?q={query}&page={page}
```

The endpoint trims the search text, uses 25 results per page, and returns the shared error shape for invalid parameters or an external search failure.

Search tries OpenAlex first and stores successful responses in SQLite, including empty results. On failure it can return the matching result from the previous seven days. Responses add `from_cache` and `cached_at`; the frontend should show the cache time when `from_cache` is true. If there is no usable cache, the endpoint keeps returning `502` with `paper_search_failed`. A failed cache write still returns the live result, with `cached_at: null`.

The cache survives backend restarts and does not add papers to the saved library. It separates queries, pages, page sizes, upstream URLs and response versions. Only surrounding query whitespace is removed. There is no automatic request retry, background refresh or cache-first lookup. The seven-day limit controls fallback eligibility; expired rows are not automatically deleted, and a later successful matching search replaces them.

## Paper Library

The backend creates `data/researchflow.sqlite3` on startup. Saved papers remain available after a restart. SQLite uses Python's standard library, so no database server or extra package is needed.

Set `DATABASE_PATH` to use a different file. Relative paths are resolved from the `backend` directory, regardless of the shell's current directory. Parent folders are created on startup. Database files and their journal files are ignored by Git.

Send a search result to `POST /api/papers` to save it. The response returns the saved metadata, an integer ID, and UTC timestamps. An existing OpenAlex ID returns `409` with `paper_already_saved`; it does not replace the saved record.

`GET /api/papers` returns the library with the newest saved records first. `GET /api/papers/{paper_id}` returns one paper's metadata. `DELETE /api/papers/{paper_id}` removes that record and returns `204` with no body. A missing record returns `404` with `paper_not_found`.

The library reports the latest document's processing state. It returns `null` when no document exists. Paper details include document IDs and their retrieval and parsing states. `latest_analysis_status` reports the newest analysis across the paper's documents, or `null` when no run exists. Earlier completed analyses remain available.

Deleting a paper removes its documents, stored pages, sections, chunks, analyses, findings, evidence, and cached files. Deletion returns `409` while a document or analysis is queued or processing. Cache files are staged before database deletion and restored if the transaction fails. Interrupted cache cleanup is recovered at startup.

The database enables foreign key checks on each connection. Writes use transactions, and the unique OpenAlex ID prevents concurrent requests from saving duplicates. A database operation that remains blocked after five seconds returns `503` with `database_unavailable`. The client can retry later.

Startup creates missing tables and migrates older document tables for PDF uploads. The migration preserves existing records and checks foreign keys. Back up an existing database before upgrading; other schema changes need an explicit migration.

### Library queries and collections

`GET /api/papers` accepts `q`, `year_from`, `year_to`, `collection_id`, `document_status`, `analysis_status`, `sort_by` and `sort_order`. Filters combine with AND. Search checks saved titles, individual authors, abstracts and DOIs without an external call. No parameters keeps the original newest-first response.

Sort by `saved_at`, `publication_year`, `title` or `citation_count`, with `asc` or `desc`. Unknown years remain last. Status filters accept the four task states and `not_started` for papers without a document or analysis. Full validation rules are in the API contract.

Minimal workflow, using IDs returned by the API:

1. Create a group with `POST /api/collections` and `{"name":"Methods"}`.
2. Add a saved paper with `PUT /api/collections/{collection_id}/papers/{paper_id}`.
3. Query it with `GET /api/papers?collection_id=1&q=neural&sort_by=publication_year&sort_order=desc`.
4. Use `GET /api/collections` for groups and counts, or `GET /api/papers/{paper_id}/collections` for a paper's groups.
5. Rename with `PATCH /api/collections/{collection_id}` and `{"name":"New name"}`. Remove a membership with `DELETE /api/collections/{collection_id}/papers/{paper_id}`.

A paper may belong to several groups. Repeating an addition or removal is safe while both resources exist. Names ignore case and repeated whitespace when checking duplicates. Deleting a group with `DELETE /api/collections/{collection_id}` keeps its papers, PDFs and analysis results. Deleting a paper removes its memberships but keeps the groups.

Startup adds the collection tables to existing databases. The frontend library provides query and collection controls, and paper details allow users to add or remove collection memberships.

## Full-Text PDFs

```text
GET  /api/papers/{paper_id}/full-text-sources
POST /api/papers/{paper_id}/documents
POST /api/papers/{paper_id}/documents/upload
GET  /api/documents/{document_id}
POST /api/documents/{document_id}/retry
GET  /api/documents/{document_id}/sections
GET  /api/documents/{document_id}/chunks
GET  /api/sections/{section_id}/chunks
```

Save the paper first, then query its full-text sources. The source list contains direct PDF URLs from OpenAlex locations marked as open access. It may be empty. Posting `{"source_url": "..."}` starts retrieval only when the URL is in that paper's current source list.

The start endpoint returns `202` with a document ID. Poll the document endpoint until parsing is `completed` or `failed`. A failure includes an error code and a short reason. A duplicate paper/source pair returns `409`; use the retry endpoint for a failed document. Retry downloads the source again and replaces any partial parsing records.

If automatic retrieval is blocked, upload a locally available PDF using multipart fields `file` and `confirmed=true`. Confirmation means the file belongs to the saved paper and the user may process it. Install the updated requirements first. Uploads are limited to 25 MiB and must start with the PDF signature. Each upload creates a new document with `source_kind=upload`, `source_url=null` and `access_type=unknown`; it does not infer a licence or overwrite an earlier document. The backend generates its storage filename and keeps only the original filename without directory components for display.

An accepted upload has retrieval `completed` and parsing `pending`. The existing worker parses the saved file without making a download request. Poll the same document endpoint and use the existing analysis and evidence endpoints after parsing completes. Retrying a failed upload preserves its file and queues parsing again. If the local file is missing, upload it again as a new document. The paper details page provides a file picker and asks the user to confirm the paper and permission to process it before uploading.

This is a local-only upload endpoint, not a public file-hosting service. The 25 MiB file check runs after multipart parsing; public deployment would also need an incoming request limit and access controls. Uploading does not call OpenRouter. Starting a later analysis sends extracted text to the selected provider.

The database stores the queue. One background worker processes one document at a time in a separate process. Run one backend process per database; multiple application workers are not supported. A file lock prevents a second worker from using the same database. A running child process also holds a job lock. After an abrupt stop, wait up to 90 seconds for that job to exit before restarting. Queued documents resume on startup; interrupted active documents become failed and can be retried.

Downloads have a 25 MiB limit, a 45-second time budget, and at most five redirects. Each destination must resolve only to public addresses. The connection uses the checked address and verifies HTTPS certificates against the original hostname. Local addresses, credentials in URLs, and ports other than 80 or 443 are rejected. The downloaded bytes must begin with the PDF signature. Each complete job has a 90-second process limit.

The parser accepts up to 300 pages and two million extracted characters. It rejects encrypted PDFs and documents with fewer than 100 alphanumeric characters. It does not perform OCR; scanned pages, figures, tables, and some embedded fonts may leave gaps in the extracted text.

Section detection uses common English and numbered headings. Unrecognised titles may use `unknown`; unusual layouts can cause missed or incorrect headings. Check extracted text and section labels against the PDF. Detection rules are described in `../docs/architecture.md`.

Text chunks contain at most 2,000 characters and never cross a page or section boundary. Their character positions are zero-based, end-exclusive offsets into the stored page text. The source text is not rewritten. No chunk overlap is added. Page numbers start at 1.

Cached PDFs use `data/pdfs/{document_id}.pdf`. Set `PDF_CACHE_PATH` to change the cache folder; relative paths use the backend directory. Keep custom caches outside version control. Downloads are replaced on retry; uploaded originals remain until their paper is deleted. Temporary downloads use `.part`; uploads use `upload-*.part` until saved; interrupted deletion uses `.deleting`. Paths and checksums are internal and are not returned by the API.

Startup adds the document tables and `analysis_runs`, `findings`, and `evidence` without replacing existing paper records or extracted text. A document with analysis history cannot be retried to replace its source. A different PDF version needs a different document record.

The upload upgrade rebuilds older document tables in a transaction to allow a null source URL and unknown access rights. It preserves document IDs, their sequence, existing metadata and related evidence, and checks foreign keys before committing. Stop older backend processes and back up the database before the first startup with this version.

## Full-Text Analysis

```text
POST /api/documents/{document_id}/analyses
GET  /api/documents/{document_id}/analyses
GET  /api/analyses/{analysis_id}
POST /api/analyses/{analysis_id}/retry
GET  /api/analyses/{analysis_id}/findings
GET  /api/findings/{finding_id}
```

The backend reads `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` from `backend/.env`, with environment variables as a fallback for missing fields. The default model is `anthropic/claude-haiku-5.5`. Only these two fields are read from the file. Models must support structured JSON-schema output and the client's disabled-reasoning setting. A missing key returns `503` with `analysis_not_configured`; search, saving, and PDF processing still work. Keep keys out of source files, logs, and Git.

### Local analysis settings

`GET /api/settings/analysis` returns the saved configuration, or environment defaults when no file entry exists:

```json
{"model":"anthropic/claude-haiku-5.5","api_key_configured":false,"restart_required":false}
```

`PUT /api/settings/analysis` accepts `model` and an optional `api_key`. An omitted or blank key keeps the existing file or environment key. The response has the same fields as GET and never includes the key. To change only the model:

```json
{"model":"anthropic/claude-haiku-5.5"}
```

Saving writes both settings to `backend/.env` without replacing other entries. The key is stored in plain text; this file is ignored by Git and must not be shared. `api_key_configured` means a key is present, not that it has been accepted by OpenRouter. Saving does not call the provider or incur usage charges.

Restart the backend to apply saved changes. `restart_required` compares the saved settings with the running configuration. Active and queued analyses keep their current configuration until restart; finish them before restarting. Earlier results are not changed. The frontend does not yet provide a settings form.

These endpoints require a loopback client and host. Browser origins must also be an allowed local frontend origin or the backend's own origin. PUT requires JSON. They are for local single-user use, not shared hosting or a public reverse proxy. Invalid fields return `422`, disallowed access returns `403`, and file read or write failures return `503`.

The client uses OpenRouter's [structured output format](https://openrouter.ai/docs/guides/features/structured-outputs), requests compatible provider routing, and validates the response locally. Unsupported models fail instead of falling back to another model or unstructured text. Extracted paper text is sent to OpenRouter and the selected provider. Each run and explicit retry can incur charges.

The backend validates the structured response locally and checks each excerpt against a chunk in the current request batch and document.

After a document finishes parsing, post `{"analysis_version":"full-text-v1"}` to its analysis endpoint. An empty object uses the same version. The response returns `202` and an analysis ID. Poll the status endpoint until it returns `completed` or `failed`, then fetch findings. Only one pending or processing analysis is allowed per document; a duplicate start returns `409`.

When opening or refreshing a paper, get its document IDs from paper details, then request `GET /api/documents/{document_id}/analyses?page=1&page_size=20`. The response contains `analyses`, `page`, `page_size`, and `has_more`. Records use the same fields as analysis status and are ordered by descending creation ID, including pending, processing, completed, and failed runs. An existing document without history returns an empty list, even before parsing completes; a missing document returns `404`. Reading history needs no analysis service configuration.

Page numbers start at 1 and cannot exceed 2,147,483,647. Page size defaults to 20 and accepts 1 to 100 records. Continue while `has_more` is true. New runs can shift page boundaries; restart at page 1 after creating a run and deduplicate by ID when combining pages. Retrying keeps the run's original ID and position. Use an active run's ID to resume polling, or a completed run's ID to fetch findings. A newer failed run does not hide older completed results.

Findings use four categories: `research_problem`, `methodology`, `key_finding`, and `limitation`. Use `?finding_type=methodology` to filter the list. A missing category contains an `unavailable` row with null content and no evidence. This means the run found no validated result, not that the paper certainly lacks that information.

The prompt asks for the paper's current question, methods, results, and explicit limitations. Findings must name their subject and preserve the source's scope. Future work alone is not a research problem or limitation.

Open a finding to inspect its source excerpts, sections, pages, and character offsets. Evidence must match uniquely in its stored chunk, allowing whitespace differences only. `supported` confirms a source link, not that the conclusion is correct. Matching and offset rules are described in `../docs/architecture.md` and `../docs/api-contract.md`.

Analysis accepts at most 200,000 source characters in up to 100 batches of 12,000 characters. New runs allow 100,000 output tokens, including reasoning, with a 600-second request timeout and a 30-minute total timeout. Responses are limited to 8 MiB and 20 candidates per batch. Oversized inputs, invalid responses, and service failures stop the run without publishing partial results. Retries keep their original settings; create a new run to use changed limits.

Check that the selected model supports the input and output budgets. Provider limits and availability can change; longer responses may increase latency and cost. The backend does not lower the budget or switch models automatically.

The SQLite queue has one analysis worker alongside the document worker. Keep one backend process per database. Pending runs survive restart; interrupted active runs become failed. Retry reuses a failed run's ID, original model, settings, and creation time and processes all batches again. Changing models needs a new run. Completed runs are not overwritten. There are no automatic repeat service requests.

### Verification summary

A live check on 26 September 2026 used *Scikit-learn: Machine Learning in Python* and `dots-studio/dots-3-note-preview:free`. Search, PDF retrieval, parsing, analysis, evidence storage, and result retrieval after restart completed. The later run saved five findings with five source excerpts; research problems and limitations remained `unavailable`.

Recorded local checks passed 28 temporary regression checks and eight existing backend tests. Earlier runs exposed category and section errors. The final parser adjustment passed local checks but was not followed by another live analysis run. These historical results do not replace current acceptance checks or evaluation across more papers.
