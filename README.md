# AssignFlow

AssignFlow is a full-stack assignment management platform designed for college teachers and students.

## Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (no frameworks)
- **Backend**: Python 3.12+ with FastAPI
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Testing**: Pytest

---

## Milestone 1 Status: Project Skeleton & Database Connection (Completed)
- Virtual environment, dependencies, PostgreSQL connectivity, and health check.

## Milestone 2 Status: Assignment CRUD with PostgreSQL (Completed)
- SQLAlchemy `Assignment` model, Pydantic schemas, Alembic migrations, and REST CRUD API endpoints.

## Milestone 3 Status: Glassmorphism Hybrid Frontend (Completed)
✅ **Completed**:
- Approved Glassmorphism Hybrid dashboard implemented using HTML5, CSS3, and Vanilla JavaScript only.
- Left sidebar with AssignFlow branding, navigation items, and teacher profile widget.
- Top navigation with search input, notifications, and profile avatar.
- 4 dynamic statistics summary cards: Total Assignments, Active, Completed, and Overdue.
- Real-time overdue calculation based on deadlines and completion state.
- Interactive toolbar with keyword search, Subject dropdown, Status dropdown, and Sort order.
- Responsive assignment table with status pills, action buttons (Edit & Delete).
- Slide-over right drawer panel for creating and editing assignments.
- Delete confirmation modal and toast notifications for user feedback.
- Off-canvas mobile navigation and responsive layout.
- Connected directly to live FastAPI backend (`/api/assignments`) and PostgreSQL database.



---

## Getting Started

### 1. Prerequisites
- Python 3.12 or newer
- PostgreSQL running locally

### 2. Environment Setup
The project uses a Python virtual environment:
```bash
# Activate virtual environment
source .venv/bin/activate
```

If setting up on a new machine:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 3. Database Configuration
Copy the template environment file if needed:
```bash
cp .env.example .env
```

Ensure `DATABASE_URL` in `.env` points to your PostgreSQL instance:
```env
DATABASE_URL=postgresql+psycopg2://<username>:<password>@127.0.0.1:5432/<dbname>
```

### 4. Running the Tests
To execute the automated test suite:
```bash
./.venv/bin/pytest -v backend/tests
```

### 5. Running the Application
Start the FastAPI server:
```bash
PYTHONPATH=backend ./.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- **Frontend UI**: Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) in your browser.
- **Health Check Endpoint**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
- **Interactive API Docs (Swagger UI)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
