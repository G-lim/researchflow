# ResearchFlow — Frontend

ResearchFlow is an AI-assisted research information management system. This folder contains the React single-page application that talks to the FastAPI backend in ../backend.

The frontend lets a user search academic papers, save them into a personal library, organise them into collections, download or manually upload a PDF, extract the full text into sections and chunks, and run an LLM-powered analysis that returns structured findings with source evidence. The model and API key used by the analysis are configured from the UI.

---

## Feature Overview

- Paper search through the backend OpenAlex integration
- Save, list, filter, sort, and delete saved papers
- Collections: create, rename, delete, and assign papers to collections
- PDF handling: fetch open-access sources, start processing, or upload a local PDF
- Full-text viewer: browse extracted sections and inspect source chunks
- AI analysis: start a full-text analysis and view findings grouped into research problem, methodology, key findings, and limitations
- Evidence viewer: expand any finding to see the exact source excerpts, section labels, and page numbers
- Analysis settings form: configure the OpenRouter model and API key from the UI, without restarting the backend

---

## Technology Stack

- React 18 with functional components and hooks
- Vite as the build tool and development server
- Axios for HTTP requests
- Plain CSS with custom properties (no CSS framework)
- No global state library; each page manages its own state with useState and useEffect

---

## Directory Layout

    frontend/
      src/
        api/
          client.js          Axios instance with baseURL /api
          papers.js          Paper search, save, list, get, delete
          documents.js       PDF source lookup, processing, upload, sections, chunks
          analyses.js        Full-text analysis, findings, evidence
          collections.js     Collections CRUD and paper assignment
          settings.js        Analysis service configuration (model and API key)
        components/
          AnalysisPanel.jsx         Analysis lifecycle, findings, settings entry
          AnalysisSettingsForm.jsx  OpenRouter model and API key form
          CacheNotice.jsx           Cache timestamp notice for search
          CollectionsPanel.jsx      Collection list and management
          ErrorMessage.jsx          Shared error block
          LibraryFilters.jsx        Filter and sort bar for the library
          LoadingSpinner.jsx        Shared loading indicator
          PaperCard.jsx             Single paper card with Save button
          PaperCollections.jsx      Collection membership checkboxes
          PaperList.jsx             List wrapper for PaperCard
          SearchBar.jsx             Search input and submit button
        pages/
          SearchPage.jsx        Search view
          LibraryPage.jsx       Saved-paper library view
          PaperDetailPage.jsx   Paper detail, PDF processing, analysis entry
        App.jsx                 Root component, tab navigation, view state
        main.jsx                React entry point
        index.css               Global stylesheet
      index.html
      package.json
      vite.config.js
      README.md

---

## Requirements

- Node.js 18 or newer
- npm 9 or newer
- Python 3.10 or newer (for the backend)
- An OpenRouter account (for the AI analysis feature)

---

## Step-by-Step Setup

Follow these steps in order on a fresh machine.

### Step 1. Fetch the repository

If you already cloned your own fork, add the team fork as upstream and pull the latest code:

    git remote add upstream https://github.com/tengjiyun/researchflow.git
    git fetch upstream
    git checkout main
    git pull upstream main

If you are starting from scratch, clone the team repository directly:

    git clone https://github.com/tengjiyun/researchflow.git
    cd researchflow

Do not run the frontend on its own. The backend must be set up first.

### Step 2. Set up the backend

From the project root:

    cd backend
    py -3.12 -m venv .venv
    .\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt

This creates a Python virtual environment and installs FastAPI, uvicorn, httpx, pypdf, python-multipart, python-dotenv, and pytest.

### Step 3. Start the backend

    .\.venv\Scripts\python.exe -m uvicorn app.main:app

The backend starts on http://127.0.0.1:8000. Interactive API documentation is available at http://127.0.0.1:8000/docs.

On Windows, do not use --reload. It selects an event loop that does not support the background worker's subprocess, and PDF processing fails with NotImplementedError. Restart the backend manually after code changes.

At this point the backend works for search, saving, and PDF processing. The analysis feature needs an OpenRouter key, which is configured in Step 5 through the frontend.

### Step 4. Install and start the frontend

Open a NEW terminal for the frontend.

    cd frontend
    npm install
    npm run dev

