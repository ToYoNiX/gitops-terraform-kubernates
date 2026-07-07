# Project Notes & Lessons Learned

Running log of technical decisions, discoveries, and fixes made during development.

---

## Docker Image Optimisation

| Image | Before | After | Saving |
| --- | --- | --- | --- |
| Frontend (disk) | 93.9MB | 21.8MB | 77% |
| Frontend (compressed) | 26.2MB | 5.99MB | 77% |
| Backend (disk) | 355MB | 204MB | 43% |
| Backend (compressed) | 115MB | 86.3MB | 25% |

### Frontend: 93.9MB → 21.8MB

**What changed:** Switched the final stage base image in [frontend/Dockerfile](frontend/Dockerfile) from `nginx:alpine` to `nginx:alpine-slim`.

```dockerfile
# Before
FROM nginx:alpine

# After
FROM nginx:alpine-slim
```

**Why it worked:** `nginx:alpine` bundles bash, apk, and extra modules we never use. `nginx:alpine-slim` strips all of that and keeps only the core HTTP engine. Our `nginx.conf` only uses three features — static file serving, `try_files` (Angular SPA routing), and `proxy_pass` (API proxying to backend) — all of which are present in both images.

**Lesson:** Always question the default base image. `nginx:alpine` is the go-to in tutorials but `nginx:alpine-slim` is the right choice when you're not using extra modules.

---

## Multi-Stage Builds

Both Dockerfiles use multi-stage builds to keep the final image lean.

**Frontend** (2 stages) — Stage 1: Node.js compiles Angular → Stage 2: `nginx:alpine-slim` serves the compiled `/dist`. Node.js and `node_modules` (~500MB) are discarded entirely.

**Backend** (3 stages) — Stage 1: Maven + JDK builds the fat JAR → Stage 2: `eclipse-temurin:17-jdk-alpine` runs `jdeps` + `jlink` to build a custom JRE → Stage 3: plain `alpine:3.19` runs the custom JRE + JAR. Maven, the full JDK, and the `.m2` cache are all discarded.

---

## Angular Font Inlining Fails in Docker

**Problem:** `docker compose up --build` failed with:

```text
An unhandled exception occurred: Inlining of fonts failed.
An error has occurred while retrieving https://fonts.googleapis.com/...
```

Angular's production build tries to download Google Fonts and inline them into `index.html`. Docker build containers have no outbound internet access, so it fails.

**Fix:** Disabled font inlining in [frontend/angular.json](frontend/angular.json) under the production configuration:

```json
"optimization": {
  "fonts": {
    "inline": false
  }
}
```

The fonts still load at runtime from Google Fonts — we just told Angular not to fetch them at build time.

---

## npm ci Requires a Lockfile

**Problem:** `npm ci` in the frontend Dockerfile failed because `package-lock.json` did not exist in the repo — it was never generated since we wrote `package.json` by hand.

**Fix:** Run `npm install` locally once to generate `package-lock.json`, then commit it. `npm ci` is the correct command for Docker/CI (faster, deterministic, fails if lockfile is out of sync) but it strictly requires the lockfile to exist.

```bash
cd frontend
rm -rf node_modules   # if node_modules is corrupted
npm cache clean --force
npm install           # generates package-lock.json
```

**Lesson:** Never run `npm install --silent` in debugging situations — it hides all output including errors.

---

## Backend Image Size: 355MB → 204MB (43% reduction)

**What changed:** Added a `jlink` stage to [backend/Dockerfile](backend/Dockerfile) that builds a custom JRE containing only the Java modules Spring Boot actually uses, then switched the final base from `eclipse-temurin:17-jre-alpine` to plain `alpine:3.19`.

The build is now three stages:

```dockerfile
# Stage 1 — fat JAR
FROM maven:3.9-eclipse-temurin-17 AS build
...

# Stage 2 — custom JRE via jlink
FROM eclipse-temurin:17-jdk-alpine AS jlink
RUN jar xf app.jar && \
    jdeps --ignore-missing-deps --print-module-deps ... app.jar > modules.txt && \
    jlink --no-header-files --no-man-pages --compress=2 --strip-debug \
          --add-modules "$(cat modules.txt)" --output /custom-jre

# Stage 3 — final: alpine (5MB) + custom JRE + JAR only
FROM alpine:3.19
COPY --from=jlink /custom-jre /opt/jre
COPY --from=build /app/target/*.jar app.jar
```

