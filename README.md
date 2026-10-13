# ResearchFlow

ResearchFlow is a web-based research information management system. It aims to extract and organise evidence from full academic papers while keeping each finding linked to its source.

## Research Question

How effectively can a web-based system extract, organise, and synthesise evidence from full academic papers while keeping the results accurate and traceable?

## MVP Goal

The MVP analyses one paper per run. It retrieves a machine-readable open-access PDF or accepts a user-provided PDF that the user has permission to process, analyses its full text, and returns structured findings with supporting evidence. Uploading a file does not establish its access rights or licence.

### In Scope

- Search academic papers using OpenAlex
- View paper metadata and abstracts
- Save and manage papers in a research library
- Process one machine-readable open-access PDF at a time
- Upload a PDF from the paper details page when automatic retrieval is unavailable or fails
- Extract text while keeping page and section information
- Identify the research problem, methodology, key findings, and limitations
- Link every finding to a page, section, and source excerpt
- Show clear processing states and failure reasons

### Out of Scope for the MVP

- Scanned PDFs and optical character recognition
- HTML full-text processing
- Bypassing paywalls or access controls
- Multi-paper comparison and synthesis
- Research gap discovery
- Automatic production of a complete literature review

## User Workflow

```text
Search for a paper
  ↓
Save the paper record
  ↓
Select an open-access PDF source or upload a PDF
  ↓
Retrieve or upload the file, then parse the full text
  ↓
Identify sections and split the text
  ↓
Extract structured findings
  ↓
Link findings to source evidence
  ↓
Review the findings and evidence
```

## MVP Success Criteria

- A suitable PDF can pass through the complete workflow
- The system keeps page and section information during text extraction
- Every finding has at least one supporting source excerpt
- Unsupported information is marked as unavailable
- Retrieval, parsing, and analysis failures are shown clearly
- The first workflow is checked with three to five suitable papers
- The completed MVP is later evaluated with about 10 to 15 papers

## Future Work

Multi-paper comparison will start only after single-paper analysis is stable and evaluated. A later version may let users select two to five analysed papers, compare their research problems, methods, findings, and limitations, and trace each comparison result back to its evidence.

HTML processing and scanned document support may be considered later. They are not part of the first implementation.

## Technology Stack

### Frontend

- React

### Backend

- Python
- FastAPI

### Database

- SQLite

### External Services

- OpenAlex API
- OpenRouter API

## Project Structure

```text
researchflow/
├── backend/
│   └── README.md
├── frontend/
│   └── README.md
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   ├── api-contract.md
│   ├── development-workflow.md
│   └── mock-data/
│       └── first-slice.json
├── .gitignore
└── README.md
```

The local `experiments/` folder is ignored by Git. Existing backend tests are in `backend/tests/`. The development workflow describes how to run checks and handle temporary test files.

## Current Status

The frontend connects to the backend for paper search, library queries and collections, PDF retrieval and upload, processing status, analysis, and source evidence. Final end-to-end acceptance and evaluation across different papers remain outstanding.

Implemented:

- OpenAlex search and abstract retrieval
- SQLite paper saving, listing, details, and deletion
- Library search, filters, sorting, and collection management
- Search cache fallback with cache timestamps
- Open-access PDF source lookup and bounded downloads
- Manual PDF upload with confirmation of the paper and permission to process it
- Background document processing, status queries, and retries
- Page text, sections, and source-linked chunks stored in SQLite
- Queued full-text analysis, status queries, and explicit retries
- Four finding categories with exact source excerpts, page locations, and evidence queries
- Frontend controls for library management, PDF processing, analysis results, and evidence

A recorded live check completed PDF processing, analysis, evidence storage, and result retrieval after restart for one paper. Key results are in `backend/README.md`; evaluation across more papers remains outstanding.

The MVP needs machine-readable PDFs. Publisher restrictions may block downloads, and unusual layouts can affect text and section extraction. Evidence links locate source text but do not guarantee correct conclusions.

Next:

- Verify the complete frontend and backend workflow in the demonstration environment
- Check extraction quality on papers with different layouts
- Check failure, retry, and result recovery behaviour with the configured analysis service
- Evaluate accuracy and traceability