The frontend starts on http://localhost:5173. Open it in a browser.

### Step 5. Configure the OpenRouter model and API key from the UI

The analysis feature needs an OpenRouter key and a model name. This is done inside the application, no terminal or environment variable is required.

1. Open http://openrouter.ai and create an account.
2. Go to https://openrouter.ai/keys.
3. Click Create Key, give it a name such as researchflow, and copy the key immediately. It looks like sk-or-v1-xxxxxxxxxxxxxxxxxxxx.
4. In the frontend, open any saved paper with a parsed PDF.
5. Scroll to the Full-Text Analysis panel. It shows "Analysis service is not configured" on first use.
6. Click Configure Analysis.
7. Paste the key into the API Key field.
8. Pick a model from the recommended list, or type one manually. The default suggestion is the free model dots-studio/dots-3-note-preview:free.
9. Click Save. The form closes and the panel now shows "Analyze Full Text".

Settings are written to backend/.env and take effect immediately. No backend restart is needed. The .env file is ignored by Git and must not be shared.

Free models on OpenRouter are rate-limited. The default free tier allows about 50 requests per day. Adding 10 USD of credit raises the free-model daily limit to 1000. Paid models are not subject to this free-tier limit.

### Step 6. Verify end to end

In the browser:

1. Search for a keyword such as machine learning.
2. Save a paper.
3. Open the library and confirm the paper appears.
4. Open a paper, find PDF sources, and start processing one. If the publisher blocks the download, use the manual upload option.
5. Wait until parsing completes and expand a section to view chunks.
6. Click Analyze Full Text and wait for the analysis to finish. The panel shows a live timer.
7. Expand any finding to see its source evidence.

If any step fails, check the backend terminal for the error. The frontend surfaces backend error messages directly.

---

## Configuration

The frontend talks to the backend through a Vite dev proxy. Open vite.config.js and confirm it contains:

    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    }

Requests from the frontend to /api/... are forwarded to the backend. The API layer only uses relative paths such as /api/papers/search, so the base URL is never hard-coded.

If the backend port changes, update the proxy target and restart the dev server.

---

## Running the Development Server

Backend, in one terminal:

    cd backend
    .\.venv\Scripts\python.exe -m uvicorn app.main:app

Frontend, in another terminal:

    cd frontend
    npm run dev

The dev server supports hot module replacement. Saving any file under src/ updates the page automatically.

---

## Building for Production

    npm run build

The production bundle is written to dist/. Because the app expects the backend at /api, deploy the built files behind a reverse proxy that also forwards /api to the backend. The development proxy is not applied to production builds.

To preview the production build locally:

    npm run preview

---

## Backend Dependency

Several features rely on backend configuration:

- Paper search uses OpenAlex. Without an API key, casual requests still work but may be rate-limited.
- Full-text analysis needs an OpenRouter key and model. Configure them from the Analysis panel in the UI. Without them, the panel shows a "Configure Analysis" button instead of "Analyze Full Text".
- PDF download from some publishers is blocked by anti-scraping protections. When this happens, use the manual upload option on the paper detail page.

---

## How to Use

The application has two main tabs and a detail view.

Search tab:

1. Enter a query and click Search.
2. A list of matching papers appears.
3. Click Save on any paper to add it to your library.
4. A paper already in the library shows a disabled Saved button.

Library tab:

1. View all saved papers, newest first.
2. Use the filter bar to search within saved papers, filter by year, collection, document status, or analysis status, and sort by saved date, publication year, title, or citation count.
3. Click More filters to expand the advanced filter row.
4. Click Clear to reset all filters.
5. Create, rename, or delete collections from the Collections panel at the top.
6. Click a paper title to open the detail view.
7. Click Delete to remove a paper. Deletion is confirmed first.

Paper detail view:

1. The top card shows metadata, external links, and the abstract.
2. The Collections section lets you assign the paper to any existing collection with a checkbox.
3. The Full-Text Documents section offers two paths:
   - Click Find PDF Sources to look up open-access PDFs and start processing one.
   - Click Upload PDF to upload a PDF you downloaded yourself.
