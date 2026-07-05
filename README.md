# Automated DevOps Deployment Pipeline Using GitHub Actions, Terraform, Docker, Kubernetes, and Prometheus

> **Digital Egypt Pioneers Initiative (DEPI)**

| | |
| --- | --- |
| **Instructor** | Eng. Mohamed Atef |
| **Group** | GIZ4_SWD1_S1 |
| **Repo** | [github.com/Mohammed-Eissa/gitops-terraform-kubernates](https://github.com/Mohammed-Eissa/gitops-terraform-kubernates) |

---

## Team

| Name | ID | Email |
| --- | --- | --- |
| Assem Mohamed Saad *(Leader)* | 21127219 | <toyonix.assemmohamed.2005@gmail.com> |
| Abdulrahman Aymen Mohamed | 21122155 | <abdulrahmanaymen90@gmail.com> |
| Khaled Mohamed Sayed | 21131090 | <khaledkomy260@gmail.com> |
| Mohamed Mahmoud Sayed | 21039179 | <mohamedeissa615@gmail.com> |
| Adam Kamal Metwaly | 21125121 | <adaam.kammal@gmail.com> |
| Adham Alaa Abdulraheem | 21010130 | <Adhamzahranil123@gmail.com> |
| Ahmed Mohamed Abdelaziz Matter | 21008261 | <amatter705@gmail.com> |

---

## Project Overview

This project delivers a **fully automated DevOps pipeline** for an Inventory Manager web application. The team owns the entire engineering layer beneath the application — infrastructure provisioning, containerization, CI/CD, orchestration, security scanning, and monitoring — demonstrating end-to-end modern DevOps practices.

The application is a full-stack Inventory Manager built in-house:

- **Frontend** — Angular 17 + Angular Material served via Nginx
- **Backend** — Spring Boot 3 REST API (Java 17)
- **Database** — PostgreSQL 16

Everything lives in this monorepo: application source code, Terraform modules, Kubernetes manifests, and GitHub Actions workflows.

---

## System Architecture

```text
Developer Push
      │
      ▼
GitHub Actions CI/CD
  ├── SAST (SonarQube)
  ├── Secrets Scan (Gitleaks)
  ├── Dependency Audit (OWASP, npm audit)
  ├── Docker Build & Push (Trivy image scan)
  └── Deploy to Kubernetes
            │
            ▼
     AWS (Terraform-provisioned)
     ┌─────────────────────────────────┐
     │  Kubernetes Cluster (EKS)       │
     │  ┌──────────┐  ┌─────────────┐ │
     │  │ Frontend │  │   Backend   │ │
     │  │ (Nginx)  │  │(Spring Boot)│ │
     │  └──────────┘  └──────┬──────┘ │
     │                       │        │
     │               ┌───────▼──────┐ │
     │               │  PostgreSQL  │ │
     │               └──────────────┘ │
     │                                │
     │  Prometheus + Grafana          │
     └─────────────────────────────────┘
            │
            ▼
     DAST (Selenium + OWASP ZAP)
```

---

## Pipeline Stages

| Stage | Tool | Trigger |
| --- | --- | --- |
| Lint | ESLint, Checkstyle | Every push |
| Unit Tests | JUnit, Karma | Every push |
| SAST | SonarQube | Every push |
| Secrets Detection | Gitleaks | Every push |
| Dependency Audit | OWASP Dependency-Check, npm audit | Every push |
| Container Build & Scan | Docker, Trivy | Every push |
| Infrastructure Provision | Terraform | Merge to main |
| Deploy | Kubernetes (EKS) | Merge to main |
| DAST | Selenium, OWASP ZAP | Post-deploy |
| Monitoring | Prometheus, Grafana | Always-on |

---

## Repository Structure

```text
.
├── backend/              # Spring Boot REST API
│   ├── src/
│   ├── pom.xml
│   └── Dockerfile
├── frontend/             # Angular 17 SPA
│   ├── src/
│   ├── angular.json
│   ├── nginx.conf
│   └── Dockerfile
├── terraform/            # AWS infrastructure (EKS, VPC, RDS)
├── kubernetes/           # K8s manifests (Deployments, Services, Secrets)
├── .github/workflows/    # CI/CD pipeline definitions
├── docker-compose.yml    # Local development stack
└── MEMORY.md             # Project context for contributors and AI agents
```

---

## Running Locally

Prerequisites: Docker and Docker Compose installed.

```bash
git clone https://github.com/Mohammed-Eissa/gitops-terraform-kubernates.git
cd gitops-terraform-kubernates
docker compose up --build
```

| Service | URL |
| --- | --- |
| Frontend | <http://localhost> |
| Backend API | <http://localhost:8080> |
| Swagger UI | <http://localhost:8080/swagger-ui.html> |

---

## Technology Stack

| Category | Technology |
| --- | --- |
| Frontend | Angular 17, Angular Material, TypeScript |
| Backend | Spring Boot 3.2, Spring Data JPA, Java 17 |
| Database | PostgreSQL 16 |
| Containerization | Docker |
| Orchestration | Kubernetes (AWS EKS) |
| Infrastructure | Terraform |
| CI/CD | GitHub Actions |
| SAST | SonarQube |
| DAST | Selenium, OWASP ZAP |
| Monitoring | Prometheus, Grafana |
| Security | Trivy, Gitleaks, OWASP Dependency-Check |
