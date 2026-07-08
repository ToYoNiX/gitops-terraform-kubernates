# Inventory Manager — GitOps Monorepo

## What this repo is

A **DevSecOps demonstration monorepo** that contains a full-stack Inventory Manager application alongside all its infrastructure, CI/CD pipelines, and security tooling. Everything lives here — app code, Terraform, Kubernetes manifests, Ansible playbooks, and GitHub Actions workflows.

The application is a realistic CRUD web app for managing warehouse/office inventory (products, categories, stock levels). It exists as the vehicle for demonstrating a complete enterprise DevSecOps pipeline — not as a product meant for production use.

## Repo structure

```text
.
├── backend/                  # Spring Boot REST API (Java 17, Maven)
├── frontend/                 # Angular 17 SPA (TypeScript, Angular Material)
├── terraform/                # On-prem VM provisioning (libvirt provider, QEMU/KVM, cloud-init)
├── ansible/                  # Roles: common (node prep), k3s-server, k3s-agent, argocd
├── k8s/                      # Kubernetes manifests (Kustomize + ArgoCD)
│   ├── apps/                 # ArgoCD App-of-Apps: one Application manifest per component
│   ├── base/                 # Shared manifests (postgres, backend, frontend)
│   ├── overlays/prod/        # namespace prod, images :prod, TLS ingress (main branch)
│   ├── overlays/dev/         # namespace dev, images :dev, HPA capped at 1 (dev branch)
│   ├── cert-manager/         # ClusterIssuer, wildcard Certificate, coredns-custom ConfigMap
│   ├── duckdns-webhook/      # Rendered manifests of the DuckDNS DNS-01 solver webhook
│   └── monitoring-extras/    # ServiceMonitors (prod + dev) + Grafana JVM dashboard ConfigMap
├── monitoring/               # Docker Compose monitoring stack for local dev (not deployed to k8s)
├── tests/e2e/                # Selenium smoke tests (used by the DAST workflow)
├── .github/workflows/        # CI/CD pipelines (backend-ci, frontend-ci, dast)
├── docker-compose.yml        # Local dev: Postgres + backend + frontend + Prometheus + Grafana
├── MEMORY.md                 # Project context for humans and agents
├── NOTES.md                  # Lessons learned, technical decisions, gotchas, ops one-liners
├── SETUP.md                  # Numbered end-to-end setup guide (local + cluster + CI)
└── README.md                 # Project overview, DEPI metadata, team
```

## GitOps deployment (how code reaches the cluster)

1. **Terraform** provisions 3 QEMU/KVM VMs on a NAT network: `k3s-master` (10.17.3.10), `k3s-agent-1` (.11), `k3s-agent-2` (.12).
2. **Ansible** (`playbooks/site.yml`) preps the nodes, installs k3s (Traefik disabled), joins the agents, installs ArgoCD via Helm (NodePort 30080), and registers the root Application pointing at `k8s/apps` on `main`.
3. **ArgoCD App-of-Apps**: the root app syncs `k8s/apps/`, whose child Applications deploy everything with auto-sync + prune + self-heal:
   - `inventory-prod` → `k8s/overlays/prod` on **main**; `inventory-dev` → `k8s/overlays/dev` on **dev**
   - `ingress-nginx`, `cert-manager`, `monitoring` (kube-prometheus-stack) → upstream Helm charts
   - `cert-manager-extras`, `duckdns-webhook`, `monitoring-extras` → repo paths on **main**
4. **CI → CD handoff**: pushing to `main`/`dev` builds and pushes `ghcr.io/toyonix/gitops-terraform-kubernates/{backend,frontend}:{prod,dev}`; ArgoCD (polling ~3 min) redeploys the matching namespace.
5. **TLS**: cert-manager + Let's Encrypt via DNS-01 (DuckDNS webhook). The DuckDNS token secret is bootstrapped manually — never committed. Public-ish URLs (LAN-scoped): `prod-`, `dev-`, `monitoring-devops-depi.duckdns.org` → 10.17.3.10.

> Anything under `k8s/apps` or the shared infra paths only takes effect once it lands on **main** — the `dev` branch only drives `k8s/overlays/dev`.

## Application

**Inventory Manager** — track products with name, description, category, quantity, and price.