4. During processing, the status block shows retrieval and parsing states. Failures show the error code and a Retry button, a Choose Another Source button, and the manual upload option.
5. After parsing completes, the Extracted Sections block lists detected sections. Click any section to load its text chunks.
6. The Full-Text Analysis panel appears once parsing is complete. Click Analyze Full Text to start the analysis. The panel collapses by default after the first run; click Show to expand it again.
7. When analysis finishes, findings are grouped into Research Problem, Methodology, Key Findings, and Limitations. Click any finding to expand its source evidence, showing the section label, page number, and exact excerpt.

---

## Configuring the Analysis Service

The Full-Text Analysis panel reads its configuration from GET /api/settings/analysis. The response has three fields: model, api_key_configured, and restart_required.

If api_key_configured is false, the panel replaces the Analyze button with a Configure Analysis button. Clicking it opens a form with:

- A model input box, prefilled with the current model.
- A list of suggested models grouped into free and low cost.
- An API Key field, with a Show/Hide toggle.

Clicking a suggested model fills the input box. The form validates the model name against the backend's allowed character set before submitting.

If a key is already configured, leaving the API Key field blank keeps the existing key. Pasting a new key replaces it.

When you click Save, the frontend calls PUT /api/settings/analysis. The backend writes the values to backend/.env and refreshes its runtime client and model immediately, so the next analysis uses the new settings without a restart.

If the analysis fails, the error message and a "Model used" hint are displayed. The user can click Edit settings to change the model or key, then "Run with current settings" to start a fresh analysis with the new configuration. A previous failed run keeps its original model, and the "Run with current settings" button always creates a new run.

---

## API Layer Conventions

All backend calls live under src/api/. Components never import Axios directly.

- client.js creates a single Axios instance with baseURL /api.
- Each domain has its own file: papers.js, documents.js, analyses.js, collections.js, settings.js.
- Each exported function returns the response body already unwrapped.
- Error handling is done at the component level using err.response?.data?.error?.message.

When you add a new endpoint, add the corresponding function in the matching file and keep the same return convention.

---

## State and Data Flow

- App.jsx owns the top-level view state (search, library, or detail) and the selected paper ID.
- Each page manages its own data fetching and local UI state.
- Long-running operations (PDF processing, full-text analysis) use polling with recursive setTimeout. Polling stops on completion or failure and does not accumulate requests.
- Saving a paper updates a local Set of OpenAlex IDs so the Save button reflects the new state immediately, without refetching the search results.
- The Analysis panel loads its settings once on mount. After saving a new configuration, the panel refreshes its local settings state from the PUT response.

---

## Styling Conventions

- Global styles live in src/index.css.
- Base element styles are defined once for button, input, select, a, and headings.
- Button variants are applied with className="primary", "danger", or "small" on top of the base button style.
- Special components such as the tab slider use an id selector.
- Page and component layout classes describe structure only, not appearance.

When adding a new component, prefer reusing existing element and utility styles before writing new rules.

---

## Common Issues

Port already in use: stop the other Vite process or change the port with npm run dev -- --port 5174.

API requests fail with a connection error: confirm the backend is running on port 8000 and the proxy target in vite.config.js matches.

Analysis returns 503 analysis_not_configured: the backend is missing a key or model. Open the Analysis panel and click Configure Analysis.

Analysis returns 429 analysis_rate_limited: the OpenRouter free-model daily limit has been reached. Wait for the reset, add credit, or switch to a paid model.

Analysis returns analysis_model_not_found: the selected model is not available on OpenRouter. Pick another from the suggested list or check the model name.

Analysis returns analysis_invalid_request with "Reasoning is mandatory": the selected model requires reasoning and cannot be used with the current backend payload. Pick a different model.

Analysis returns analysis_unauthorized: the API key was rejected. Open Edit settings and paste a working key.

PDF fails with pdf_download_failed: the publisher blocks automated downloads. Use the manual upload option instead.

PDF fails with NotImplementedError in the backend log: the backend was started with --reload. Stop it and start it without --reload.

Search shows cached results: the backend keeps a seven-day cache and falls back to it when OpenAlex is unavailable. The timestamp is shown under the search bar.

Long analysis runs: the backend splits the full text into batches. A typical short paper takes one to three minutes; a long paper can take ten minutes or more.