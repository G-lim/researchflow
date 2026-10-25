# ResearchFlow

ResearchFlow helps users search and organise papers, process a PDF, and read four types of findings with source excerpts. It uses React, FastAPI and SQLite and is intended for local, single-user use.

## Start the backend

Use Python 3.12. From the project folder, run these commands in Windows PowerShell:

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app
```

For later starts, run only the last command from `backend`. Keep one backend process running. On Windows, do not use `--reload`, as PDF processing needs a compatible subprocess event loop.

The API runs at http://127.0.0.1:8000. Interactive API documentation is at http://127.0.0.1:8000/docs.

## Start the frontend

Use a Node.js version supported by Vite 8. Open another terminal in the project folder:

```powershell
cd frontend
npm install
npm install --no-save --package-lock=false axios
npm run dev
```

The current dependency files do not list Axios, although the frontend imports it. The second install command adds it locally without changing those files. Repeat it after a clean dependency installation until the declaration is fixed.

Open http://localhost:5173, or the address shown by Vite. For later starts, run `npm run dev` from `frontend`. The development server forwards `/api` requests to the backend on port 8000. If Vite uses a different port, add its origin to `FRONTEND_ORIGINS` for the analysis settings form; see the [backend README](backend/README.md).

## Configure analysis

Open a saved paper and select **Configure Analysis** or **Edit settings** in the analysis panel. Enter an OpenRouter API key and a compatible model, then save. The default model is `anthropic/claude-haiku-5.5`. Leaving the key blank keeps an existing key.

Settings are saved in `backend/.env` and apply to new analyses without restarting. Retrying an old run keeps its original model. Use **Run with current settings** to start a new run after changing models. Suggested models may not all be available or compatible. The backend requires structured JSON output and requests reasoning to be disabled.

The key is stored in plain text and is not returned by the settings API. Do not share `.env`. Search, saving and PDF processing work without an OpenRouter key. Analysis sends extracted text to OpenRouter and the selected provider and may incur charges.

## Use the project

1. Search for a paper and save it.
2. Open **My Library** to find the paper or organise it into a collection.
3. Open its details and select a PDF source. If downloading fails, upload a PDF that belongs to the paper and that you have permission to process.
4. Wait for parsing to complete, then start analysis.
5. Read the research problems, methods, findings and limitations. Open the evidence to check source excerpts and page references.
6. Return to the paper later to read saved results. Failed tasks show an error and can be retried where supported.

Paper records and results are stored in `backend/data/researchflow.sqlite3`. PDFs are stored in `backend/data/pdfs/`. These files remain after the application stops. Deleting a saved paper also removes its documents and analysis results.

## Limits

The prototype analyses one paper at a time and needs PDFs with readable text. It does not perform OCR, interpret figures, or compare several papers. Downloads may fail, and unusual layouts can affect text and section extraction. Matching an excerpt confirms its source location, but users still need to check whether it supports the finding.

See the [backend README](backend/README.md) for configuration, APIs and tests, or the [frontend README](frontend/README.md) for frontend details.
