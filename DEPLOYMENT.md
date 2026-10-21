# AssignFlow v0.3.0 - Production Deployment & Operations Guide

This guide provides instructions for deploying and running AssignFlow in a production environment.

---

## 1. Architectural Overview

AssignFlow is a single-tier or multi-tier web service consisting of:
1. **Application Server (FastAPI / Uvicorn)**: Serves the REST API (`/api/*`), static assets (`/css/*`, `/js/*`, `/favicon.svg`), and the compiled single-page frontend (`/`, `/privacy`, `/terms`).
2. **Database (PostgreSQL 14+)**: Stores all relational entities in the dedicated schema `assignflow`.
3. **Storage (Persistent Local/Mounted Volume)**: Stores uploaded assignment PDFs and student submissions (`.pdf`, `.docx`, `.doc`, `.txt`, `.zip`).

---

## 2. Production Startup & Process Management

### Start Command
For standard Linux servers and container environments, use Uvicorn with multiple worker processes:

```bash
# Production start command (bind to all interfaces, multi-worker)
PYTHONPATH=backend .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 --proxy-headers
```

- `--workers 2` (or `2 * CPU cores + 1`): Scales request processing across CPU cores.
- `--proxy-headers`: Ensures client IP addresses, HTTPS schemes, and host headers are properly passed from reverse proxies.

### Database Pre-Deploy Migration Command
Before starting the web application process or routing live traffic, apply database migrations:

```bash
# Apply migrations to head revision (0e1264ec285d)
.venv/bin/alembic -c alembic.ini upgrade head
```

---

## 3. Persistent Storage Requirements

In containerized or stateless hosting platforms (e.g. Docker, Kubernetes, AWS ECS, Fly.io, Railway, Render), the filesystem is ephemeral and recreated on deploy or restart.

To ensure uploaded assignments and student submissions persist permanently:
1. Provision a persistent disk or volume (minimum 10GB recommended).
2. Mount the volume to a path on the host or container (e.g., `/var/data/assignflow`).
3. Set the environment variable:
   ```env
   STORAGE_DIR=/var/data/assignflow
   ```
4. The application will automatically create and organize:
   - `/var/data/assignflow/assignments/` (Teacher assignment PDFs)
   - `/var/data/assignflow/submissions/` (Student submission files)

---

## 4. Custom Domain, DNS & TLS Setup

To connect a custom domain (e.g., `assignflow.yourinstitution.edu`):

### A. DNS Configuration
Configure DNS records with your registrar or DNS provider:

| Record Type | Name / Host | Target / Value | Purpose |
| :--- | :--- | :--- | :--- |
| **A** | `assignflow` (or `@` for apex) | `<Static Public IP of Host/Load Balancer>` | Directs IPv4 traffic to server |
| **AAAA** (Optional) | `assignflow` (or `@`) | `<IPv6 Address of Host>` | Directs IPv6 traffic |
| **CNAME** (Alternative) | `assignflow` | `<Hosting Provider Ingress Domain>` | Used when deploying to managed PaaS |

### B. HTTPS / TLS Termination
All production traffic MUST be encrypted with HTTPS to protect JWT session cookies, passwords, and student submissions.

Use a reverse proxy such as Nginx or Caddy to terminate TLS:

#### Example Caddyfile (Automatic TLS via Let's Encrypt)
```caddyfile
assignflow.yourinstitution.edu {
    reverse_proxy 127.0.0.1:8000
}
```

#### Example Nginx Configuration
```nginx
server {
    listen 80;
    server_name assignflow.yourinstitution.edu;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name assignflow.yourinstitution.edu;

    ssl_certificate /etc/letsencrypt/live/assignflow.yourinstitution.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/assignflow.yourinstitution.edu/privkey.pem;

    client_max_body_size 15M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 5. Production Health Checks & Monitoring

The health check endpoint is accessible without authentication:

```bash
curl -I https://assignflow.yourinstitution.edu/api/health
```

Expected Response:
```json
{
  "status": "healthy",
  "service": "AssignFlow",
  "environment": "production",
  "database": {
    "connected": true,
    "message": "Database connection healthy"
  }
}
```
If the database connection is lost or unreachable, the endpoint returns HTTP status `503 Service Unavailable` with `"status": "degraded"`.

---

## 6. Pre-Launch Checklist

- [ ] Production PostgreSQL database provisioned with `assignflow` schema permissions.
- [ ] Database migrations applied (`alembic -c alembic.ini upgrade head`).
- [ ] `SECRET_KEY` generated (`openssl rand -hex 32`) and set in production environment.
- [ ] `ENVIRONMENT=production` and `DEBUG=False` configured.
- [ ] `ALLOWED_ORIGINS` configured with the exact production domain(s).
- [ ] Persistent storage volume mounted and `STORAGE_DIR` configured.
- [ ] TLS certificate active and HTTP traffic redirected to HTTPS.
- [ ] Owner placeholders in `frontend/pages/privacy.html` and `frontend/pages/terms.html` confirmed.
