# AssignFlow v0.4.0 - Staging Deployment & Verification Guide

This guide establishes the requirements, architecture, environment configuration, and verification procedures for the **AssignFlow Staging Environment**.

Staging serves as a production-mirror environment designed to validate end-to-end academic workflows, student experience enhancements, role-based security boundaries, database migrations, and responsive UI behaviors on isolated test fixtures before promoting changes to production.

---

## 1. Architectural Principles & Isolation Guarantees

Staging must adhere to strict isolation principles to ensure test activities never impact production operations or user data:

1. **Complete Database Isolation**: Staging must connect to a dedicated staging PostgreSQL database. Staging must never share a database, schema, or credentials with the production environment.
2. **Dedicated Storage Volume**: Uploaded assignment PDFs and student submission files must be written to an isolated staging persistent storage directory.
3. **Dedicated Authentication Secrets**: Staging must use a unique `SECRET_KEY` separate from production and development to prevent cross-tier JWT token acceptance.
4. **Zero Production Data Contamination**: Staging must use isolated, synthetic teacher and student test fixtures. Real student records, grades, or personal details must never be imported into staging.
5. **Production Parity**: Staging must run with `DEBUG=False` and strict CORS to mirror production security boundaries.

---

## 2. Configuration & Environment Variables

A template configuration file is provided at [`.env.staging.example`](file:///home/rishi/Pictures/Projects/AssignFlow/.env.staging.example). On staging servers or cloud container platforms (Render, Fly.io, Railway, AWS ECS), set these variables in the environment configuration or secret manager:

| Environment Variable | Recommended Staging Value | Purpose & Constraints |
|---|---|---|
| `PROJECT_NAME` | `AssignFlow (Staging)` | Service identifier displayed in headers and health checks. |
| `ENVIRONMENT` | `staging` | Runtime environment tier. Triggers production-mirror security rules. |
| `DEBUG` | `False` | **Mandatory**: Must be `False` to prevent stack trace leaks and enforce secure cookies. |
| `CANONICAL_URL` | `https://staging.assignflow.example.edu` | Canonical HTTPS URL for staging frontend. |
| `SECRET_KEY` | *(Unique 32-byte hex string)* | Secret for signing JWT session cookies. Generate with `openssl rand -hex 32`. Never reuse production key. |
| `ALGORITHM` | `HS256` | JWT signature algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Session lifetime (24 hours). |
| `COOKIE_NAME` | `access_token` | HTTP cookie name for the session token. |
| `COOKIE_SECURE` | `True` | Transmit session cookies exclusively over HTTPS. |
| `DATABASE_URL` | `postgresql+psycopg2://...` | Connection URL to isolated staging DB with `?options=-csearch_path%3Dassignflow,public`. |
| `ALLOWED_ORIGINS` | `https://staging.assignflow.example.edu` | Comma-separated list of allowed origins. Wildcards (`*`) are prohibited. |
| `STORAGE_DIR` | `/var/data/assignflow-staging` | Mount path of persistent block volume. |
| `MAX_UPLOAD_SIZE_MB` | `10` | Maximum upload size per submission or assignment PDF. |
| `SMTP_HOST` | *(Optional / Sandbox)* | Staging SMTP relay (e.g., Mailtrap/Mailhog) for outbound email testing. Optional. |

---

## 3. Database & Schema Requirements

AssignFlow isolates its tables within the PostgreSQL schema `assignflow`.

### Prerequisites for the Staging Database
1. **Engine**: PostgreSQL 14 or higher.
2. **User Privileges**: The staging database role must have permission to create the schema and execute DDL:
   ```sql
   CREATE DATABASE assignflow_staging;
   \c assignflow_staging
   CREATE SCHEMA IF NOT EXISTS assignflow;
   GRANT ALL ON SCHEMA assignflow TO staging_db_user;
   ALTER ROLE staging_db_user SET search_path TO assignflow, public;
   ```
3. **Connection String**: The connection string in `DATABASE_URL` must include the search path option:
   ```
   postgresql+psycopg2://staging_db_user:staging_password@staging-db.internal:5432/assignflow_staging?options=-csearch_path%3Dassignflow,public
   ```

### Preflight Migration Procedure
Before routing traffic to a newly deployed staging container:
```bash
# 1. Verify connection and current migration status
.venv/bin/alembic -c alembic.ini current

# 2. Apply all pending migrations to head
.venv/bin/alembic -c alembic.ini upgrade head

# 3. Confirm head revision matches repository head (0e1264ec285d)
.venv/bin/alembic -c alembic.ini heads
```

---

## 4. Persistent Storage Requirements

In modern containerized deployments, local container filesystems are ephemeral. Any restarts, scaling events, or redeployments will discard newly uploaded files unless backed by a persistent disk.

1. **Volume Mount**: Provision a persistent block storage volume (minimum 10 GB) and mount it into the container (e.g. at `/var/data/assignflow-staging`).
2. **Directory Layout**: When `STORAGE_DIR=/var/data/assignflow-staging` is set, the application automatically initializes and manages:
   - `/var/data/assignflow-staging/assignments/` (Teacher assignment PDFs)
   - `/var/data/assignflow-staging/submissions/` (Student submission files)
3. **Permissions**: Ensure the system user executing Uvicorn owns or has write permissions (`0750` or `0755`) on the mount point.

---

## 5. Network, HTTPS & CORS Configuration

1. **HTTPS / TLS Termination**:
   - All browser traffic to staging must be encrypted via HTTPS.
   - Use an automated reverse proxy (Caddy, Nginx + Let's Encrypt, AWS ALB, or Cloudflare).
2. **Proxy Header Forwarding**:
   Ensure reverse proxies pass real client schemes and host headers so FastAPI generates accurate HTTPS links and evaluates secure cookies:
   ```nginx
   proxy_set_header Host $host;
   proxy_set_header X-Real-IP $remote_addr;
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   proxy_set_header X-Forwarded-Proto $scheme;
   ```
3. **CORS Restrictions**:
   `ALLOWED_ORIGINS` must match the exact staging domain scheme and host (e.g. `https://staging.assignflow.example.edu`). Wildcards are prohibited in staging to ensure that browser CORS behavior replicates production.

---

## 6. Isolated Test Fixtures & Sample Data

Staging environments must be initialized with synthetic, isolated test accounts:

| Role | Email Identifier | Password | Responsibilities |
|---|---|---|---|
| **Teacher** | `smoke_teacher@example.com` | *(Strong Staging Password)* | Class management, assignment creation (draft and published), SpeedGrader, grade release, re-evaluation review. |
| **Student 1** | `smoke_student_alpha@example.com` | *(Strong Staging Password)* | Submissions, material download, results review, re-evaluation requests. |
| **Student 2** | `smoke_student_beta@example.com` | *(Strong Staging Password)* | Peer student for verifying peer anonymization (`Student #N`) on class leaderboards. |
| **Student 3** | `smoke_student_gamma@example.com` | *(Strong Staging Password)* | Unenrolled student for verifying access control barriers. |

### Minimum Staging Test Data Set:
* **Academic Semester**: `Staging Fall 2026`
* **Test Class**: `SMOKE-101 Systems Architecture` (Join code: `SMOKE101`)
* **Subject**: `Operating Systems`
* **Assignments**:
  1. `Assignment 1 (Published)`: Published status, due date in future, PDF attachment uploaded.
  2. `Assignment 2 (Draft)`: Draft status, PDF attachment uploaded (verifies draft privacy).

---

## 7. Staging Smoke-Test Execution & Pass/Fail Criteria

Execute the 13 verification scenarios defined in the [Staging Smoke Test Checklist](file:///home/rishi/Pictures/Projects/AssignFlow/backend/tests/test_academic_workflow.py).

### Summary of Pass/Fail Criteria:
1. **Student Dashboard Scoping**:
   - **Pass**: Only published assignments appear in upcoming widgets and metrics.
   - **Fail**: Draft assignment title or materials appear for students.
2. **Join Code Privacy**:
   - **Pass**: Join code badge and copy button are hidden from students on class cards and Course Overview.
   - **Fail**: Join code is rendered in the student session.
3. **Direct Parameterized Hash Refresh**:
   - **Pass**: Direct hard refresh (Ctrl+F5) on `#classes/:id` and `#subjects/:id` cleanly loads the view and breadcrumbs.
   - **Fail**: White screen, router crash, or redirect to login.
4. **Draft Question Material Access**:
   - **Pass**: Direct GET to `/api/assignments/<draft_id>/download-question` returns HTTP 404/403 for students.
   - **Fail**: Student successfully downloads draft assignment PDF.
5. **Submission & Resubmission Policy**:
   - **Pass**: First submission succeeds; second submission is rejected when `allow_resubmission=False`.
   - **Fail**: Second submission silently overwrites first submission without authorization.
6. **SpeedGrader & Draft Grade Privacy**:
   - **Pass**: Ungraded / draft grades remain invisible to students until teacher clicks "Release Grades".
   - **Fail**: Student can view draft scores before explicit release.
7. **Submission Attempt History**:
   - **Pass**: Modal fetches `/api/submissions/<id>/history` and displays timestamped history timeline.
   - **Fail**: Modal shows HTTP 404 error or empty state.
8. **Re-evaluation Workflow**:
   - **Pass**: Student clicks "Request Re-evaluation", status changes to `reevaluation_requested`, teacher receives in-app notification. Teacher resolves request, student receives resolution notification with updated score.
   - **Fail**: Request button missing, API fails, or notifications are not recorded.
9. **Role Protection & Peer Anonymity**:
   - **Pass**: Direct navigation to `#grading` or `#rubrics` redirects student to `#dashboard`. Leaderboard masks peers as `Student #N`.
   - **Fail**: Student can view grading screens or see unmasked peer names.
10. **Narrow Viewport Usability (<768px)**:
    - **Pass**: Off-canvas drawer navigates cleanly; modal dialogs fit within viewport with accessible buttons.
    - **Fail**: Horizontal blowout or unclickable submit buttons.

---

## 8. Application Support Analysis & Startup Validation Gap

### Current Implementation State
An audit of `backend/app/core/config.py` reveals the following behavior:
```python
if self.ENVIRONMENT.lower() == "production":
    if self.SECRET_KEY == "assignflow-super-secret-jwt-key-2026-production-ready":
        raise ValueError("Insecure SECRET_KEY: A custom secret key must be set in production.")
    if self.DEBUG:
        raise ValueError("Insecure DEBUG mode: DEBUG must be set to False in production.")
    if self.ALLOWED_ORIGINS == "*" or not self.ALLOWED_ORIGINS.strip():
        raise ValueError("Insecure ALLOWED_ORIGINS: Wildcard origins ('*') are prohibited in production.")
```

### The Staging Gap
- When `ENVIRONMENT=staging` is supplied, the current `validate_production_settings()` method skips these checks because it strictly checks `== "production"`.
- Consequently, an operator could configure `ENVIRONMENT=staging` while inadvertently leaving `DEBUG=True`, default `SECRET_KEY`, or wildcard `ALLOWED_ORIGINS="*"`. The application would start without raising validation errors, thereby weakening staging security safeguards.
- In `backend/app/api/auth.py`, session cookie security currently relies on:
  ```python
  is_secure = not settings.DEBUG and settings.ENVIRONMENT != "development"
  ```
  If `DEBUG=True` were left enabled in staging, cookies would be transmitted as `secure=False` over HTTP.

### Implementation Status
The startup validation fix has been implemented in `backend/app/core/config.py`:
```python
        env = self.ENVIRONMENT.lower()
        if env in ("production", "staging"):
            if self.SECRET_KEY == "assignflow-super-secret-jwt-key-2026-production-ready":
                raise ValueError(f"Insecure SECRET_KEY: A custom secret key must be set in {env}.")
            if self.DEBUG:
                raise ValueError(f"Insecure DEBUG mode: DEBUG must be set to False in {env}.")
            if self.ALLOWED_ORIGINS == "*" or not self.ALLOWED_ORIGINS.strip():
                raise ValueError(f"Insecure ALLOWED_ORIGINS: Wildcard origins ('*') are prohibited in {env}.")
        return self
```

This ensures:
- `staging` and `production` enforce identical security safeguards (custom `SECRET_KEY`, `DEBUG=False`, explicit non-wildcard `ALLOWED_ORIGINS`).
- `development` retains its permissive defaults.
- Any attempt to launch staging with insecure placeholder settings fails fast during startup with an informative `ValueError`.