**Why it worked:** `jdeps` statically analyses the JAR's bytecode to list every Java module it imports. `jlink` then assembles a JRE with exactly those modules — no reflection APIs, no CORBA, no XML-RPC, none of the legacy cruft bundled in a standard JRE. `--compress=2` and `--strip-debug` shrink it further. The final base is `alpine:3.19` (~5MB) instead of `eclipse-temurin:17-jre-alpine` (~180MB).

**GraalVM native-image was tried and reverted.** Result: 244MB disk / 60.7MB compressed — larger on disk than jlink (204MB), 15+ minute build time, and Maven installation alone took 200s inside the GraalVM container. The compressed size is better (60.7MB vs 86.3MB) but not worth the tradeoff. Spring Boot's native binary bundles all AOT-generated reflection metadata and Hibernate proxies statically, making it fatter than expected. jlink remains the better option for this stack.

---

## SonarCloud Setup

SonarCloud is the free hosted SonarQube — no server to run, free for public repos.

**Getting the token:**

1. Go to <https://sonarcloud.io> and sign in with GitHub
2. Import your repo via "+" → "Analyze new project"
3. Note your **organization key** (shown on the org page, used as `SONAR_ORGANIZATION`)
4. Go to **My Account → Security → Generate Token** — copy it immediately, it is only shown once

**Adding secrets to GitHub Actions:**

Go to repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
| --- | --- |
| `SONAR_TOKEN` | personal token from step 4 |
| `SONAR_HOST_URL` | `https://sonarcloud.io` |
| `SONAR_ORGANIZATION` | org key from step 3 |

The SonarQube steps in both CI workflows are conditional (`if: env.SONAR_TOKEN != ''`) so they are silently skipped when secrets are not configured — the rest of the pipeline still runs.

**Project key must match SonarCloud exactly:**

When you import a repo into SonarCloud it auto-generates the project key as `{org}_{repo}` — e.g. `ToYoNiX_gitops-terraform-kubernates`. This key must be set identically in both config files or the scan fails with "not authorized or project not found":

- Backend: `sonar.projectKey` in `backend/pom.xml`
- Frontend: `sonar.projectKey` in `frontend/sonar-project.properties`

Find the correct key from the project URL on SonarCloud: `sonarcloud.io/project/overview?id=<this-is-the-key>`.

**Each component needs its own unique project key:**

SonarCloud uses `projectKey` as the unique identifier for a project — not the project name. If two analyses share the same key, the second one completely **overwrites** the first. In a monorepo with multiple components (backend + frontend), this means whichever CI job runs last silently destroys the other's analysis.

**Symptom:** "Inventory Backend" disappears from the dashboard and is replaced by "Inventory Frontend" after the frontend workflow runs (or vice versa).

**Fix:** Append a suffix to make each key unique:

```properties
# backend/pom.xml
sonar.projectKey=ToYoNiX_gitops-terraform-kubernates_backend

# frontend/sonar-project.properties
sonar.projectKey=ToYoNiX_gitops-terraform-kubernates_frontend
```

Each key maps to a separate project in SonarCloud. After changing the keys, manually delete the old shared project from the SonarCloud dashboard (Administration → Delete Project) so it doesn't sit there as a ghost.

**SonarCloud defaults the main branch to `master` — rename it to `main`:**

When SonarCloud auto-creates a new project from the first CI analysis, it sets `master` as the main branch. If your repo uses `main`, the dashboard shows "master branch has not been analyzed yet" even though analyses are coming in fine — they're just landing on `main` which SonarCloud treats as a feature branch.

To rename it:

1. Open the project in SonarCloud
2. In the top navigation click **Branches** (it is at the same level as Administration — Branches and Pull Requests are separate entries, not nested under Administration)
3. Next to `master` → three dots → **Rename** → type `main` → Save

Also pass `-Dsonar.branch.name` explicitly in CI so SonarCloud always knows which branch the analysis belongs to:

```yaml
# backend (mvn)
-Dsonar.branch.name=${{ github.ref_name }}

# frontend (sonarqube-scan-action args)
-Dsonar.branch.name=${{ github.ref_name }}
```

`github.ref_name` resolves to `main` or `dev` depending on the triggering branch, so both branches are tracked correctly under the same project.
