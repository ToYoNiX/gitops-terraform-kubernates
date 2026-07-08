# Project Notes & Lessons Learned

---

## Cluster Operations — Useful Commands

Every command below is a one-liner that runs from your **local machine** — just copy, paste, done. They all SSH into the master (`10.17.3.10`) under the hood.

```bash
# Interactive shell on the master (when you need to poke around)
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10
```

### ArgoCD — all app sync and health status

```bash
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl get applications -n argocd"
```

### Pods across all app namespaces

```bash
# Everything at once
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl get pods -A"

# Just the app + infra namespaces
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "for ns in prod dev monitoring cert-manager ingress-nginx argocd; do echo \"== \$ns ==\"; sudo k3s kubectl get pods -n \$ns; done"
```

### Nodes, ingresses, services

```bash
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl get nodes -o wide"
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl get ingress -A"
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl get svc -A"
```

### Logs / describe for a specific pod

```bash
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl logs -n prod <pod-name> --tail=100"
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl logs -n prod <pod-name> --previous"   # if pod crashed
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl describe pod -n prod <pod-name>"      # ImagePullBackOff etc.
```

### TLS — certificates and ACME challenges

```bash
# Certificate + challenge status in one shot
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl get certificate,challenge -A"

# Why is a challenge stuck?
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl describe challenge -n cert-manager | grep -E 'Domain:|State:|Reason:'"

# Nudge: delete stuck challenges — cert-manager recreates them immediately
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl delete challenge -n cert-manager --all"

# What cert is actually being served? (should say Let's Encrypt, not Fake Certificate)
echo | openssl s_client -connect 10.17.3.10:443 -servername prod-devops-depi.duckdns.org 2>/dev/null | openssl x509 -noout -issuer -enddate
```

### Prometheus — is the backend actually being scraped?

```bash
# Count inventory targets (expect 2: prod + dev). 0 means ServiceMonitor matches nothing.
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "PROM=\$(sudo k3s kubectl get svc -n monitoring monitoring-kube-prometheus-prometheus -o jsonpath='{.spec.clusterIP}'); curl -s http://\$PROM:9090/api/v1/targets | grep -o 'inventory-backend-[a-z]*' | sort | uniq -c"

# Confirm the Service carries the label the ServiceMonitors select on
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl get svc backend -n prod --show-labels"
```

### Grafana

```bash
# Restart Grafana (no persistence — fresh DB, reprovisions everything from files)
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl rollout restart deployment monitoring-grafana -n monitoring && sudo k3s kubectl rollout status deployment monitoring-grafana -n monitoring --timeout=180s"

# Check dashboard provisioning errors
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "POD=\$(sudo k3s kubectl get pod -n monitoring -l app.kubernetes.io/name=grafana -o jsonpath='{.items[0].metadata.name}'); sudo k3s kubectl logs -n monitoring \$POD -c grafana --tail=100 | grep -i 'provisioning\|failed to save'"
```

### Port-forward monitoring services (if ingress not available)

```bash
# Grafana — http://localhost:3000
ssh -i ~/.ssh/depi_k3s -L 3000:10.43.220.136:80 depi@10.17.3.10 -N &

# Prometheus — http://localhost:9090
ssh -i ~/.ssh/depi_k3s -L 9090:10.43.253.255:9090 depi@10.17.3.10 -N &

# Alertmanager — http://localhost:9093
ssh -i ~/.ssh/depi_k3s -L 9093:10.43.68.58:9093 depi@10.17.3.10 -N &
```

### ArgoCD UI + password

```bash
# UI at http://10.17.3.10:30080 (admin / password below)
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d; echo"
```

### Force ArgoCD to refresh + resync an app immediately

