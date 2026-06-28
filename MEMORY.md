# Inventory Manager — GitOps Monorepo

## What this repo is

A **DevSecOps demonstration monorepo** that contains a full-stack Inventory Manager application alongside all its infrastructure, CI/CD pipelines, and security tooling. Everything lives here — app code, Terraform, Kubernetes manifests, and GitHub Actions workflows.

The application is a realistic CRUD web app for managing warehouse/office inventory (products, categories, stock levels). It exists as the vehicle for demonstrating a complete enterprise DevSecOps pipeline — not as a product meant for production use.

## Repo structure

```text
.
├── backend/                  # Spring Boot REST API (Java 17, Maven)
├── frontend/                 # Angular 17 SPA (TypeScript, Angular Material)
├── terraform/                # (planned) AWS infrastructure as code
├── kubernetes/               # (planned) K8s manifests for all services
├── .github/workflows/        # (planned) CI/CD, SAST, DAST, linting workflows
├── docker-compose.yml        # Local dev: spins up Postgres + backend + frontend
├── MEMORY.md                 # Project context for humans and agents
├── NOTES.md                  # Lessons learned, technical decisions, gotchas
└── README.md                 # Project overview, DEPI metadata, team
```

## Application

**Inventory Manager** — track products with name, description, category, quantity, and price.

- Status is auto-computed: quantity ≥ 10 → IN_STOCK, 1–9 → LOW_STOCK, 0 → OUT_OF_STOCK
- Dashboard shows live stats and flags items needing restocking
- Products page has search, category filter, and status filter

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Angular 17, Angular Material, TypeScript |
| Backend | Spring Boot 3.2, Spring Data JPA, Bean Validation |
| Database | PostgreSQL 16 (H2 for tests only) |
| Container | Docker (multi-stage builds), Nginx (frontend) |
| Orchestration | Kubernetes (planned) |
| Infrastructure | Terraform on AWS (planned) |

## Running locally

```bash
docker compose up --build
```

- Frontend: <http://localhost:80>
- Backend API: <http://localhost:8080>
- Swagger UI: <http://localhost:8080/swagger-ui.html>
- Postgres: localhost:5432 / db: inventory / user: postgres / pass: postgres

## Backend API

Base URL: `/api/products`

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/products` | List all (supports `?search=`, `?category=`, `?status=`) |
| GET | `/api/products/{id}` | Get by ID |
| POST | `/api/products` | Create product |
| PUT | `/api/products/{id}` | Update product |
| DELETE | `/api/products/{id}` | Delete product |
| GET | `/api/products/categories` | List distinct categories |

## Environment variables (backend)

All credentials are injected via environment variables — map these to Kubernetes secrets:

| Variable | Default | Description |
| --- | --- | --- |
| `DB_HOST` | `localhost` | Postgres host |
| `DB_PORT` | `5432` | Postgres port |
| `DB_NAME` | `inventory` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |

## DevSecOps pipeline (planned workflows)

The `.github/workflows/` directory will contain:

- **backend-ci.yml** — Maven build, JUnit tests, JaCoCo coverage, SonarQube SAST, OWASP Dependency-Check, Trivy image scan, secrets detection (Gitleaks)
- **frontend-ci.yml** — npm install, ESLint, Angular build, Karma unit tests, SonarQube SAST, npm audit, Trivy image scan
- **dast.yml** — Selenium E2E tests + OWASP ZAP dynamic scan against deployed environment
- **terraform.yml** — Terraform plan/apply for AWS infrastructure
- **deploy.yml** — Update Kubernetes manifests and trigger ArgoCD/Flux sync

## Commit message standard

Every commit — whether from a human or an agent — must follow this format:

```text
<type>(<scope>): <short summary>

<body — optional, explain WHY not WHAT>

<footer — optional, e.g. closes #issue, breaking change>
```

### Types

| Type | When to use |
| --- | --- |
| `feat` | A new feature or capability |
| `fix` | A bug fix |
| `infra` | Terraform, Kubernetes, or Docker changes |
| `ci` | GitHub Actions workflow changes |
| `refactor` | Code restructure with no behaviour change |
| `test` | Adding or updating tests |
| `docs` | Documentation only (MEMORY.md, README, comments) |
| `chore` | Dependency bumps, config tweaks, tooling |
| `security` | Security patches, secret rotation, policy changes |

### Scopes

| Scope | Maps to |
| --- | --- |
| `backend` | `backend/` |
| `frontend` | `frontend/` |
| `k8s` | `kubernetes/` |
| `terraform` | `terraform/` |
| `ci` | `.github/workflows/` |
| `root` | Repo-level files (MEMORY.md, docker-compose.yml, .gitignore) |

### Rules

- Summary line: **50 chars max**, lowercase, no period at the end
- Use **imperative mood**: "add endpoint" not "added endpoint"
- Body: wrap at 72 chars, explain the **why** (not the what)
- Never commit secrets, credentials, or generated build artifacts

### Examples

```text
feat(backend): add product search by name endpoint

Search is case-insensitive and delegates to a JPA derived query
to keep the controller thin.
```

```text
fix(frontend): correct status badge colour for LOW_STOCK
```

```text
infra(k8s): add postgres statefulset with persistent volume

Uses a PVC so data survives pod restarts. Secret refs replace
hardcoded credentials in the deployment manifest.
```

```text
ci: add sonarqube sast step to backend workflow

Runs after tests so JaCoCo coverage is available for the scan.
Fails the build if quality gate is not passed.
```

```text
security(backend): upgrade spring-boot to 3.2.5 — CVE-2024-XXXX
```

---

## Key design decisions

- **Monorepo**: all code, infra, and pipelines in one place for simplicity of demonstration
- **PostgreSQL over H2**: enterprise-standard SQL database; H2 is used only in tests so CI needs no external DB
- **Angular Material**: professional UI out of the box, minimal custom CSS required
- **Env-var-driven config**: no secrets hardcoded anywhere; ready for Kubernetes Secrets injection
- **Status auto-computation**: the service layer derives stock status from quantity — no manual status field exposed to the frontend form
- **nginx:alpine-slim over nginx:alpine**: frontend final stage uses `nginx:alpine-slim` (21.8MB vs 93.9MB) — strips bash, apk, and unused modules while keeping static serving, `try_files`, and `proxy_pass`
- **jlink custom JRE for backend**: 3-stage build uses `jdeps` + `jlink` to assemble a minimal JRE with only the modules Spring Boot actually imports (204MB vs 355MB). GraalVM native-image was tried and reverted — produced a larger image (244MB) with 15+ min build time for this stack
