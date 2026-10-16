# AssignFlow

> **Full-Stack College Assignment Management & Evaluation Platform**<br>
> Built with FastAPI, PostgreSQL, SQLAlchemy, and a Zero-Framework Vanilla JavaScript SPA.

[![Python](https://img.shields.io/badge/Python-3.12%2B-blue?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0%2B-red)](https://www.sqlalchemy.org/)
[![Vanilla JS](https://img.shields.io/badge/Frontend-Vanilla%20JS%20%7C%20HTML5%20%7C%20CSS3-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Pytest](https://img.shields.io/badge/Tests-147%20Passed-brightgreen?logo=pytest&logoColor=white)](https://docs.pytest.org/)

---

## Overview

In collegiate academic environments, coursework distribution and grading workflows are frequently fragmented across disparate email threads, cloud drives, and generic forms. Instructors struggle with downloading dozens of student files, managing offline evaluation rubrics, and accidentally leaking preliminary scores to students. Meanwhile, students encounter confusing deadlines, ambiguous submission statuses, and inconsistent feedback channels.

**AssignFlow** is a purpose-built, high-performance web platform designed to unify the end-to-end assignment lifecycle for colleges. It provides instructors with a split-screen **SpeedGrader** workspace for evaluating PDF and DOCX submissions directly in the browser, a **two-phase draft/release grading pipeline**, automated course rosters with join codes, and secure bulk data exports. For students, AssignFlow delivers an intuitive, deadline-aware portal to review course assignments, submit files, and inspect detailed evaluation rubrics and teacher feedback once grades are published.

---

## Core Features

### 1. Role-Based Authentication & Session Security
- **Role Isolation**: Distinct workspaces and permission boundaries for `teacher` and `student` accounts.
- **Secure Sessions**: HTTP-only, SameSite-compliant JWT cookie authentication (`access_token`) paired with salted `bcrypt` password hashing.
- **Production Guardrails**: Automated startup validation that enforces non-default JWT secrets, disables debug mode, and restricts CORS origins in production environments.

### 2. Classroom & Enrollment Management
- **Course Administration**: Instructors can organize curricula by creating courses with unique 6-character alphanumeric join codes (e.g., `CS101A`).
- **Self-Service Enrollment**: Students join classrooms using course join codes without requiring administrative intervention.
- **Roster Visibility**: Teachers can inspect enrolled students, monitor per-class rosters, and filter assignments and submissions by course.

### 3. Assignment Publishing & Question Attachments
- **Lifecycle Management**: Full CRUD capabilities for assignments with course associations, subject tags, maximum score thresholds, and deadline timestamps.
- **Question PDF Attachments**: Instructors can upload question sheets (PDF validation up to 10 MB) stored securely on the server and downloadable by enrolled students.
- **Live Deadline Tracking**: Real-time status badges (`Active`, `Overdue`, `Completed`) dynamically calculated against server time.

### 4. Student Submissions & Privacy Protection
- **Multi-Format Submissions**: Supports document uploads across standard formats (`.pdf`, `.docx`, `.doc`, `.txt`, `.zip`) with optional submission notes.
- **Collision-Resistant Storage**: Sanitized filenames with unique timestamp prefixes to prevent filesystem collisions and directory traversal.
- **Student Ownership Isolation**: Robust authorization checks ensure students can only submit to, view, and download their own work. Peer submissions remain strictly inaccessible.

### 5. In-Browser SpeedGrader & Document Preview
- **Split-Screen Workspace**: Teachers grade submissions in an integrated split-view modal without downloading individual files.
- **Native PDF Rendering**: In-browser PDF display using sandboxed iframes and secure byte streaming.
- **Secure DOCX Conversion**: Automated server-side DOCX-to-HTML conversion via `mammoth`, paired with strict HTML sanitization, script tag stripping, and Content Security Policy (CSP) headers to prevent XSS.
- **Graceful Fallbacks**: Formats without in-browser rendering support provide immediate, secure direct download links.

### 6. Two-Phase Grading: Draft & Release Workflow
- **Draft Evaluation**: Instructors record marks, percentages, and detailed qualitative feedback in draft mode. Draft grades remain completely invisible to students.
- **Targeted Release**: Instructors release grades individually or in bulk. Once released, submission status updates to `Released`, triggering timestamped scorecards in the student portal.
- **Concurrency Safety**: Database row-level locking (`SELECT ... FOR UPDATE`) prevents race conditions during simultaneous grading sessions.

### 7. Bulk Operations & Data Exports
- **Selective Bulk Release**: Checkbox-driven roster selection allowing teachers to release grades for multiple eligible graded students simultaneously.
- **Gradebook CSV Export**: Generates gradebook reports with student names, emails, scores, feedback, and submission dates. Includes formula-injection sanitization (escaping characters like `=`, `+`, `-`, `@`).
- **Disk-Backed ZIP Archive Export**: Packages student submission files into a downloadable archive. Built with streaming temporary file buffers and automated background cleanup to prevent memory exhaustion under high concurrency. Original teacher attachments are strictly excluded.

### 8. Analytics & Deadlines Agenda
- **Instructor Analytics**: Tracks submission completion rates, average scores, and pending grading queues across courses.
- **Student Deadlines Agenda**: Calendar-style timeline highlighting upcoming due dates, recently graded work, and submission receipts.
- **Local Cache Management**: Quick-clear settings to purge client-side cached data while keeping the active authentication session intact.

---

## Architecture & Technology Stack

AssignFlow follows a clean decoupled client-server architecture. The backend exposes RESTful API endpoints, while the frontend operates as a lightweight Single-Page Application (SPA) with zero external JavaScript dependencies or build tooling.

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Browser                          │
│   Vanilla JS SPA (ES6+) • Hash Routing • Modular HTML/CSS   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON / Cookies
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (Python)                 │
│  ┌───────────────────────┬───────────────────────────────┐  │
│  │  Auth & Middleware    │  API Routers                  │  │
│  │  • JWT Cookie Auth    │  • /api/auth    • /api/classes│  │
│  │  • Bcrypt Password    │  • /api/assign  • /api/subs   │  │
│  │  • Production Check   │  • /api/health  • /api/dash   │  │
│  └───────────────────────┴───────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Business Logic & Document Processing                 │  │
│  │  • SpeedGrader Engine   • Mammoth DOCX Sanitization   │  │
│  │  • Tempfile ZIP Stream  • CSV Formula Injection Esc   │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────┬─────────────────────────────┬───────────────┘
                │ SQLAlchemy 2.0 ORM          │ Filesystem
                ▼                             ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│     PostgreSQL Database     │ │   Secure Upload Storage     │
│  • Users & Classes          │ │   • Question PDFs           │
│  • Assignments & Submissions│ │   • Student Submissions     │
│  • Row-Level Lock Audits    │ │   • Clean Tempfile Spool    │
└─────────────────────────────┘ └─────────────────────────────┘
```

| Component | Technology | Rationale |
|---|---|---|
| **Backend Framework** | [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12+) | High-throughput asynchronous routing, automatic OpenAPI generation, and native Pydantic validation. |
| **Database & ORM** | [PostgreSQL](https://www.postgresql.org/) + [SQLAlchemy 2.0](https://www.sqlalchemy.org/) | ACID compliance, schema migrations via Alembic, and row-level locking for concurrent grading workflows. |
| **Migrations** | [Alembic](https://alembic.sqlalchemy.org/) | Linear, version-controlled database schema evolution. |
| **Frontend Architecture** | Semantic HTML5, CSS3, Vanilla JS (ES6+) | Instant page loads, zero runtime bundle overhead, hash-based SPA routing without complex build steps. |
| **Document Processing** | [Mammoth](https://github.com/mwilliamson/python-mammoth) | Converts DOCX to clean HTML for safe in-browser previews inside SpeedGrader. |
| **Security & Auth** | `bcrypt` + `pyjwt` | Industry-standard password hashing and cryptographically signed JWT cookies. |
| **Testing Suite** | [Pytest](https://docs.pytest.org/) + FastAPI `TestClient` | 147 automated unit, integration, and security regression tests. |

---

## Modular Frontend Component System

To eliminate oversized HTML documents while preserving zero-framework compatibility, AssignFlow organizes its frontend into reusable HTML components and page views assembled via a deterministic script:

```
frontend/
├── components/                    # Reusable UI components
│   ├── navbar.html                # Top bar: search, notifications, profile menu
│   ├── sidebar.html               # Navigation links, course items, branding
│   ├── assignment-drawer.html     # Slide-out drawer for assignment CRUD
│   └── modals.html                # Dialogs: SpeedGrader, auth, submit, preview, confirm
├── pages/                         # SPA Page Views (Hash-routed)
│   ├── dashboard.html             # Overview metrics & quick tasks
│   ├── assignments.html           # Assignment table, filter toolbar & cards
│   ├── classes.html               # Course management & enrollment
│   ├── submissions.html           # Submissions roster & status
│   ├── calendar.html              # Deadlines agenda & schedule
│   ├── analytics.html             # Grade distributions & KPIs
│   └── settings.html              # User preferences & cache controls
├── css/
│   └── style.css                  # Custom styling (design tokens, responsive breakpoints)
├── js/
│   └── app.js                     # SPA routing, state, API client & DOM events
├── assemble.py                    # Build & integrity verification tool
├── index.template.html            # Clean 55-line entry shell with <!-- @include --> tags
└── index.html                     # Production-ready assembled entry point served by FastAPI
```

### Developing with Modular Components

1. **Edit Component or Page Files**: Make modifications directly inside `frontend/components/` or `frontend/pages/`.
2. **Reassemble `index.html`**:
   ```bash
   python3 frontend/assemble.py --build
   ```
3. **Validate Assembly Synchronization**:
   ```bash
   python3 frontend/assemble.py --check
   ```
   *Note: `frontend/assemble.py --check` runs automatically inside `backend/tests/test_frontend.py` to prevent out-of-sync commits.*

---

## Getting Started (Linux Setup)

### 1. Prerequisites
- **Python**: 3.12 or newer
- **PostgreSQL**: 14 or newer (or Docker container)
- **Git**

### 2. Clone Repository & Setup Virtual Environment
```bash
git clone <repository-url>
cd AssignFlow

# Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies
```bash
# Install all backend dependencies (including Mammoth for DOCX evaluation preview)
pip install -r backend/requirements.txt
```

### 4. Configure Environment Variables
Copy the sample environment file:
```bash
cp .env.example .env
```

Review `.env` and adjust the database credentials to match your PostgreSQL server:
```ini
PROJECT_NAME=AssignFlow
ENVIRONMENT=development
DEBUG=True

# Format: postgresql+psycopg2://<user>:<password>@<host>:<port>/<dbname>
DATABASE_URL=postgresql+psycopg2://support_app:rishi12@127.0.0.1:5432/ai_support_platform?options=-csearch_path%3Dassignflow,public

# Allowed CORS origins (comma-separated or * for development)
ALLOWED_ORIGINS=*

# Custom JWT secret (required for production environments)
SECRET_KEY=assignflow-super-secret-jwt-key-2026-production-ready
```

### 5. Apply Database Migrations
Run Alembic migrations to apply all schema revisions:
```bash
.venv/bin/alembic upgrade head
```

### 6. Start the Application

You can start the platform using the automated management script or directly via Uvicorn:

#### Option A: Using the Management Script (Recommended)
```bash
chmod +x run.sh stop.sh
./run.sh
```
*`run.sh` automatically checks PostgreSQL availability, runs pending Alembic migrations, and launches the FastAPI server with hot-reload enabled.*

To cleanly stop the application and background processes:
```bash
./stop.sh
```

#### Option B: Direct Uvicorn Launch
```bash
PYTHONPATH=backend .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## Access Points & API Documentation

Once the server is running, access the following endpoints in your browser:

- **Web Application**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Interactive OpenAPI Documentation (Swagger UI)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Alternative API Documentation (ReDoc)**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **Health Check Endpoint**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

### Health Check Response
```json
{
  "status": "healthy",
  "service": "AssignFlow",
  "environment": "development",
  "database": {
    "connected": true
  }
}
```

---

## Testing & Quality Assurance

AssignFlow maintains a test suite of **147 automated tests** covering authentication, grading logic, file handling, export safety, and frontend integrity.

```bash
# Run the complete test suite
.venv/bin/pytest backend/tests/ -v

# Run with concise summary
.venv/bin/pytest backend/tests/ -q
```

### Targeted Test Suites

| Test Module | Coverage Scope | Command |
|---|---|---|
| **Frontend & Assembly** | Modular component existence, key DOM IDs, CSS cascade, and assembly sync | `.venv/bin/pytest backend/tests/test_frontend.py -v` |
| **SpeedGrader & Workflows** | Teacher grading, draft marks, release status, and student visibility | `.venv/bin/pytest backend/tests/test_grading.py -v` |
| **Bulk Ops & Exports** | Selective bulk release, CSV formula escaping, and ZIP streaming | `.venv/bin/pytest backend/tests/test_bulk_and_exports.py -v` |
| **DOCX Preview & Sanitization** | HTML conversion, script sanitization, and CSP headers | `.venv/bin/pytest backend/tests/test_docx_preview.py -v` |
| **Authentication & AuthZ** | Password hashing, JWT cookie sessions, and role checks | `.venv/bin/pytest backend/tests/test_auth.py -v` |
| **Classes & Enrollments** | Join codes, enrollment limits, and roster queries | `.venv/bin/pytest backend/tests/test_classes.py -v` |
| **Submissions & Permissions** | Upload validations, student isolation, and teacher ownership | `.venv/bin/pytest backend/tests/test_submissions.py -v` |

---

## Environment Variables Reference

| Variable | Type | Default | Description |
|---|---|---|---|
| `PROJECT_NAME` | string | `AssignFlow` | Display name of the application. |
| `ENVIRONMENT` | string | `development` | Deployment environment (`development` or `production`). |
| `DEBUG` | boolean | `True` | Enables debug mode in development. Must be `False` in production. |
| `DATABASE_URL` | string | *(PostgreSQL connection URI)* | SQLAlchemy database connection string. |
| `SECRET_KEY` | string | *(assignflow-secret)* | Secret key for signing JWT tokens. A unique secret is enforced in production. |
| `ALLOWED_ORIGINS` | string | `*` | Comma-separated trusted origins for CORS. Wildcards (`*`) are rejected in production. |
| `MAX_UPLOAD_SIZE_MB` | integer | `10` | Maximum allowed file upload size in megabytes. |
| `UPLOAD_DIR` | path | `backend/app/uploads/assignments` | Storage directory for teacher question attachments. |
| `SUBMISSIONS_UPLOAD_DIR` | path | `backend/app/uploads/submissions` | Storage directory for student submission files. |

---

## Repository Structure

```
AssignFlow/
├── backend/
│   ├── alembic/                   # Alembic database migration scripts
│   │   ├── versions/              # Migration revision scripts (1..6)
│   │   └── env.py                 # Alembic migration environment
│   ├── app/
│   │   ├── api/                   # FastAPI route handlers
│   │   │   ├── assignments.py     # Assignment CRUD, submissions, grading & exports
│   │   │   ├── auth.py            # User registration, login, logout, and me
│   │   │   ├── classes.py         # Classroom creation, enrollment, and rosters
│   │   │   ├── dashboard.py       # Role-scoped KPI metrics and stats
│   │   │   ├── health.py          # Service health and database probe
│   │   │   └── submissions.py     # Direct submission queries and status
│   │   ├── core/                  # Application configuration & security
│   │   │   ├── auth.py            # JWT utilities, password hashing, dependencies
│   │   │   └── config.py          # Pydantic BaseSettings & startup validators
│   │   ├── db/                    # Database session & engine management
│   │   ├── models/                # SQLAlchemy database models
│   │   │   ├── assignment.py      # Assignment table model
│   │   │   ├── classroom.py       # Class and ClassEnrollment models
│   │   │   ├── submission.py      # Submission table model
│   │   │   └── user.py            # User authentication model
│   │   ├── schemas/               # Pydantic validation schemas
│   │   └── main.py                # FastAPI entry point, CORS, and static mounting
│   ├── tests/                     # 147 Pytest test cases
│   └── requirements.txt           # Python backend dependencies
├── frontend/
│   ├── components/                # Modular HTML components (navbar, sidebar, modals, drawer)
│   ├── pages/                     # SPA view panels (dashboard, assignments, classes, etc.)
│   ├── css/
│   │   └── style.css              # Custom responsive stylesheet & design tokens
│   ├── js/
│   │   └── app.js                 # Vanilla JS SPA controller & API client
│   ├── assemble.py                # Component compiler and integrity checker
│   ├── index.template.html        # Declarative HTML shell
│   └── index.html                 # Production entry point served by backend
├── .env.example                   # Sample environment configuration template
├── .gitignore                     # Git ignore rules
├── alembic.ini                    # Alembic configuration file
├── run.sh                         # Linux startup & migration automation script
├── stop.sh                        # Clean shutdown automation script
└── README.md                      # Project documentation
```

---

## License

This project is licensed under the MIT License.
