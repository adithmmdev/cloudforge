# CloudForge — Autonomous Self-Healing Cloud Deployment Platform

**Capstone / 4th-year project. This document is the single source of truth for building it.**
It is written to be handed directly to an AI coding agent (Claude Code or similar) as its task
brief. Where anything below is ambiguous, the agent should stop and ask rather than invent
behavior — Section 1 explains why that matters and how to proceed when in doubt.

**Revision note (v4 — FINAL):** This version incorporates a full audit of v3 and fixes every
identified implementation blocker. Key changes from v3: EC2 provisioning race-condition safety
via database advisory lock, corrected cap logic (terminated instances no longer permanently brick
the system), explicit AMI/VPC/subnet configuration, a concrete user-data bootstrap script, dynamic
entry-point detection for all five stacks (no more hardcoded `server.js`/`app:app`/`app.main:app`),
Vite-vs-CRA build-output handling for React/MERN, `docker build` security hardening, compose
rollback specification, missing API endpoints added, full AWS automation from the dashboard
(Security Group + Key Pair creation — no more manual prerequisite), and a Deployment Documentation
Generator. Changes from v3 are marked **[v4]**. All v3 `[NEW]` tags are preserved.

---

## 0. The Pitch (for the resume, the demo, and the README's own justification)

CloudForge takes an uploaded or linked project (React, Express, Flask, FastAPI, or MERN) and
deploys it to AWS with zero manual DevOps — including provisioning its own compute and
**[v4] auto-configuring all required AWS resources (Security Group, Key Pair) from the dashboard**.
If the deployment fails, CloudForge diagnoses the failure using a locally-hosted LLM, escalates to
a cloud LLM only when needed (and only with a redacted, private description of the failure — never
raw source code), proposes a fix constrained to a pre-verified, closed set of safe actions (never
free-form generated code or shell commands), functionally tests that fix in a disposable shadow
container, and only then promotes it to the live deployment. Every step is visible and auditable
in a "Mission Control" dashboard. **[v4]** After every successful deployment, a structured
Deployment Report is auto-generated and downloadable.

Six things make this more than "an LLM retry loop," and are what's worth explaining in an
interview:

1. **Constrained Remediation Grammar** — the LLM never generates arbitrary code or commands. It
   selects and parameterizes from a closed, individually-tested set of deployment-configuration
   actions.
2. **Privacy-Tiered LLM Routing** — a local model triages every failure first. Only a redacted,
   code-free "failure signature" is ever sent to a cloud API, and only when local confidence is
   too low. Every disclosure is logged verbatim in an auditable ledger. **[NEW]** The cloud tier
   itself is provider-agnostic (Claude / GLM / NVIDIA NIM), swappable via config.
3. **Shadow Verification Gate** — no proposed fix reaches the real deployment until it passes a
   functional smoke test in a disposable local container.
4. **[NEW] Bounded Autonomous Infrastructure Provisioning** — the platform provisions its own EC2
   compute on demand, but under a hard instance cap and tag-based reuse, so an autonomous loop
   can never silently multiply cloud spend. **[v4]** Provisioning now handles stopped instances
   (auto-restart), uses a database advisory lock to prevent race conditions, and reconciles local
   state with AWS on every call.
5. **[v4] Full AWS Automation from Dashboard** — Security Group creation, Key Pair generation,
   IAM validation, and AMI selection are all handled by an in-dashboard setup wizard, eliminating
   every manual AWS prerequisite except having an account.
6. **[v4] Deployment Documentation Generator** — every successful deployment produces a structured
   report (infrastructure, services, timeline, health results, remediation history) downloadable
   as Markdown from the dashboard.

---

## 1. Grounding Rules for the Agent (read before writing any code)

1. **Use only the pinned versions and model names in Section 3.** Do not substitute a library,
   model, or framework without flagging it first.
2. **Never let the LLM's output execute directly.** Every proposed action from Section 8 (the
   Remediation Grammar) must be validated against the schema in that section before anything is
   applied. An action outside the enum, or with a param that fails validation, is discarded.
3. **Do not invent AWS/boto3/paramiko/Docker SDK/Ollama/LLM-provider API signatures.** If you're
   not certain a method or endpoint exists as described, check the docs before writing the call.
   **[NEW]** This especially applies to GLM and NVIDIA NIM endpoint paths and model slugs in
   Section 9 — both catalogs change over time; confirm the current slug in the provider's own
   docs before shipping rather than trusting a name pinned months ago.
4. **Never fabricate command output, test results, AWS resource values, or "it works."** Every
   task in Section 17 has a Definition of Done with a real command to run.
5. **Never send raw source code, raw logs, or raw environment variables to the cloud LLM.** Only
   the redacted signature object defined in Section 9 may leave the local boundary — regardless
   of which cloud provider is configured.
6. **Never let EC2 provisioning exceed the configured cap.** See Section 8a. This is a hard rule,
   not a retry-until-it-works path — creation must fail loudly, not silently multiply instances.
7. **If a requirement is ambiguous, use the documented default in this spec.** If genuinely
   uncovered, pick the simplest option that satisfies the acceptance test and note the decision
   in the commit message.
8. **Everything in Section 2's "Out of scope" list is off-limits this semester.**
9. **[v4] CloudForge always generates Dockerfiles from its own templates (§12) — it never uses a
   user-supplied Dockerfile.** This is a security boundary. If the uploaded project contains a
   `Dockerfile`, it is ignored, not executed. All `docker build` commands must include
   `--network=none` and a 10-minute timeout to prevent exfiltration during the build phase.

---

## 2. Scope

### In scope

- Upload (ZIP) or link (GitHub URL) a project; detect framework via an **adapter registry**:
  React, Express, Flask, FastAPI (single-container), and **MERN [NEW]** (multi-container, via
  Docker Compose)
- Generate deployment config (Dockerfile, or Dockerfile + compose file for MERN) from templates;
  local build with streamed logs
- **[NEW] Automated EC2 provisioning:** on first deploy, reuse a tagged existing instance or
  create one (capped — see §8a); no manual instance launch required
- **[v4] Full AWS automation from the dashboard:** auto-create Security Group, Key Pair, validate
  IAM permissions, detect AMI — all from a setup wizard in the frontend (see §23). Eliminates
  manual AWS prerequisites beyond having an account with credentials.
- Deploy to that instance via SSH; dynamic port allocation
- Health-check fallback chain (`/health` → `/` → raw TCP) with rollback to last-good image
- **On deployment failure:** local-LLM diagnosis → optional redacted cloud-LLM escalation
  (provider-agnostic: Claude / GLM / NVIDIA NIM) → constrained-grammar fix proposal → shadow
  verification → promotion (auto or human-approved, per project autonomy setting)
- Live container logs and CPU/mem metrics (WebSocket-streamed, Postgres-persisted)
- Mission Control dashboard: Timeline, Agent Reasoning, Disclosure Ledger, Shadow Verification,
  Logs, Metrics tabs; per-project Autonomy dial; **[NEW]** Service List tab for compose
  deployments; **[v4]** Deployment Report tab, AWS Setup page
- **[v4] Deployment Documentation Generator:** auto-generates a structured report after every
  successful deployment, downloadable as Markdown (see §22)
- Single implicit admin user — no multi-tenant auth this semester

### Out of scope this semester

- Autoscaling / multiple *replicas* of the same app behind a load balancer (MERN's client+server+
  db is a fixed, small multi-service deployment, not autoscaling — those are different things)
- Multi-user accounts, login, roles, tenant isolation
- Editing the user's *application logic* — remediation only ever touches deployment
  configuration (Dockerfile/compose, start command, env vars, resource limits, exposed port,
  restarting a known service), **never** the uploaded project's source files
- Building the Next.js / Vue / Django / Go adapters — the registry is designed to make adding
  them a contained follow-up task, but only MERN + the original four ship this semester
- CI/CD webhook triggers, CloudWatch host metrics, backup/restore, HTTPS/Let's Encrypt
- S3 as a registry — direct SSH transfer (`docker save | ssh ... docker load`) is used instead
- Fine-tuning or training a custom classifier — regex classification + prompted LLM selection is
  sufficient and keeps the system explainable
- TypeScript Express projects — documented as a known limitation this semester (§12)

If asked to build any "out of scope" item mid-build, treat it as a scope-change request.

---

## 3. Tech Stack (pinned)