- Status is auto-computed: quantity ≥ 10 → IN_STOCK, 1–9 → LOW_STOCK, 0 → OUT_OF_STOCK
- Dashboard shows live stats and flags items needing restocking
- Products page has search, category filter, and status filter
- Access is protected by JWT authentication — login required to use the app
- Admin management: admins can create/delete other admin accounts and change passwords

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Angular 17, Angular Material, TypeScript |
| Backend | Spring Boot 3.2, Spring Security, JWT (jjwt 0.12), Spring Data JPA |
| Database | PostgreSQL 15 (H2 for tests only) |
| Container | Docker (multi-stage builds), Nginx (frontend), GHCR registry |
| Orchestration | Kubernetes (k3s, on-premises), Kustomize |
| GitOps | ArgoCD (App-of-Apps) |
| Infrastructure | Terraform (libvirt provider), Ansible |
| Ingress / TLS | NGINX Ingress Controller, cert-manager, Let's Encrypt (DNS-01 via DuckDNS webhook) |
| Monitoring | Prometheus + Grafana (kube-prometheus-stack), Micrometer `/actuator/prometheus` |

## Running locally

```bash
docker compose up --build
```

- Frontend: <http://localhost:80>
- Backend API: <http://localhost:8080>
- Swagger UI: <http://localhost:8080/swagger-ui.html>
- Prometheus: <http://localhost:9090>
- Grafana: <http://localhost:3000>
- Postgres: localhost:5432 / db: inventory / user: postgres / pass: postgres

Default login: **admin / admin**

## Backend API

Authentication: `POST /api/auth/login` returns a JWT. All other API endpoints require `Authorization: Bearer <token>`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Public | Returns JWT token |
| GET | `/api/products` | Required | List all (supports `?search=`, `?category=`, `?status=`) |
| GET | `/api/products/{id}` | Required | Get by ID |
| POST | `/api/products` | Required | Create product |
| PUT | `/api/products/{id}` | Required | Update product |
| DELETE | `/api/products/{id}` | Required | Delete product |
| GET | `/api/products/categories` | Required | List distinct categories |
| GET | `/api/admins` | Required | List admin users |
| POST | `/api/admins` | Required | Create admin user |
| DELETE | `/api/admins/{id}` | Required | Delete admin user |
| PUT | `/api/admins/{id}/password` | Required | Change admin password |
| GET | `/actuator/health` | Public | Liveness/readiness probe target |
| GET | `/actuator/prometheus` | Public | Micrometer metrics (scraped by Prometheus ServiceMonitors) |

## Environment variables (backend)

Database credentials are injected via environment variables — mapped to the `postgres-secret` Kubernetes Secret:

| Variable | Default | Description |
| --- | --- | --- |
| `DB_HOST` | `localhost` | Postgres host |
| `DB_PORT` | `5432` | Postgres port |
| `DB_NAME` | `inventory` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |

> **Known gap:** the JWT signing secret (`jwt.secret`) is currently hardcoded in `application.properties` and is *not* overridden by any Kubernetes Secret. Acceptable for a demo, but a real deployment should make it env-driven and inject it like the DB credentials.

## DevSecOps pipeline

### Implemented workflows

- **backend-ci.yml** — Gitleaks secrets scan → Maven build + JUnit + JaCoCo → SonarCloud SAST → OWASP Dependency-Check → Trivy image scan → push `:prod`/`:dev` to GHCR on main/dev
- **frontend-ci.yml** — ESLint → npm audit → Karma unit tests + coverage → SonarCloud SAST → Trivy image scan → push `:prod`/`:dev` to GHCR on main/dev
- **dast.yml** — Spins up full stack via docker compose → Selenium E2E smoke tests → OWASP ZAP full scan. Triggered manually or weekly (Monday 2am)

## GitHub Actions secrets

All secrets are added at: **repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret | Required | Description |
| --- | --- | --- |
| `SONAR_TOKEN` | Yes | SonarCloud personal access token |
| `SONAR_HOST_URL` | Yes | Always `https://sonarcloud.io` |
| `SONAR_ORGANIZATION` | Yes | SonarCloud org key (found in the org URL: `sonarcloud.io/organizations/<key>`) |
| `NVD_API_KEY` | Recommended | Speeds up OWASP Dependency-Check from 20 min to 2 min |
| `GITLEAKS_LICENSE` | No | Only needed for private repos — public repos work without it |

### Getting SONAR_TOKEN