`kubectl` has no `app sync` subcommand (that's the `argocd` CLI) — trigger a hard refresh via annotation instead; auto-sync then applies any diff:

```bash
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10 "sudo k3s kubectl -n argocd annotate application inventory-prod argocd.argoproj.io/refresh=hard --overwrite"
```

---

## Cluster Bootstrap — DuckDNS Setup

Register two subdomains on [duckdns.org](https://www.duckdns.org) and set both to the ingress controller's external IP (`10.17.3.10`):

| Subdomain | IP |
| --- | --- |
| `prod-devops-depi` | `10.17.3.10` |
| `dev-devops-depi` | `10.17.3.10` |

The ingress-nginx controller gets `10.17.3.10` as its external IP via k3s's built-in ServiceLB. Both domains point to the same IP — NGINX routes traffic to the correct namespace (`prod` or `dev`) based on the `Host` header.

Verify with:

```bash
nslookup prod-devops-depi.duckdns.org
nslookup dev-devops-depi.duckdns.org
```

Both should return `10.17.3.10`. This works for any machine on the same local network. No port forwarding or public IP needed for local access.

---

## Cluster URLs

| Service | URL | Credentials |
| --- | --- | --- |
| Production app | <http://prod-devops-depi.duckdns.org> | admin / admin |
| Dev app | <http://dev-devops-depi.duckdns.org> | admin / admin |
| Grafana | <http://monitoring-devops-depi.duckdns.org> | admin / (secret below) |
| ArgoCD UI | <http://10.17.3.10:30080> | admin / (retrieve below) |

Get ArgoCD initial password:

```bash
sudo k3s kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d
```

---

## Cluster Bootstrap — DuckDNS Token Secret

The DuckDNS token used by cert-manager for the DNS-01 challenge must **never be committed to git**. After running `ansible-playbook playbooks/site.yml` and before cert-manager tries to issue the certificate, create the secret manually on the cluster:

```bash
# From your local machine (kubeconfig already at ~/.kube/config after Ansible run)
kubectl create secret generic duckdns-token \
  --from-literal=token=<your-duckdns-token> \
  --namespace cert-manager

# Or from the master node directly
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10
sudo k3s kubectl create secret generic duckdns-token \
  --from-literal=token=<your-duckdns-token> \
  --namespace cert-manager
```

Your DuckDNS token is shown at the top of the page after logging in at [duckdns.org](https://www.duckdns.org). Once the secret exists, cert-manager picks it up automatically and completes the DNS-01 challenge to issue the TLS certificate.

---

## TLS Certificates Stuck Pending — ISP Drops DNS TXT Queries

**Symptom:** all ACME challenges sit in `pending` for hours with:

```text
Waiting for DNS-01 challenge propagation: dial tcp <ip>:53: i/o timeout
```

and later (after pointing cert-manager at cluster DNS):

```text
Waiting for DNS-01 challenge propagation: NS 10.43.0.10:53 returned SERVFAIL for _acme-challenge...
```

**Root cause:** the ISP transparently filters DNS by **query type** — outbound TXT queries on port 53 are silently dropped to *any* resolver (8.8.8.8, 1.1.1.1, 9.9.9.9, and the DuckDNS authoritative servers), while A queries to the very same servers work fine. The DuckDNS webhook publishes the `_acme-challenge` TXT records correctly (verifiable via DNS-over-HTTPS, which tunnels over 443), but cert-manager's pre-flight **propagation self-check** queries the authoritative nameservers over plain port 53, times out forever, and never asks Let's Encrypt to validate.

Diagnose with:

```bash
# A query works, even direct to the DuckDNS authoritative NS
dig +short A prod-devops-depi.duckdns.org @3.97.58.28

# TXT query times out — to ANY resolver
dig +short TXT google.com @8.8.8.8

# But the challenge record IS published (DoH bypasses the filter)
curl -s -H 'accept: application/dns-json' \
  'https://cloudflare-dns.com/dns-query?name=_acme-challenge.prod-devops-depi.duckdns.org&type=TXT'
```

**Fix:** route the self-check through a DNS path the ISP can't mangle. DNS-over-TLS (port 853) is not filtered, and CoreDNS can forward over DoT natively:

1. `k8s/cert-manager/coredns-custom.yml` adds a `coredns-custom` ConfigMap (k3s CoreDNS imports `/etc/coredns/custom/*.server`) forwarding `duckdns.org` to `tls://1.1.1.1`.
2. `k8s/apps/cert-manager.yml` adds Helm `extraArgs` so cert-manager's self-check uses cluster DNS (`10.43.0.10`, the kube-dns ClusterIP) instead of dialing the authoritative servers directly:

   ```yaml
   extraArgs:
     - --dns01-recursive-nameservers-only
     - --dns01-recursive-nameservers=10.43.0.10:53
   ```

Flow after the fix: self-check → CoreDNS → DoT to 1.1.1.1 → sees the TXT record → cert-manager tells Let's Encrypt to validate → LE queries DuckDNS from its own network (unaffected by the local ISP) → certificate issues.

After syncing, delete the stuck challenges so cert-manager recreates them immediately instead of waiting for the retry backoff:

```bash
sudo k3s kubectl delete challenge -n cert-manager --all
```

Note: the `cert-manager.io/cluster-issuer` annotation on the prod/dev ingresses means ingress-shim creates its own per-namespace certificates (`devops-depi-tls` in `prod`, `dev`, and `monitoring`), so the ingresses don't depend on the wildcard certificate's secret in the `cert-manager` namespace.

---

## Grafana JVM Dashboard Empty — ServiceMonitor Matches Service *Labels*, Not the Pod Selector

**Symptom:** the JVM (Micrometer) dashboard loads in Grafana but every panel shows `N/A` / "No data", and the `application` dropdown is empty. The same dashboard works fine in the docker-compose stack.

**Root cause:** a ServiceMonitor's `spec.selector.matchLabels` matches against the **labels on the Service object** — not the Service's `spec.selector` (which targets pods). The backend Service in `k8s/base/backend/service.yml` had `app: inventory-backend` only as its pod selector and **no labels at all** in its own metadata, so both ServiceMonitors (`inventory-backend-prod`, `inventory-backend-dev`) matched zero Services and Prometheus discovered zero targets. No metrics → the dashboard's `application` template variable (`label_values(application)`) resolves to nothing → every panel is empty.

It worked in docker-compose because `monitoring/docker/prometheus.yml` scrapes `backend:8080` with a hardcoded static config — no label matching involved.

Diagnose with:

```bash
# Service has no app label (only the ArgoCD-injected one)
sudo k3s kubectl get svc backend -n prod --show-labels

# Prometheus has no inventory targets
curl -s http://<prometheus-ip>:9090/api/v1/targets | grep -c inventory   # → 0
```

**Fix:** add the label to the Service metadata in the base (one change covers both overlays):

```yaml
metadata:
  name: backend
  labels:
    app: inventory-backend
```

**Related nuisance — "unsaved changes" prompt on a provisioned dashboard:** if the provisioned JSON uses an old schema (the original #4701 export was `schemaVersion: 14`), Grafana migrates it in the browser on every load, which marks the dashboard dirty — leaving it triggers a save prompt that then fails with *"cannot be saved because it has been provisioned"*. Fix: open the dashboard, use **Save → Save JSON to file** to get the schema-current JSON (`schemaVersion: 39` on Grafana 10.4.1), and put that into the ConfigMap so no migration happens on load.

**Gotcha when changing a provisioned dashboard's `uid`:** Grafana 10.4 cannot switch a provisioned dashboard's uid in place. After we changed the uid to a stable `jvm-micrometer`, the sidecar wrote the new file fine, but Grafana's provisioner errored every 30s with `failed to save dashboard ... could not resolve dashboards:uid:jvm-micrometer: Dashboard not found` and kept serving the old dashboard. Since Grafana runs without persistence (sqlite lives in the container), the fix is simply restarting the pod — fresh DB, everything reprovisions cleanly from the files (see the Grafana restart one-liner in the commands section). Side effects: the old dashboard URL dies, and any UI-created state (manual dashboards, stars, changed admin password) is wiped.

Two related non-issues worth knowing:

- The ServiceMonitors carry `release: kube-prometheus-stack`, but the Helm release is actually named `monitoring`. This mismatch doesn't matter because the chart values set `serviceMonitorSelectorNilUsesHelmValues: false`, which makes Prometheus pick up **all** ServiceMonitors regardless of labels.
- The "requires Angular (deprecated)" badge on the dashboard is cosmetic on the chart's Grafana 10.4.1 — Angular panels still render there. Dashboard #4701 uses the legacy `graph`/`singlestat` panel types, which stop rendering in Grafana 11+. Longer term, replace it with a modern `timeseries`-based JVM dashboard, and pin the docker-compose `grafana/grafana:latest` image (a fresh pull would get Grafana 12, where the dashboard breaks locally too).

---

## GitHub Actions / GHCR Gotchas

**GHCR image tags must be fully lowercase** — `docker/build-push-action` will fail with `repository name must be lowercase` if `github.repository_owner` contains uppercase letters (e.g. `ToYoNiX`). GitHub Actions expressions do not support a `| lower` filter, so lowercase it in a shell step instead:

```yaml
- name: Set image name
  run: echo "OWNER=$(echo '${{ github.repository_owner }}' | tr '[:upper:]' '[:lower:]')" >> $GITHUB_ENV

- name: Build and push
  uses: docker/build-push-action@v5
  with:
    tags: ghcr.io/${{ env.OWNER }}/your-repo/image:latest
```

**Gitleaks scans git history, not just the latest commit** — if a secret is accidentally committed and then removed in a follow-up commit, Gitleaks will keep flagging the original commit fingerprint on every subsequent push. Adding a `.gitleaks.toml` allowlist is the wrong fix because the secret is still in history. The correct fix is to rewrite history:

```bash
# Soft reset to before the bad commit (keeps all file changes staged)
git reset --soft <commit-before-the-bad-one>

# Re-commit with the correct content (secret already removed in working tree)
git add -A
git commit -m "your clean commit message"

# Rewrite the remote branch
git push --force-with-lease
```

`--force-with-lease` is safer than `--force` — it refuses to push if someone else pushed in the meantime.

---

## Terraform — Full Deployment Walkthrough

### 1. Install prerequisites (once)

```bash
sudo apt install -y qemu-kvm libvirt-daemon-system virtinst terraform genisoimage xsltproc
sudo usermod -aG libvirt $USER
newgrp libvirt
```

`genisoimage` provides `mkisofs` which the libvirt Terraform provider needs to build the cloud-init ISOs. Without it, `terraform apply` will fail after downloading the base image with `exec: "mkisofs": executable file not found in $PATH`.

**Use MAC address matching in cloud-init network-config, not interface names** — Ubuntu 22.04 cloud images name the NIC unpredictably (`ens3`, `enp1s0`, etc.) depending on PCI slot assignment. Hardcoding the interface name in `network-config.yaml.tpl` means the static IP silently never gets applied and the VM boots with no IP. The fix is to set fixed MAC addresses per VM in Terraform and match by MAC in cloud-init:

```yaml
version: 2
ethernets:
  id0:
    match:
      macaddress: ${mac}
    dhcp4: false
    addresses:
      - ${ip}/24
```

Fixed MACs are defined in `variables.tf` locals and passed to both the `network_interface` block and the cloud-init template.

**Also disable AppArmor confinement for QEMU before applying** — on Ubuntu, QEMU runs as `libvirt-qemu` and AppArmor blocks it from reading image files downloaded by your user. Without this fix, VMs will be defined but fail to start with `Permission denied` on the disk image:

```bash
sudo sed -i 's/#security_driver = "selinux"/security_driver = "none"/' /etc/libvirt/qemu.conf
sudo systemctl restart libvirtd
```

### 2. Generate SSH keypair (once)

```bash
ssh-keygen -t ed25519 -C "depi-k3s" -f ~/.ssh/depi_k3s -N ""
```

- `-t ed25519` — modern, fast, preferred over RSA
- `-f ~/.ssh/depi_k3s` — private key at `~/.ssh/depi_k3s`, public key at `~/.ssh/depi_k3s.pub`
- `-N ""` — no passphrase (Ansible needs passwordless SSH)

**Never commit the private key.** The `.pub` file is safe to reference.

### 3. Run Terraform in order

```bash
cd terraform

# 1. Download the libvirt provider (once per machine)
terraform init

# 2. Check config for syntax errors before touching anything
terraform validate

# 3. Dry run — shows exactly what will be created, nothing is provisioned
terraform plan -var="ssh_public_key_path=~/.ssh/depi_k3s.pub"

# 4. Provision the VMs
terraform apply -var="ssh_public_key_path=~/.ssh/depi_k3s.pub"
```

This will:

1. Download the Ubuntu 22.04 cloud image (~600MB, once)
2. Create 3 thin-clone disks (k3s-master, k3s-agent-1, k3s-agent-2)
3. Generate a cloud-init ISO per VM (injects SSH key, sets static IP)
4. Boot the VMs — cloud-init runs on first boot (~60–90s)

### 6. SSH into the VMs

```bash
ssh -i ~/.ssh/depi_k3s depi@10.17.3.10   # master
ssh -i ~/.ssh/depi_k3s depi@10.17.3.11   # agent-1
ssh -i ~/.ssh/depi_k3s depi@10.17.3.12   # agent-2
```

Or add this to `~/.ssh/config` to avoid typing the key every time:

```sshconfig
Host 10.17.3.*
    User depi
    IdentityFile ~/.ssh/depi_k3s
    StrictHostKeyChecking no
```

Then just: `ssh 10.17.3.10`

### 7. Tear down

```bash
terraform destroy -var="ssh_public_key_path=~/.ssh/depi_k3s.pub"
```

### Notes

- Ansible uses the same private key — configured in `ansible/ansible.cfg`
- If cloud-init hasn't finished yet SSH will refuse connections — wait 90s after `terraform apply` completes before SSHing in
- VM console available via `virsh console k3s-master` if SSH is unreachable

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

**One token works for all projects in the same repo:**

When SonarCloud onboards each new project it prompts you to generate a token. You do not need a separate token per project — a single token scoped to the organization has access to all projects within it. Reuse the same token for both `_backend` and `_frontend` projects; the `SONAR_TOKEN` secret in GitHub Actions only needs to be set once and both workflows will use it.

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

---

## Grafana Dashboard Import — DS_PROMETHEUS Variable

The JVM Micrometer dashboard (Grafana ID 4701) references datasources via a `${DS_PROMETHEUS}` placeholder. During import Grafana substitutes it with the selected datasource UID, but if the dashboard JSON does not include `DS_PROMETHEUS` as a template variable, the panels show "datasource not found" after import.

**Fix already applied:** `monitoring/dashboards/jvm-micrometer.json` has `DS_PROMETHEUS` pre-added as a datasource variable defaulting to `prometheus`. Delete the dashboard in Grafana and re-import the file if you hit this.

**Frontend has no JVM metrics** — the frontend is nginx; it does not appear in the JVM dashboard. A separate nginx-prometheus-exporter would be needed to monitor it.

---

Also pass `-Dsonar.branch.name` explicitly in CI so SonarCloud always knows which branch the analysis belongs to:

```yaml
# backend (mvn)
-Dsonar.branch.name=${{ github.ref_name }}

# frontend (sonarqube-scan-action args)
-Dsonar.branch.name=${{ github.ref_name }}
```

`github.ref_name` resolves to `main` or `dev` depending on the triggering branch, so both branches are tracked correctly under the same project.