| Layer | Choice | Version / Notes |
|---|---|---|
| Backend language | Python | 3.12 |
| Backend framework | FastAPI | 0.115.0 (`fastapi[standard]` — see Dockerfile fix in §12) |
| ASGI server | Uvicorn | 0.30.0 |
| ORM | SQLAlchemy | 2.0.x |
| Migrations | Alembic | 1.13.x |
| DB driver | psycopg2-binary | 2.9.x |
| AWS SDK | boto3 | 1.34.x |
| SSH | paramiko | 3.4.x |
| Docker SDK | docker (Python) | 7.1.x |
| Templating | Jinja2 | 3.1.x |
| Local LLM runtime | Ollama | latest stable; model `qwen2.5-coder:7b-instruct` (>=8GB RAM/VRAM; `llama3.1:8b` is an acceptable substitute). **Do not replace this with a hosted API** — the local tier only means something if it's actually local. |
| Cloud LLM client | **[NEW] provider-agnostic** — Anthropic SDK for `anthropic`, OpenAI SDK (base-URL override) for `glm` and `nvidia_nim` | see §9 for the full comparison and config keys |
| Test runner | pytest | 8.x |
| Database | PostgreSQL | 16 (`postgres:16` image for local dev) |
| Frontend | React | 18.2.0 |
| Frontend build tool | Vite | 5.x |
| Styling | Tailwind CSS | 3.4.x |
| Charts | Recharts | 2.x |
| Logs console | Plain scrolling `<pre>` over WebSocket | — |
| Container base images | `node:18-slim`, `nginx:alpine`, `python:3.12-slim`, `mongo:7` **[NEW]** | see allowlist in §8 |

---

## 4. Day-0 Prerequisites (human-only, one-time — the agent should assume these exist)

**[v4] This list is now minimal — Security Group, Key Pair, and AMI selection are automated from
the dashboard (§23). EC2 instance provisioning was already automated in v3.**

1. AWS account with an IAM user that has the policy from §14. Access key and secret saved to
   `.env`. AWS's Free Tier changed in July 2025 to a credit-based model for new accounts —
   confirm which kind of account this is before assuming $0 cost.
2. Ollama installed locally, `ollama pull qwen2.5-coder:7b-instruct` run once and confirmed
   working.
3. At least one cloud LLM provider key obtained (§9): Anthropic, and/or Z.ai (GLM), and/or NVIDIA
   NIM. You don't need all three — pick one to start, the config is provider-agnostic.
4. Docker Desktop, Node 20+, Python 3.12 installed locally.
5. `.env` populated from `.env.example`:
   ```
   AWS_ACCESS_KEY_ID=
   AWS_SECRET_ACCESS_KEY=
   AWS_REGION=us-east-1

   # [v4] These are auto-populated by the AWS Setup wizard (§23).
   # Leave blank on first run — the dashboard will fill them.
   EC2_SECURITY_GROUP_ID=
   EC2_KEY_PAIR_NAME=
   EC2_SSH_KEY_PATH=
   EC2_AMI_ID=                        # [v4] Ubuntu 22.04 LTS; auto-detected per region by setup wizard
   EC2_SUBNET_ID=                     # [v4] Optional; blank = default VPC's first public subnet
   EC2_SSH_USER=ubuntu
   EC2_INSTANCE_TYPE=t3.small
   MAX_EC2_INSTANCES=1
   DATABASE_URL=postgresql://cloudforge:cloudforge@db:5432/cloudforge
   PORT_POOL_START=8001
   PORT_POOL_END=8099
   OLLAMA_HOST=http://localhost:11434
   OLLAMA_MODEL=qwen2.5-coder:7b-instruct
   LOCAL_CONFIDENCE_THRESHOLD=0.75

   # Cloud LLM — set CLOUD_LLM_PROVIDER to exactly one of: anthropic | glm | nvidia_nim
   CLOUD_LLM_PROVIDER=anthropic
   ANTHROPIC_API_KEY=
   CLOUD_LLM_MODEL_ANTHROPIC=claude-haiku-4-5-20251001       # verify slug at docs.anthropic.com
   GLM_API_KEY=
   GLM_BASE_URL=https://api.z.ai/api/paas/v4
   CLOUD_LLM_MODEL_GLM=glm-4.6                               # verify slug at z.ai docs
   NVIDIA_NIM_API_KEY=
   NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1
   CLOUD_LLM_MODEL_NVIDIA=nvidia/nemotron-nano-9b-v2          # verify slug at build.nvidia.com
   ```

---

## 5. Repo Structure

```
cloudforge/
├── docker-compose.yml                    # [v4] CloudForge platform compose — see §24
├── .env.example
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/                         # projects.py, deployments.py, remediation.py, ws.py,
│   │   │                                # aws_setup.py [v4]
│   │   ├── orchestrator/                # pipeline sequencing, autonomy-mode gating
│   │   ├── detector/
│   │   │   ├── registry.py              # [NEW] adapter registry — detect_fn, template(s), deployment_type
│   │   │   └── adapters/                # react.py, express.py, flask.py, fastapi.py, mern.py
│   │   ├── templates/
│   │   │   ├── dockerignore.j2          # [v4] shared .dockerignore template
│   │   │   ├── react/                   # Dockerfile.j2
│   │   │   ├── express/                 # Dockerfile.j2
│   │   │   ├── flask/                   # Dockerfile.j2
│   │   │   ├── fastapi/                 # Dockerfile.j2
│   │   │   └── mern/                    # [NEW] client/Dockerfile.j2, server/Dockerfile.j2,
│   │   │                                # nginx.conf.j2, compose.yml.j2
│   │   ├── build_service/
│   │   ├── deployer/
│   │   │   ├── ec2_provisioner.py       # [NEW] reuse-or-create with §8a cap + [v4] advisory lock
│   │   │   ├── port_allocator.py
│   │   │   └── deploy.py               # single-container AND compose deploy paths
│   │   ├── health/
│   │   ├── metrics/
│   │   ├── remediation/
│   │   │   ├── classifier.py
│   │   │   ├── grammar.py              # includes RESTART_SERVICE [NEW]
│   │   │   ├── local_llm.py
│   │   │   ├── llm_client_factory.py   # [NEW] anthropic | glm | nvidia_nim
│   │   │   ├── redactor.py
│   │   │   └── shadow.py
│   │   ├── aws_setup/                   # [v4] SG creation, key-pair gen, AMI lookup, IAM validation
│   │   │   └── setup_service.py
│   │   ├── doc_generator/               # [v4] deployment documentation generator
│   │   │   └── generator.py
│   │   ├── models/
│   │   └── db/
│   ├── alembic/
│   ├── tests/
│   │   ├── fixtures/                    # react-sample/ (Vite), react-cra-sample/ (CRA),
│   │   │                                # express-sample/, flask-sample/, fastapi-sample/,
│   │   │                                # mern-sample/ [NEW] (client/ + server/),
│   │   │                                # plus broken variants for each
│   │   ├── test_detector.py
│   │   ├── test_dockerfile_gen.py
│   │   ├── test_ec2_provisioner.py      # [NEW]
│   │   ├── test_port_allocation.py
│   │   ├── test_health_check.py
│   │   ├── test_classifier.py
│   │   ├── test_grammar_validation.py
│   │   ├── test_redactor.py
│   │   ├── test_llm_client_factory.py   # [NEW]
│   │   ├── test_shadow_verification.py
│   │   ├── test_aws_setup.py            # [v4]
│   │   └── test_doc_generator.py        # [v4]
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/                       # Upload, Dashboard, ProjectDetail, Settings,
│   │   │                                # AWSSetup [v4]
│   │   ├── components/                  # Timeline, LogConsole, MetricsChart, ReasoningTrace,
│   │   │                                # DisclosureLedger, ShadowVerificationPanel, AutonomyDial,
│   │   │                                # ServiceList [NEW], DeploymentReport [v4],
│   │   │                                # AWSSetupWizard [v4]
│   │   └── api/
│   ├── package.json
│   └── Dockerfile
├── keys/                                # [v4] auto-generated .pem files from AWS Setup wizard
└── scripts/
    └── e2e_demo.sh
```

---

## 6. System Architecture

```
User --> Frontend --> Backend/API --> Orchestrator --> BuildService --> (image[s])
                          |                                |
                          |  [v4] AWS Setup Wizard          |  docker build --network=none
                          |  (SG, KeyPair, AMI, IAM)        |  --timeout 600 [v4]
                          |                                |
                          +---> [NEW] EC2 Provisioner:
                          |      [v4] acquire advisory lock -->
                          |      reconcile DB with describe_instances -->
                          |      reuse running / restart stopped / create (capped, §8a) -->
                          |      release lock
                          |
                          +---> Deployer --> EC2 (SSH: docker load + docker run,
                          |         OR docker compose up for MERN)
                          |         |
                          |         +---> [failure] --> Remediation Loop:
                          |               1. Classifier (regex) --> error_class
                          |               2. Redactor --> redacted signature (no source/secrets)
                          |               3. Local LLM (Ollama) --> proposed action + confidence
                          |               4. IF confidence < threshold:
                          |                     Cloud LLM (provider from config) <-- signature ONLY
                          |                     (logged to Disclosure Ledger)
                          |               5. Grammar validator --> reject if outside closed action set
                          |               6. Shadow Verifier --> disposable local container(s) + smoke tests
                          |               7. IF pass: promote per Autonomy Mode
                          |                  IF fail: retry (max 3) --> else escalate to human
                          |
                          +---> Monitoring --> docker stats --> Postgres --> WebSocket --> Frontend
                          |
                          +---> [v4] Doc Generator --> deployment report --> Postgres + downloadable MD
```