1. Go to <https://sonarcloud.io> and sign in with GitHub
2. Import the repo via "+" → "Analyze new project"
3. Disable **Automatic Analysis**: Administration → Analysis Method → toggle off (required or CI scan fails)
4. Go to **My Account → Security → Generate Token** — type: Global Analysis Token
5. The `sonar.projectKey` in `backend/pom.xml` and `frontend/sonar-project.properties` must exactly match the key SonarCloud auto-generates (`{org}_{repo}`, e.g. `ToYoNiX_gitops-terraform-kubernates`)

### Getting NVD_API_KEY

1. Go to <https://nvd.nist.gov/developers/request-an-api-key>
2. Fill in your email, organization name, and organization type
3. You will receive an email with a UUID and a verification link
4. Click the link, enter your email and the UUID
5. Your API key is shown — copy it and add it as `NVD_API_KEY` in GitHub secrets

---

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
| `infra` | Terraform, Kubernetes, Ansible, or Docker changes |
| `ci` | GitHub Actions workflow changes |
| `refactor` | Code restructure with no behaviour change |
| `test` | Adding or updating tests |
| `docs` | Documentation only (MEMORY.md, NOTES.md, README, comments) |
| `chore` | Dependency bumps, config tweaks, tooling |
| `security` | Security patches, secret rotation, policy changes |

### Scopes

| Scope | Maps to |
| --- | --- |
| `backend` | `backend/` |
| `frontend` | `frontend/` |
| `k8s` | `k8s/` (base manifests, overlays, ArgoCD apps) |
| `cert-manager` | `k8s/cert-manager/`, `k8s/duckdns-webhook/`, TLS issues |
| `monitoring` | `k8s/monitoring-extras/`, monitoring Helm values, `monitoring/` |
| `terraform` | `terraform/` |
| `ansible` | `ansible/` |
| `ci` | `.github/workflows/` |
| `notes` | `NOTES.md` |
| `root` | Repo-level files (MEMORY.md, docker-compose.yml, .gitignore) |

### Rules

- Summary line: **50 chars max**, lowercase, no period at the end
- Use **imperative mood**: "add endpoint" not "added endpoint"
- Body: wrap at 72 chars, explain the **why** (not the what)
- Never commit secrets, credentials, or generated build artifacts

### Examples

```text
feat(backend): add jwt authentication

Protects all product endpoints behind Bearer token auth.
Admin user seeded with BCrypt on startup.
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
ci: add sonarcloud sast step to backend workflow

Runs after tests so JaCoCo coverage is available for the scan.
Fails the build if quality gate is not passed.
```

---

## Key design decisions

- **Monorepo**: all code, infra, and pipelines in one place for simplicity of demonstration
- **On-prem over cloud**: QEMU/KVM VMs provisioned by Terraform (libvirt provider) + Ansible instead of AWS EKS — avoids cloud costs, demonstrates on-prem DevSecOps
- **Cloud images + cloud-init**: Ubuntu cloud qcow2 images with cloud-init eliminate manual OS installation; VM is SSH-ready in ~60s after `terraform apply`
- **k3s over full Kubernetes**: single-binary lightweight Kubernetes appropriate for on-prem; installed with `--disable=traefik` because ingress-nginx is deployed via ArgoCD instead
- **ArgoCD App-of-Apps over push-based deploys**: the cluster pulls its desired state from git; CI only builds and pushes images, never touches the cluster
- **DuckDNS + cert-manager over Cloudflare Tunnel**: free subdomains pointing at the LAN ingress IP, real Let's Encrypt certs via DNS-01 (works without any public exposure). Cloudflare Tunnel remains documented in the README as the alternative for true public access
- **JWT over session auth**: stateless, suitable for a Kubernetes environment where multiple pod replicas share no session state
- **PostgreSQL over H2**: enterprise-standard SQL database; H2 is used only in tests so CI needs no external DB
- **Angular Material**: professional UI out of the box, minimal custom CSS required
- **Env-var-driven DB config**: database credentials come from Kubernetes Secrets; the JWT secret is a known exception (see Environment variables)
- **Status auto-computation**: the service layer derives stock status from quantity — no manual status field exposed to the frontend form
- **nginx:alpine-slim over nginx:alpine**: frontend final stage uses `nginx:alpine-slim` (21.8MB vs 93.9MB) — strips bash, apk, and unused modules while keeping static serving, `try_files`, and `proxy_pass`
- **jlink custom JRE for backend**: 3-stage build uses `jdeps` + `jlink` to assemble a minimal JRE with only the modules Spring Boot actually imports (204MB vs 355MB)
