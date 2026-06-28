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

```
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