**Components:** Frontend, Backend/API, Orchestrator, Build Service, **EC2 Provisioner [NEW]**,
Deployer, Monitoring, Database, **AWS Setup Service [v4]**, **Doc Generator [v4]**, and the
remediation modules: Classifier, Redactor, Local/Cloud LLM clients (behind a provider factory
**[NEW]**), Grammar Validator, Shadow Verifier.

---

## 7. Database Schema (PostgreSQL)

**[v4] Changes from v3:** `ON DELETE CASCADE` on all child FKs; `TIMESTAMPTZ` instead of
`TIMESTAMP`; `image_tag` moved to `containers` table (supports MERN's multiple images);
`users` table retained as placeholder (no auth built this semester); `aws_setup_state` table
added; `deployment_reports` table added; indexes on high-query columns.

```sql
-- Placeholder for future multi-user auth (§2 out-of-scope this semester).
-- A single implicit admin row is seeded by Alembic migration; no login flow is built.
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'developer'
);

CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  repo_url TEXT,
  framework TEXT,                 -- 'react'|'express'|'flask'|'fastapi'|'mern'  [NEW column]
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE autonomy_settings (
  project_id INT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'approve_each'  -- 'full_auto' | 'approve_each' | 'suggest_only'
);

-- [NEW] tracks EC2 instances the platform itself provisioned
CREATE TABLE instances (
  id SERIAL PRIMARY KEY,
  aws_instance_id TEXT UNIQUE NOT NULL,
  public_ip TEXT,
  status TEXT NOT NULL,           -- 'pending','running','stopped','terminated'
  tag TEXT NOT NULL DEFAULT 'cloudforge-managed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()        -- [v4] tracks last reconciliation
);
CREATE INDEX idx_instances_status ON instances(status);

-- [v4] Stores the result of the AWS Setup wizard (§23)
CREATE TABLE aws_setup_state (
  id SERIAL PRIMARY KEY,
  security_group_id TEXT,
  key_pair_name TEXT,
  ssh_key_path TEXT,                -- local filesystem path to the .pem file
  ami_id TEXT,
  subnet_id TEXT,
  iam_validated BOOLEAN NOT NULL DEFAULT FALSE,
  setup_status TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'in_progress'|'complete'|'failed'
  error_detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE deployments (
  id SERIAL PRIMARY KEY,
  project_id INT REFERENCES projects(id) ON DELETE CASCADE,
  instance_id INT REFERENCES instances(id) ON DELETE SET NULL,   -- [NEW]
  deployment_type TEXT NOT NULL DEFAULT 'single_container',  -- 'single_container' | 'compose' [NEW]
  status TEXT,  -- 'building','deployed','failed','rolled_back','healing'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX idx_deployments_project ON deployments(project_id);

CREATE TABLE stage_events (
  id SERIAL PRIMARY KEY,
  deployment_id INT REFERENCES deployments(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_stage_events_deployment ON stage_events(deployment_id);

CREATE TABLE containers (
  id SERIAL PRIMARY KEY,
  deployment_id INT REFERENCES deployments(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL DEFAULT 'app',  -- 'app' | 'client' | 'server' | 'mongo'  [NEW column]
  image_tag TEXT,                 -- [v4] moved here from deployments; each service has its own tag
  container_id TEXT,
  host_ip TEXT,
  host_port INT,                 -- NULL for internal-only services (server/mongo in MERN)
  status TEXT,
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ
);
CREATE INDEX idx_containers_deployment ON containers(deployment_id);

CREATE TABLE metrics (
  id SERIAL PRIMARY KEY,
  container_id INT REFERENCES containers(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),       -- [v4] TIMESTAMPTZ not TIMESTAMP
  cpu_percent REAL,
  mem_usage_mb REAL,
  net_in_bytes BIGINT,
  net_out_bytes BIGINT
);
CREATE INDEX idx_metrics_container_ts ON metrics(container_id, timestamp);

CREATE TABLE failures (
  id SERIAL PRIMARY KEY,
  deployment_id INT REFERENCES deployments(id) ON DELETE CASCADE,
  raw_error_excerpt TEXT,        -- LOCAL ONLY. Never read by redactor/cloud path.
  error_class TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE diagnoses (
  id SERIAL PRIMARY KEY,
  failure_id INT REFERENCES failures(id) ON DELETE CASCADE,
  model_tier TEXT NOT NULL,      -- 'local' | 'cloud'
  cloud_provider TEXT,           -- 'anthropic'|'glm'|'nvidia_nim'|NULL if local  [NEW column]
  confidence REAL NOT NULL,
  action_type TEXT,
  params JSONB,
  reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE disclosures (
  id SERIAL PRIMARY KEY,
  failure_id INT REFERENCES failures(id) ON DELETE CASCADE,
  content_sent TEXT NOT NULL,
  destination TEXT NOT NULL,     -- 'anthropic_api'|'glm_api'|'nvidia_nim_api'  [NEW — was Anthropic-only]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE remediation_actions (
  id SERIAL PRIMARY KEY,
  diagnosis_id INT REFERENCES diagnoses(id) ON DELETE CASCADE,
  deployment_id INT REFERENCES deployments(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  params JSONB NOT NULL,         -- includes "service" key for compose deployments [NEW convention]
  status TEXT NOT NULL DEFAULT 'proposed',  -- 'proposed'|'shadow_testing'|'awaiting_approval'|'promoted'|'rejected'|'discarded'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shadow_tests (
  id SERIAL PRIMARY KEY,
  remediation_action_id INT REFERENCES remediation_actions(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  output TEXT,
  ran_at TIMESTAMPTZ DEFAULT NOW()
);

-- [v4] Stores generated deployment documentation
CREATE TABLE deployment_reports (
  id SERIAL PRIMARY KEY,
  deployment_id INT UNIQUE REFERENCES deployments(id) ON DELETE CASCADE,
  report_markdown TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. The Constrained Remediation Grammar

**The LLM (local or cloud, whichever provider) never produces free-form code, shell commands, or
Dockerfile/compose text. It only ever returns one of the seven actions below.**

| `action_type` | Params | Safety envelope |
|---|---|---|
| `ADD_DEPENDENCY` | `{package, version, manifest, service}` | `service` defaults to `"app"`; for MERN must be `"client"` or `"server"`, mapping to that folder's manifest; `package` must match `^[a-zA-Z0-9_\-\.]+$` |
| `CHANGE_BASE_IMAGE` | `{image_tag, service}` | `image_tag` must be in the allowlist: `python:3.12-slim`, `python:3.11-slim`, `node:18-slim`, `node:18`, `nginx:alpine`, `mongo:7` |
| `EXPOSE_PORT` | `{port, service}` | `1 <= port <= 65535`; for compose deployments only `"client"` may bind a host port — reject attempts to expose `server` or `mongo` externally |
| `SET_START_COMMAND` | `{cmd, service}` | **[v4]** `cmd` must be a JSON array of strings (Dockerfile `CMD` exec form), e.g. `["uvicorn", "app.main:app", "--host", "0.0.0.0"]`. `cmd[0]` must be one of: `uvicorn`, `gunicorn`, `node`, `nginx`, `python` |
| `INCREASE_MEMORY_LIMIT` | `{mb, service}` | `128 <= mb <= 1024` |
| `SET_ENV_VAR` | `{key, value, service}` | Reject if `key` matches `(?i)(secret\|token\|password\|api[_-]?key)`. **[v4]** Also reject if `value` matches `://[^:]+:[^@]+@` (embedded credentials in URIs) or if `value` is longer than 500 characters (likely a key/cert blob). |
| `RESTART_SERVICE` **[NEW]** | `{service}` | `service` must be one of the deployment's own known `service_name` values (queried from `containers` for that `deployment_id`) — cannot target anything outside the current deployment |
| `NONE` | `{}` | Escalate (if local) or hand off to human (if cloud) |

`service` defaults to `"app"` for single-container deployments and is required for compose
deployments. Any response with an `action_type` outside this table, or params that fail
validation, is discarded — never retried with a "fixed-up" version.

### 8a. EC2 Provisioning Cap (safety rule for the new automation)

**[v4] Rewritten to fix race condition, cap logic, stopped-instance handling, and source-of-truth
ambiguity identified in the v3 audit.**

```
on deploy:
  1. ACQUIRE a PostgreSQL advisory lock (pg_advisory_xact_lock) keyed on a fixed constant
     to serialize all provisioning decisions — this prevents concurrent deploys from both
     creating instances simultaneously.

  2. RECONCILE: call describe_instances(filter: tag "cloudforge-managed"=true) and update
     the local `instances` table to match AWS reality. For each AWS instance:
       - if it exists in DB: update status, public_ip
       - if it does NOT exist in DB: insert it
     For each DB row not found in AWS (manually deleted): set status = 'terminated'
     The `instances` DB table is the AUTHORITATIVE source after reconciliation.

  3. REUSE: look in the DB for an instance with status = 'running'
     - if found: use it, skip to step 6

  4. RESTART: look in the DB for an instance with status = 'stopped'
     - if found: call ec2:StartInstances, wait until running, update DB, use it, skip to step 6

  5. CREATE: count instances in DB WHERE status IN ('pending','running','stopped')
     - if count < MAX_EC2_INSTANCES:
         create one via ec2:RunInstances using EC2_AMI_ID, EC2_INSTANCE_TYPE,
         EC2_SECURITY_GROUP_ID, EC2_KEY_PAIR_NAME, EC2_SUBNET_ID (if set, else
         omit to use default VPC), user-data script from §25, tag "cloudforge-managed"=true.
         Wait until running. Insert into DB. Use it.
     - else:
         FAIL the deployment with a clear "instance cap reached" error.
         Never create past the cap. Never silently retry.

  6. RELEASE the advisory lock (automatically on transaction commit).
```

**Key invariants:**
- Terminated instances do NOT count against the cap (only pending/running/stopped do).
- The advisory lock makes the check-and-create atomic — no race condition.
- The reconciliation step ensures the DB never drifts from AWS reality.
- If all instances are terminated and the cap is reached only by terminated ones, the count of
  active (pending/running/stopped) is 0, which is below the cap, so a new instance can be created.

This logic lives in `deployer/ec2_provisioner.py` and must be unit-testable against a mocked
boto3 client (`test_ec2_provisioner.py`) without needing real AWS credentials for the test run.
Tests must cover: reuse-when-running, restart-when-stopped, create-when-under-cap,
hard-fail-when-at-cap, reconciliation-updates-DB, and advisory-lock-serialization.

---

## 9. Privacy-Tiered LLM Routing (Pillar 2)

### Step 1 — Deterministic classification first

| Pattern (illustrative) | `error_class` | Typical `action_type` |
|---|---|---|
| `ModuleNotFoundError: No module named '(\w+)'` | `missing_python_dependency` | `ADD_DEPENDENCY` |
| `Cannot find module '(\S+)'` | `missing_node_dependency` | `ADD_DEPENDENCY` |
| `EADDRINUSE` | `port_conflict` | `EXPOSE_PORT` |
| `exec format error` / `no matching manifest for` | `wrong_base_image_arch` | `CHANGE_BASE_IMAGE` |
| container inspect shows `OOMKilled: true` | `out_of_memory` | `INCREASE_MEMORY_LIMIT` |
| container exits within 2s, no matching `CMD` found | `missing_or_wrong_start_command` | `SET_START_COMMAND` |
| `KeyError`/`undefined` referencing an env var name at startup | `missing_env_var` | `SET_ENV_VAR` (non-secret only) |
| `MongoNetworkError` / `ECONNREFUSED .*27017` **[NEW]** | `db_connection_failed` | `RESTART_SERVICE` (target: `mongo`) or `SET_ENV_VAR` (`MONGO_URI`) |
| **[v4]** `npm ERR! code ERR_SOCKET_TIMEOUT` / build fails during `npm install` | `build_network_error` | `NONE` (transient; retry build, not remediation) |
| none of the above match | `unclassified` | `NONE` -> escalate |

### Step 2 — Redaction (the privacy boundary — unchanged regardless of cloud provider)

```json
{
  "error_class": "missing_python_dependency",
  "framework": "fastapi",
  "deployment_type": "single_container",
  "service": "app",
  "extracted_token": "requests",
  "exit_code": 1,
  "attempt_number": 1
}
```
Checked against the secret-pattern filter before inclusion. **This object, and only this object,
is what any LLM — local or cloud, whichever provider — ever sees.**

### Step 3 — Local model attempt

Ollama, structured-JSON-only prompt listing the §8 grammar and a few-shot subset of the table
above. Parse with strict schema validation; parse failure = `NONE`/confidence 0.

### Step 4 — Escalation decision and provider comparison **[NEW — expanded]**

If `confidence >= LOCAL_CONFIDENCE_THRESHOLD` (default `0.75`), skip straight to Shadow
Verification. Otherwise escalate to **whichever cloud provider is configured** — the redactor and
prompt contract are identical across all three; only the client differs:

| Provider | `CLOUD_LLM_PROVIDER` value | Client | Notes |
|---|---|---|---|
| Anthropic | `anthropic` | Anthropic SDK | Recommended default — most consistent structured-JSON output for this task. `claude-haiku-4-5-20251001` is cheap and fast enough. |
| Z.ai GLM | `glm` | OpenAI SDK, `base_url=GLM_BASE_URL` | GLM-4.6 is priced around $0.43/1M input, $1.75/1M output tokens with a 200K context window, and benchmarks close to Claude Sonnet-tier on coding/agentic tasks. GLM also publishes genuinely free rate-limited models (e.g. a "Flash" tier) — good for zero-cost development. OpenAI-SDK compatible: only the base URL and model string change. |
| NVIDIA NIM | `nvidia_nim` | OpenAI SDK, `base_url=NVIDIA_NIM_BASE_URL` | Hosted endpoints are free for prototyping (rate-limited, roughly 40 requests/minute), OpenAI-compatible request shape, and the catalog includes cheap Nemotron Nano/Super variants (as low as ~$0.20/1M tokens combined) alongside many third-party open models. Good zero-cost or near-zero-cost option and a useful comparison point against GLM/Claude. |

**Implementation note:** build `llm_client_factory.py` so the redactor/prompt/parsing code is
provider-agnostic — it should not need to know which provider answered. Only the HTTP client
construction (API key + base URL + model string) branches on `CLOUD_LLM_PROVIDER`. **Before
shipping, verify the exact current model slug and endpoint path for whichever provider you pick
in that provider's own docs** — these catalogs change and a stale hardcoded slug will silently
404 or route to the wrong model.

**Before the API call is made, insert a row into `disclosures`** (with `destination` set to
`anthropic_api`/`glm_api`/`nvidia_nim_api` as appropriate) containing the exact JSON being sent.

### Step 5 — Validate and proceed

Whichever tier and provider answered, validate the response against §8 before doing anything else.

---

## 10. Shadow Verification Gate (Pillar 3)

Runs locally on the backend host's Docker, never on the production EC2 instance.

1. Apply the validated remediation action to a copy of the affected service's Dockerfile/manifest.
2. `docker build --network=none` the patched version locally (both services if the action touched
   a compose deployment and one of them needs rebuilding). **[v4]** Apply the same build security
   controls as §14 (timeout, network isolation).
3. Run it (single container) or bring up the shadow compose stack (MERN). **[v4]** Use Docker
   SDK's automatic port mapping (`-P` / publish all exposed ports) to avoid port collisions
   between concurrent shadow runs and with production. Read back the allocated port from the
   container inspect result. Apply the same resource limits as production.
4. Run the smoke-test suite:

   | Deployment type | Smoke test |
   |---|---|
   | Any | Container(s) stay running >= 15s without exiting — always run first |
   | React (nginx) | `GET /` returns 200, body contains `id="root"` |
   | Express / Flask / FastAPI | `GET /` returns any status `< 500` within 10s |
   | **MERN (compose) [NEW]** | `GET /` on the client returns 200 AND `GET /api/health` through the client's proxy returns a non-5xx. **[v4]** The MERN fixture's Express server **must** include a `GET /api/health` route for this test — no source-code parsing needed. |

5. Record each test in `shadow_tests`. All pass -> `awaiting_approval` (or `promoted` directly in
   `full_auto`). Any fail -> discard, retry (max 3 total), then human handoff.
6. **[v4]** After all tests complete (pass or fail), tear down shadow containers/networks
   (`docker compose down` for compose, `docker rm -f` for single) to avoid resource accumulation.

---

## 11. Autonomy Modes

Unchanged: `full_auto` / `approve_each` (default) / `suggest_only`, per `autonomy_settings.mode`.

---

## 12. Framework Detection, Adapter Registry, and Templates

**[NEW] Adapter registry** (`detector/registry.py`): each supported stack registers
`{name, detect_fn, deployment_type, dockerfile_template(s), default_port, health_check_hint}`.
`detect_fn` inspects the uploaded project and returns true/false; the first match wins, checked
in a fixed priority order (MERN before plain React/Express, since a MERN repo also technically
contains a `package.json` with `react`/`express` markers inside `client/`/`server/`). This
registry is the extension point for Next.js/Vue/Django/Go later — not built this semester, but
adding one is "write an adapter," not "redesign the detector."

**[v4] Entry-point detection:** Templates are Jinja2 files. Each adapter's `detect_fn` also
extracts the entry-point information needed for the template (e.g., the module path for FastAPI,
the start script for Express) so templates are never hardcoded to a single project layout. The
detection logic for each stack is documented below.

### Detection rules

- **MERN [NEW]:** root contains both `client/` and `server/` directories; `client/package.json`
  has React markers; `server/package.json` has `express`.
- **React:** `package.json` has `react-scripts` or `vite`+`react`, no `client/`+`server/` split.
- **Express:** `package.json` has `express`, no React markers, no `client/`+`server/` split.
  **[v4]** TypeScript Express (detected by `tsconfig.json` in root): return
  `422 unsupported_stack` with a message explaining that TypeScript Express is a known limitation
  this semester.
- **Flask:** `requirements.txt` or `pyproject.toml` has `flask`.
- **FastAPI:** `requirements.txt` or `pyproject.toml` has `fastapi`.
- None match -> `422 unsupported_stack`.

### .dockerignore template (used by all stacks) **[v4]**

Every generated Dockerfile is accompanied by this `.dockerignore` placed in the build context:
```
node_modules
.git
.env
.env.*
*.pem
__pycache__
.venv
venv
dist
build
.DS_Store
Dockerfile
```
This prevents secrets, bloated directories, and build artifacts from leaking into the image.

### FastAPI Dockerfile template **[v4 — dynamic entry point]**

Detection extracts `{module_path, app_var}` by scanning Python files for `FastAPI()` instantiation:
1. Check `main.py`, `app/main.py`, `app.py`, `src/main.py` in that order.
2. In the matched file, find `<var> = FastAPI(`. The variable name is `app_var`.
3. The module path is derived from the file path (e.g., `app/main.py` -> `app.main`).
4. If no match: fall back to `app.main:app` and log a warning.

```dockerfile
FROM python:3.12-slim
WORKDIR /code
COPY requirements.txt* pyproject.toml* ./
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; \
    elif [ -f pyproject.toml ]; then pip install --no-cache-dir .; fi
COPY . .
EXPOSE 80
CMD ["uvicorn", "{{ module_path }}:{{ app_var }}", "--host", "0.0.0.0", "--port", "80"]
```
`requirements.txt` must include `fastapi==0.115.0` and `uvicorn[standard]==0.30.0`.
If the project uses `pyproject.toml` instead of `requirements.txt`, the template installs
via `pip install .` — both files are copied, and the `RUN` command checks which exists.

### React Dockerfile template **[v4 — Vite vs CRA]**

Detection determines `build_tool` from `package.json`:
- If `dependencies` or `devDependencies` contains `vite` -> `build_output_dir = "dist"`.
- If `dependencies` contains `react-scripts` -> `build_output_dir = "build"`.
- Fallback: `"dist"` (Vite is now the React default).

```dockerfile
FROM node:18-slim AS build
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install; fi
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/{{ build_output_dir }} /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Express Dockerfile template **[v4 — dynamic entry point]**

Detection extracts `{entry_file}`:
1. Read `package.json` -> if `scripts.start` exists, parse the filename from it
   (e.g., `"start": "node src/index.js"` -> `entry_file = "src/index.js"`).
2. Else if `main` field exists -> use that (e.g., `"main": "app.js"` -> `entry_file = "app.js"`).
3. Else fallback to `index.js`.

```dockerfile
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install; fi
COPY . .
EXPOSE 3000
CMD ["node", "{{ entry_file }}"]
```

### Flask Dockerfile template **[v4 — dynamic entry point]**

Detection extracts `{wsgi_module}`:
1. If `Procfile` exists, parse the gunicorn module from the `web:` line.
2. Else scan `app.py`, `application.py`, `wsgi.py`, `run.py`, `src/app.py` for
   `Flask(__name__)`. Derive module:var (e.g., `app.py` with `app = Flask(...)` -> `app:app`).
3. Fallback: `app:app` with a logged warning.

```dockerfile
FROM python:3.12-slim
WORKDIR /code
COPY requirements.txt* pyproject.toml* ./
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; \
    elif [ -f pyproject.toml ]; then pip install --no-cache-dir .; fi
COPY . .
EXPOSE 8000
CMD ["gunicorn", "-b", "0.0.0.0:8000", "{{ wsgi_module }}"]
```

### MERN templates **[NEW, updated v4]**

Only the `client` service is externally exposed; it proxies `/api/*` to `server` over the
compose-internal network; `mongo` is never port-mapped.

**`client/Dockerfile`** (uses same Vite/CRA detection as standalone React):
```dockerfile
FROM node:18-slim AS build
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install; fi
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/{{ build_output_dir }} /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**`client/nginx.conf`** — **[v4]** preserves `/api/` prefix (more common in MERN tutorials):
```nginx
server {
  listen 80;
  location / {
    root /usr/share/nginx/html;
    try_files $uri /index.html;
  }
  location /api/ {
    proxy_pass http://server:5000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```
**Design decision:** `proxy_pass http://server:5000;` (no trailing slash) preserves the `/api/`
prefix. The Express server is expected to mount routes at `/api/...`. This matches the majority
of MERN tutorials and the fixture project.

**`server/Dockerfile`** (uses same entry-point detection as standalone Express, scoped to
`server/package.json`):
```dockerfile
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install; fi
COPY . .
EXPOSE 5000
CMD ["node", "{{ entry_file }}"]
```

**Runtime compose file** generated for the EC2 host (references already-built, already-loaded
image tags — nothing is built on the shared EC2 instance, same trust boundary as the
single-container path). **[v4]** `version` key removed (deprecated in Compose V2):
```yaml
services:
  client:
    image: cloudforge-<project_id>-client:<deployment_id>
    ports: ["<allocated_host_port>:80"]
    depends_on: [server]
    networks: [cloudforge-net]
    deploy:
      resources:
        limits: { memory: 256M, cpus: "0.5" }
  server:
    image: cloudforge-<project_id>-server:<deployment_id>
    expose: ["5000"]
    environment:
      - MONGO_URI=mongodb://mongo:27017/app
    depends_on: [mongo]
    networks: [cloudforge-net]
    deploy:
      resources:
        limits: { memory: 256M, cpus: "0.5" }
  mongo:
    image: mongo:7
    volumes: ["mongo-data:/data/db"]
    networks: [cloudforge-net]
    deploy:
      resources:
        limits: { memory: 256M, cpus: "0.5" }
networks:
  cloudforge-net: {}
volumes:
  mongo-data: {}
```

**Deploy flow:** build `client` and `server` images locally -> `docker save` both -> transfer
over SSH -> `docker load` on the EC2 host -> `docker pull mongo:7` on the EC2 host directly
(a vetted public image, no transfer needed) -> **[v4]** run
`docker compose -p cloudforge-<project_id> down --remove-orphans` (cleans up any previous
deployment) -> write the runtime compose file ->
`docker compose -p cloudforge-<project_id> up -d`. Only the `client` service consumes a slot
from the port pool.

---

## 13. Health Checks, Port Allocation, Rollback, Resource Limits

**Health-check fallback chain** (30s total window, 2s poll interval):

**[v4] Explicit fallback logic (replaces the ambiguous v3 description):**
1. **Tier 1 (0-10s):** `GET /health` every 2s. Any `2xx` response -> healthy. If all 5 attempts
   return `4xx`, `5xx`, or connection-refused -> fall through to Tier 2.
2. **Tier 2 (10-20s):** `GET /` every 2s. Any status `< 500` -> healthy. If all 5 attempts fail
   -> fall through to Tier 3.
3. **Tier 3 (20-30s):** Raw TCP connect to the port every 2s. Any successful connect -> healthy.
   If all 5 attempts fail -> deployment marked `failed`, rollback triggered.

For MERN, this targets the `client` service's `host_port` only.

**Port allocation:** one port per deployment from `[PORT_POOL_START, PORT_POOL_END]` — for MERN,
allocated only to the `client` row in `containers`; `server`/`mongo` rows have `host_port = NULL`.

**Rollback [v4 — explicit for both deployment types]:**
- **Single container:** `docker stop <current>` -> `docker run` the previous deployment's image
  tag (read from that deployment's `containers` row). If no previous deployment exists, the
  deployment simply stays in `failed` state.
- **Compose:** `docker compose -p cloudforge-<project_id> down` -> rewrite the runtime compose
  file using the previous deployment's image tags (from `containers` rows) ->
  `docker compose -p cloudforge-<project_id> up -d`. MongoDB volumes are **preserved** (never
  deleted during rollback). If no previous deployment exists, `down` only -> `failed` state.

**Resource limits** (identical in shadow and production, per container):
```
--memory=256m --cpus=0.5 --pids-limit=100
```
Never `--privileged`, never `--network=host`.

---

## 14. AWS & Security

**IAM policy [v4 — updated with all required permissions including AWS Setup wizard]:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EC2Provisioning",
      "Effect": "Allow",
      "Action": [
        "ec2:RunInstances",
        "ec2:TerminateInstances",
        "ec2:StartInstances",
        "ec2:StopInstances",
        "ec2:DescribeInstances",
        "ec2:DescribeImages",
        "ec2:CreateTags"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AWSSetupWizard",
      "Effect": "Allow",
      "Action": [
        "ec2:CreateSecurityGroup",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:DescribeSecurityGroups",
        "ec2:DeleteSecurityGroup",
        "ec2:CreateKeyPair",
        "ec2:DeleteKeyPair",
        "ec2:DescribeKeyPairs",
        "ec2:DescribeSubnets",
        "ec2:DescribeVpcs"
      ],
      "Resource": "*"
    },
    {
      "Sid": "IdentityCheck",
      "Effect": "Allow",
      "Action": ["sts:GetCallerIdentity"],
      "Resource": "*"
    }
  ]
}
```
The `AWSSetupWizard` permissions are used by the §23 dashboard automation. They can be removed
from the policy after initial setup if desired.

**Build security [v4]:**
- CloudForge **always generates** the Dockerfile from its own templates (§12). A user-supplied
  `Dockerfile` in the uploaded project is **ignored, never built**.
- All `docker build` invocations use `--network=none` (prevents network access during build,
  blocking exfiltration of host credentials or internal-network scanning).
- All `docker build` invocations are wrapped with a 10-minute timeout. If the build exceeds this,
  it is killed and the deployment fails with `build_timeout` error class.
- Build-time resource limits: `--memory=2g --cpu-quota=100000` (1 CPU).

**Secrets:** `.env` only, never committed or logged. SSH key `chmod 600` (or equivalent ACL on
Windows). Whichever `*_API_KEY` is active must never appear in a log line — audit the LLM client
factory for accidental header logging, for all three providers, not just the default.

**Untrusted code execution:** uploaded projects are executed via `docker build`/`docker run` (or
`docker compose up`) — remote code execution by design, mitigated by: the build security controls
above, runtime resource limits (§13), no privileged mode, no host networking, and remediation
never touching application source (§2).

---

## 15. API Contract

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/health` | — | `{"status":"ok"}` |
| POST | `/projects` | multipart `file` or `{"repo_url"}` | `{"project_id", "detected_framework"}` or 422 |
| POST | `/projects/{id}/deploy` | — | `{"deployment_id"}` |
| GET | `/deployments/{id}` | — | `{"id","status","deployment_type","services":[{"name","image_tag","host_port"}],"app_url",...}` — **[v4]** `app_url` is computed from `instances.public_ip` + client's `containers.host_port`, not stored |
| GET | `/deployments/{id}/diagnoses` | — | list, includes `cloud_provider` when `model_tier="cloud"` |
| GET | `/deployments/{id}/disclosures` | — | list |
| GET | `/deployments/{id}/shadow-tests` | — | list, grouped by `remediation_action_id` |
| GET | `/deployments/{id}/metrics` | `?since=<ISO>&service=<name>` | **[v4]** `[{timestamp, cpu_percent, mem_usage_mb, service}]` — historical metrics for chart reload |
| GET | `/deployments/{id}/remediation-actions` | `?status=<status>` | **[v4]** list — supports filtering by status for page-refresh recovery |
| GET | `/deployments/{id}/report` | — | **[v4]** `{"markdown": "...", "generated_at": "..."}` — see §22 |
| POST | `/remediation-actions/{id}/approve` | — | promotes to EC2 |
| POST | `/remediation-actions/{id}/reject` | — | discards |
| GET / PUT | `/projects/{id}/autonomy` | `{"mode"}` (PUT only) | `{"mode"}` |
| GET | `/projects` | — | `[{"id","name","framework","status","last_deployment_id"}]` |
| POST | `/aws/setup` | `{"aws_access_key_id","aws_secret_access_key","aws_region","allowed_ssh_cidr"}` | **[v4]** `{"setup_id","status"}` — triggers the AWS setup wizard (§23) |
| GET | `/aws/setup/status` | — | **[v4]** `{"status","security_group_id","key_pair_name","ami_id","subnet_id","iam_validated","error_detail"}` |
| POST | `/aws/teardown` | — | **[v4]** Deletes the SG and key pair created by setup (not instances) |
| WS | `/ws/deployments/{id}` | — | see event contract below |
| WS | `/ws/aws-setup` | — | **[v4]** streams setup wizard progress |

### WebSocket Event Contract

- `stage_update` — `{"stage": "provisioning"|"detecting"|"building"|"deploying"|"health_check"|"live"|"failed"|"healing"|"rolled_back"|"generating_report", "detail"}` — **[v4]** `provisioning` covers EC2 reuse/restart/create; `generating_report` is new
- `build_log` / `container_log` — `{"line", "service"}` (`service` disambiguates client/server logs for MERN)
- `metrics` — `{"cpu_percent", "mem_usage_mb", "timestamp", "service"}`
- `diagnosis_proposed` — `{"action_type","params","confidence","model_tier","cloud_provider","reasoning"}`
- `disclosure_logged` — `{"content_sent","destination"}`
- `shadow_test_result` — `{"test_name","passed","output"}`
- `awaiting_approval` — `{"remediation_action_id"}`
- `remediation_promoted` / `remediation_rejected` — `{"remediation_action_id"}`
- `deployment_complete` — `{"app_url","report_url"}` — **[v4]** includes link to deployment report
- `deployment_failed` — `{"reason","rolled_back"}`
- `aws_setup_progress` — **[v4]** `{"step":"validating_iam"|"detecting_vpc"|"creating_sg"|"creating_keypair"|"detecting_ami"|"complete"|"failed", "detail"}`

---

## 16. Frontend — Pages & Components

**Pages:** Upload/New Project, Dashboard, Project Detail (tabs below), Settings (Autonomy dial),
**AWS Setup [v4]** (setup wizard page — see §23).

**Project Detail tabs:** Timeline, Agent Reasoning (shows provider badge — Local / Claude / GLM /
NVIDIA), Disclosure Ledger, Shadow Verification, Logs (tabbed by service for MERN), Metrics,
**Service List [NEW]** (compose deployments only — shows client/server/mongo status individually),
**Deployment Report [v4]** (rendered Markdown of the auto-generated report, with a download
button).

**Components:** `Timeline`, `LogConsole`, `MetricsChart`, `ReasoningTrace`, `DisclosureLedger`,
`ShadowVerificationPanel`, `AutonomyDial`, `ServiceList` **[NEW]**, `DeploymentReport` **[v4]**,
`AWSSetupWizard` **[v4]**.

---

## 17. Weekly Implementation Plan (16 weeks, 4-person team)

**[v4] Extended from 15 to 16 weeks to accommodate AWS automation and deployment docs.**

**Weeks 1-2 — Scaffold, DB, Adapter Registry**
Repo structure (§5), CloudForge's own `docker-compose.yml` (§24), Alembic migration for §7's
schema (including `aws_setup_state` and `deployment_reports`), FastAPI skeleton,
`detector/registry.py` + adapters for all 5 stacks with dynamic entry-point detection (§12),
fixture projects including `mern-sample/` (with `server/` containing a `GET /api/health` route).
*DoD:* `pytest tests/test_detector.py -v` passes all 5 fixtures (incl. MERN, incl. a Vite React
fixture and a CRA React fixture) + 1 negative case + 1 TypeScript Express -> 422.

**Weeks 3-4 — Templates, Build, Log Streaming**
Jinja2 Dockerfile/compose templates (§12) with `.dockerignore`, `build_service/` with per-service
log streaming. Build uses `--network=none` and 10-min timeout (§14).
*DoD:* all 5 fixtures build successfully (MERN builds both `client` and `server` images); a
Vite-based React fixture produces output from `dist/`; a CRA-based one from `build/`.

**Week 5 — AWS Setup Wizard [v4]**
`aws_setup/setup_service.py`, `api/aws_setup.py`, frontend `AWSSetupWizard` component.
Auto-creates SG, key pair, detects AMI, validates IAM, writes results to `aws_setup_state`.
*DoD:* `pytest tests/test_aws_setup.py -v` (mocked boto3) proves SG creation, key-pair creation,
AMI detection, IAM validation, and error handling. Manual test: run wizard against real AWS,
confirm resources are created.

**Week 6 — EC2 Auto-Provisioning [NEW, v4 hardened]**
`deployer/ec2_provisioner.py`: advisory-lock-protected reuse-or-restart-or-create logic (§8a),
reconciliation with AWS, user-data bootstrap (§25).
*DoD:* `pytest tests/test_ec2_provisioner.py -v` (mocked boto3) proves: reuse-when-running,
restart-when-stopped, create-when-under-cap, hard-fail-when-at-cap, reconciliation-updates-DB,
and advisory-lock-serialization, all without hitting real AWS.

**Week 7 — Deploy Pipeline**
`deploy.py`: SSH-transfer for single-container; build-locally/transfer/compose-up for MERN.
Includes `docker compose down --remove-orphans` before redeploys.
*DoD:* deploying the FastAPI fixture AND the MERN fixture both return live, curl-able URLs within
120s.

**Week 8 — Health Checks + Rollback**
`health/check.py` with tiered fallback chain (§13), rollback for both single-container and
compose (§13).
*DoD:* a broken deploy of each deployment type triggers rollback, confirmed via curl. Compose
rollback preserves MongoDB volumes.

**Week 9 — Metrics + Dashboard Base**
`metrics/poller.py` (per-service for compose), Dashboard, Timeline/Logs/Metrics/ServiceList tabs,
`GET /deployments/{id}/metrics` endpoint.
*DoD:* metrics accumulate for every running container, including all 3 MERN services. Chart
reloads correctly on page refresh via the REST endpoint.

**Week 10 — Classifier + Grammar + Action Functions**
`classifier.py` (§9 table, incl. Mongo pattern and build_network_error), `grammar.py` (§8,
7 actions incl. `RESTART_SERVICE` with `cmd` as JSON array), one tested `apply_*` function per
action.
*DoD:* every fixture's injected failure (one per error_class, incl. `db_connection_failed`)
classifies correctly; every action function rejects invalid params; `SET_ENV_VAR` rejects both
secret keys and embedded-credential values.

**Week 11 — Local LLM Diagnosis**
`redactor.py`, `local_llm.py`.
*DoD:* local model returns a valid, schema-conformant action + confidence for each injected
failure, logged to `diagnoses`.

**Week 12 — Provider-Agnostic Cloud Escalation**
`llm_client_factory.py` supporting all three providers, escalation logic, `disclosures` writes.
*DoD:* force a low-confidence local result with `CLOUD_LLM_PROVIDER=anthropic`; repeat with
`glm`; repeat with `nvidia_nim`. All three produce a valid response and an exact-match
`disclosures` row (assert programmatically).

**Week 13 — Shadow Verification Gate**
`shadow.py`, smoke tests incl. the MERN client->server->mongo check (using the fixture's
`/api/health` route). Uses `-P` for port allocation. Shadow cleanup after each run.
*DoD:* a valid fix passes; an intentionally bad fix fails and retries; shadow containers are
cleaned up after each run.

**Week 14 — Autonomy Modes + Full Loop Wiring + Deployment Docs [v4]**
`autonomy_settings`, `/approve` and `/reject`, orchestrator wiring end-to-end.
`doc_generator/generator.py` (§22), `GET /deployments/{id}/report`, `DeploymentReport` frontend
component.
*DoD:* §18's acceptance test passes in all three autonomy modes. A successful deployment produces
a downloadable report with all required sections.

**Week 15 — MERN Hardening + Adapter Registry Docs**
Fix whatever the compose path surfaces; write up the adapter registry as a short CONTRIBUTING
note so a future Next.js/Vue/Django/Go adapter is a documented, contained task.

**Week 16 — Final Hardening, `e2e_demo.sh`, Demo Prep**
Input validation, ZIP-bomb guard (reject ZIPs > 100MB or with > 10,000 entries),
`scripts/e2e_demo.sh` covering the happy path for all 5 fixtures plus at least 2
injected-failure paths, bug fixes, demo rehearsal, resume metrics (§19).

---

## 18. Final End-to-End Acceptance Test

```
 1. docker compose up -d db backend frontend
 2. Confirm Ollama is running and at least one cloud provider key is set
 3. Open the dashboard -> AWS Setup page -> run the setup wizard with AWS credentials
    Confirm: SG created, key pair generated (.pem saved), AMI detected, IAM validated
 4. Confirm no EC2 instance exists yet tagged "cloudforge-managed"
 5. Upload the MERN fixture; click Deploy
 6. Timeline: provisioning (new instance created + tagged) -> detecting -> building (both
    client+server) -> deploying (compose up) -> health_check -> live -> generating_report
 7. Confirm app_url serves the React client, and /api/health through the client's proxy
    successfully reaches the Express server and Mongo
 8. Open the Deployment Report tab — confirm it shows infrastructure, services, timeline,
    health results. Download the Markdown file.
 9. Deploy a second project (e.g. Flask fixture) — confirm the SAME tagged instance is
    reused, not a new one created
10. Stop the EC2 instance manually via AWS console. Deploy a third project — confirm the
    provisioner detects the stopped instance, restarts it, and deploys successfully [v4]
11. Upload a FastAPI fixture with a deliberately missing dependency; deploy; confirm it fails,
    diagnoses via local LLM (or escalates — check the Disclosure Ledger matches exactly what
    was sent), passes shadow verification, and (in approve_each) requires a click to promote
12. Repeat step 11 in full_auto (no click needed) and suggest_only (never auto-promotes)
13. bash scripts/e2e_demo.sh — exits 0
```

---

## 19. Resume Metrics to Capture During Week 16

- Unattended fix success rate across the 7 injected failure types (now including MERN's
  `db_connection_failed` and `build_network_error`)
- Local-vs-cloud escalation rate, and — if you tested more than one cloud provider — a short
  comparison of confidence/accuracy across providers on the same fixture set
- Mean time from failure detection to a shadow-verified fix
- Mean time from "no instance exists" to a live app (demonstrates the provisioning automation)
- **[v4]** Mean time for the AWS Setup wizard to complete (SG + key pair + AMI detection)
- **[v4]** Number of deployment reports generated and their completeness

---

## 20. Risks & Mitigations

- **Scope creep** — §2's in/out lists are the contract; §17's weekly DoDs enforce it.
- **Runaway EC2 creation** — hard-capped by `MAX_EC2_INSTANCES` + tag-based reuse (§8a);
  **[v4]** advisory lock prevents race-condition bypass; terminated instances don't count against
  the cap; creation fails loudly past the cap rather than retrying.
- **EC2 state drift** — **[v4]** reconciliation step on every provisioning call syncs the local
  `instances` table with AWS reality. Stopped instances are auto-restarted instead of ignored.
- **Build-time RCE** — **[v4]** `docker build --network=none` with 10-minute timeout; CloudForge
  never uses user-supplied Dockerfiles, only its own generated templates.
- **Local LLM inconsistency** — the classifier runs first, so the LLM does constrained selection,
  not open-ended reasoning; malformed output is discarded, never repaired-and-retried blindly.
- **Cloud API cost or availability** — provider-agnostic by design; if one provider's free tier
  rate-limits you mid-demo, switching is a config change, not a code change.
- **Provider catalogs going stale** — model slugs/endpoints for GLM and NVIDIA NIM are noted as
  subject to change; §1 rule 3 requires verifying them before shipping, not trusting this doc
  blindly months later.
- **MERN's extra moving parts** — the client-proxies-to-server-internally design keeps port
  allocation and health checks identical in shape to the single-container case; the compose
  path is the only genuinely new deploy mechanism to get right.
- **A remediation loop that never converges** — capped at 3 attempts, then human handoff.
- **Hardcoded entry points breaking real projects** — **[v4]** all templates use dynamic
  entry-point detection with documented fallback defaults and logged warnings.

---

## 21. Explicit Reminder

Autoscaling, multi-user auth, CI/CD webhooks, CloudWatch, HTTPS, editing the user's application
source, building the Next.js/Vue/Django/Go adapters, and TypeScript Express support are
intentionally not built this semester (§2). If mid-build the agent finds itself writing code for
any of these, stop and re-read Section 2.

**[v4]** Note: Security Group and Key Pair creation are **no longer** in the out-of-scope list —
they are now automated via the dashboard (§23). This is a change from v3.

---

## 22. Deployment Documentation Generator **[v4 — NEW]**

After every successful deployment (status transitions to `live`), the orchestrator invokes the
doc generator to produce a structured Markdown report.

### Report content

The generated report follows this template:

```markdown
# Deployment Report — <project_name>

**Generated:** <timestamp>
**Status:** <deployed | rolled_back>

## Project
- **Name:** <name>
- **Framework:** <react | express | flask | fastapi | mern>
- **Deployment Type:** <single_container | compose>
- **Source:** <ZIP upload | GitHub URL>

## Infrastructure
- **EC2 Instance:** <aws_instance_id>
- **Public IP:** <public_ip>
- **Instance Type:** <instance_type>
- **Region:** <region>
- **Provisioning Action:** <reused | restarted | created>

## Services
| Service | Image Tag | Port | Status |
|---------|-----------|------|--------|
| <name>  | <tag>     | <port or "internal"> | <running | stopped> |

## Timeline
| Stage | Timestamp | Detail |
|-------|-----------|--------|
| <stage> | <created_at> | <detail> |

## Health Check
- **Method:** </health | / | TCP>
- **Response Time:** <ms>
- **Result:** <passed | failed -> rolled_back>

## Remediation History
*(Only included if remediation was triggered)*
| Attempt | Error Class | Model | Provider | Confidence | Action | Shadow Pass |
|---------|-------------|-------|----------|------------|--------|-------------|

## Environment Variables (keys only)
- <KEY_1>
- <KEY_2>

## Access
- **App URL:** http://<public_ip>:<host_port>
```

### Implementation

- Lives in `doc_generator/generator.py`.
- Queries `deployments`, `containers`, `instances`, `stage_events`, `failures`, `diagnoses`,
  `remediation_actions`, `shadow_tests` for the given `deployment_id`.
- Renders the Markdown via a Jinja2 template.
- Stores the rendered Markdown in `deployment_reports` table.
- API: `GET /deployments/{id}/report` returns the stored Markdown (or 404 if not yet generated).
- Frontend: `DeploymentReport` component renders the Markdown in a tab and provides a download
  button that saves the file as `cloudforge-report-<deployment_id>.md`.

---

## 23. Full AWS Automation from Dashboard **[v4 — NEW]**

### Motivation

v3 required the human to manually create a Security Group, Key Pair, and discover the AMI ID
before CloudForge could deploy anything. v4 automates all of this from a setup wizard in the
dashboard, reducing Day-0 AWS prerequisites to: "have an AWS account with the §14 IAM policy."

### Setup wizard flow

The frontend `AWSSetup` page provides a step-by-step wizard. Progress is streamed via
`/ws/aws-setup`. The backend `aws_setup/setup_service.py` executes the following steps:

**Step 1 — Validate IAM Permissions**
Call `sts:GetCallerIdentity` to confirm credentials work, then attempt a dry-run
`ec2:DescribeInstances` to confirm EC2 permissions. If either fails, abort with a clear error
explaining which permission is missing.

**Step 2 — Detect or Select VPC and Subnet**
Call `ec2:DescribeVpcs` to list VPCs. If a default VPC exists (`isDefault=true`), use it. Else,
present the list to the user for manual selection (via the wizard UI) or fail with a message
asking them to create a default VPC.
Call `ec2:DescribeSubnets` filtered by the selected VPC with
`MapPublicIpOnLaunch=true` to find a public subnet. Pick the first one. Store `subnet_id`.

**Step 3 — Create Security Group**
Call `ec2:CreateSecurityGroup` with name `cloudforge-sg-<timestamp>`, description
"CloudForge managed - auto-created by setup wizard", in the selected VPC.
Then `ec2:AuthorizeSecurityGroupIngress`:
- SSH (port 22) from the `allowed_ssh_cidr` parameter (provided by the user in the wizard, e.g.,
  `203.0.113.5/32`). If not provided, default to `0.0.0.0/0` with a warning displayed in the UI.
- TCP ports 8000-8099 from `0.0.0.0/0` (for deployed apps).

Store `security_group_id` in `aws_setup_state`.

**Step 4 — Create Key Pair**
Call `ec2:CreateKeyPair` with name `cloudforge-key-<timestamp>`. Save the returned private key
material to `<project_root>/keys/cloudforge-key-<timestamp>.pem`. Set file permissions to
owner-read-only (`chmod 600` on Linux/Mac, equivalent ACL on Windows).
Store `key_pair_name` and `ssh_key_path` in `aws_setup_state`.

**Step 5 — Detect AMI**
Call `ec2:DescribeImages` with filters:
- `name`: `ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-*`
- `owner-alias`: `amazon`
- `state`: `available`
- `architecture`: `x86_64`
Sort by `CreationDate` descending, pick the latest. Store `ami_id`.
Confirm `EC2_SSH_USER=ubuntu` matches the AMI.

**Step 6 — Persist and Apply**
Write all values to the `aws_setup_state` DB table. Mark `setup_status = 'complete'`.
Stream a final `aws_setup_progress` event with `step=complete`.

### Config resolution order **[v4]**

When the EC2 provisioner needs a value (e.g., `EC2_SECURITY_GROUP_ID`), it checks:
1. `aws_setup_state` table (if `setup_status = 'complete'`) — **primary source after wizard runs**
2. `.env` file — **fallback / manual override**
3. If neither has the value -> fail with a clear error directing the user to run the setup wizard.

This means advanced users can still manually set values in `.env` to override the wizard, but
first-time users get a fully automated experience.

### Tests

`test_aws_setup.py` (mocked boto3): SG creation, key-pair creation, AMI detection (with
simulated image list), IAM validation failure, VPC detection (with and without default VPC),
and idempotent re-run (should detect existing resources and reuse them rather than creating
duplicates).

---

## 24. CloudForge Platform `docker-compose.yml` **[v4 — NEW]**

This is the compose file at the repo root that runs CloudForge itself (not the user's projects).

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: cloudforge
      POSTGRES_PASSWORD: cloudforge
      POSTGRES_DB: cloudforge
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cloudforge"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    env_file: .env
    environment:
      - DATABASE_URL=postgresql://cloudforge:cloudforge@db:5432/cloudforge
      - OLLAMA_HOST=http://host.docker.internal:11434
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "8000:8000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock   # backend needs Docker access for builds
      - ./keys:/app/keys                             # SSH keys for EC2
      - uploads:/app/uploads                         # uploaded project ZIPs
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000

  frontend:
    build: ./frontend
    depends_on:
      - backend
    ports:
      - "3000:80"

volumes:
  pgdata: {}
  uploads: {}
```

**Note:** Ollama runs on the host machine (not in Docker) because it needs direct GPU access.
The backend connects to it via `OLLAMA_HOST=http://host.docker.internal:11434` (Docker Desktop
on Mac/Windows) or the host's LAN IP (Linux — add `extra_hosts: ["host.docker.internal:host-gateway"]`
to the backend service on Linux).

---

## 25. EC2 User-Data Bootstrap Script **[v4 — NEW]**

This script is passed as `UserData` (base64-encoded) in the `ec2:RunInstances` call. It runs as
root on first boot and installs Docker + Docker Compose plugin on the provisioned Ubuntu 22.04
instance.

```bash
#!/bin/bash
set -euxo pipefail

# Log everything for debugging (visible via ec2 GetConsoleOutput)
exec > /var/log/cloudforge-bootstrap.log 2>&1

echo "=== CloudForge EC2 Bootstrap ==="
echo "Started: $(date -u)"

# Update and install prerequisites
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key and repository
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Enable and start Docker
systemctl enable docker
systemctl start docker

# Allow the ubuntu user to run docker without sudo
usermod -aG docker ubuntu

# Signal completion
touch /home/ubuntu/.cloudforge-bootstrap-done
echo "=== CloudForge Bootstrap Complete ==="
echo "Finished: $(date -u)"
```

**Readiness detection:** After `ec2:DescribeInstances` shows the instance as `running`, the EC2
provisioner SSHs in (with retries every 5s, up to 120s total) and checks for the existence of
`/home/ubuntu/.cloudforge-bootstrap-done`. Only when that file exists is the instance considered
ready for deployment. As a fallback, it also runs `docker info` to confirm Docker is responsive.

---

## 26. Cross-Stack Compatibility Matrix **[v4 — NEW]**

Verification that every pipeline stage works for every supported stack:

| Stage | React | Express | Flask | FastAPI | MERN |
|-------|-------|---------|-------|---------|------|
| Detection | Vite+CRA | JS only (TS->422) | req.txt+pyproject | req.txt+pyproject | client/+server/ |
| Entry-Point | N/A (nginx) | Dynamic from pkg.json | Dynamic scan | Dynamic scan | Per sub-project |
| .dockerignore | Yes | Yes | Yes | Yes | Yes per service |
| Build Output | dist/ or build/ | N/A | N/A | N/A | client: dist/ or build/ |
| Build Security | --network=none | --network=none | --network=none | --network=none | --network=none |
| Deploy (SSH) | docker run | docker run | docker run | docker run | compose up |
| Health Check | Tier 1->3 | Tier 1->3 | Tier 1->3 | Tier 1->3 | client port only |
| Shadow Verify | GET / | GET / | GET / | GET / | GET / + /api/health |
| Rollback | docker run prev | docker run prev | docker run prev | docker run prev | compose down+up prev |
| Metrics | single container | single container | single container | single container | per service |
| Remediation | all 7 actions | all 7 actions | all 7 actions | all 7 actions | all 7 + service targeting |
| Deploy Report | Yes | Yes | Yes | Yes | Yes |
