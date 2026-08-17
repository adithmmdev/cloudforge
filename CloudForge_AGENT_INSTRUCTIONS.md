# CloudForge — Agent Instructions (read this before writing any code)

> **Purpose:** This file is the operational companion to `CloudForge_README_v4_FINAL.md` (the
> spec). The spec defines *what* to build. This file defines *how* to build it safely, correctly,
> and resumably using an AI coding agent.
>
> **Read order:** Read this file first, then the spec. During coding, keep both files in context.
> When resuming a session, read `progress.json` (§4) first, then this file, then the spec.

---

## 1. IDENTITY & MISSION

You are building **CloudForge**, an autonomous self-healing cloud deployment platform. It is a
4th-year capstone project. The spec (`CloudForge_README_v4_FINAL.md`) is the single source of
truth — this file is a reference and guardrail companion, not a replacement.

**Your job is NOT to improvise.** Your job is to translate the spec into working code, verify
every piece with real tests, and never fabricate results.

---

## 2. ABSOLUTE RULES (non-negotiable — violating any of these is a critical failure)

These are extracted verbatim from the spec's §1, §2, §8, §8a, §9, §12, §14. If any rule here
conflicts with something you think should be done differently, the rule wins.

### R1 — Pinned Versions Only
Use only the versions in the tech stack table (§3 of spec). Do not upgrade, downgrade, or
substitute without explicit human approval.

### R2 — No Direct LLM Execution
Every proposed remediation action must be validated against the §8 grammar schema before
anything is applied. An action outside the enum, or with a param that fails validation, is
**discarded** — never retried with a "fixed-up" version, never partially applied.

### R3 — No API Signature Invention
Do not guess boto3, paramiko, Docker SDK, Ollama, or LLM-provider API method signatures. If
you're not certain a method exists as you're about to call it, **check the official docs first**.
This is especially critical for:
- `ec2:RunInstances` parameters (AMI, subnet, user-data, tags)
- `paramiko.SSHClient` connection and command execution
- `docker.from_env()` build/run/inspect methods
- Ollama `/api/generate` or `/api/chat` endpoint shape
- NVIDIA NIM / Z.ai / Anthropic request/response schemas

### R4 — No Fabricated Results
Never fabricate command output, test results, AWS resource IDs, or "it works" statements. Every
Definition of Done (§5 of this file) has a real command to run. Run it. If it fails, report the
failure honestly.

### R5 — No Raw Data to Cloud LLM
Never send raw source code, raw logs, raw error messages, or raw environment variables to any
cloud LLM. Only the redacted signature object (spec §9 Step 2) may leave the local boundary.
This applies identically to all three providers (Anthropic, GLM, NVIDIA NIM).

### R6 — Hard Instance Cap
EC2 provisioning must never exceed `MAX_EC2_INSTANCES`. This is a hard failure, not a
retry-until-it-works path. Count only `pending`, `running`, `stopped` instances (never
`terminated`). Use an advisory lock to prevent races. See spec §8a.

### R7 — Ambiguity Resolution
If a requirement is ambiguous, use the documented default in the spec. If genuinely uncovered,
pick the simplest option that satisfies the acceptance test (spec §18). Note the decision in
the commit message. **Do not invent behavior.**

### R8 — Scope Boundary
Everything in spec §2's "Out of scope" list is off-limits. If you find yourself writing code for
autoscaling, multi-user auth, CI/CD webhooks, HTTPS, TypeScript Express support, or editing user
application source code — **stop and re-read spec §2.**

### R9 — Build Security
- CloudForge **always** generates Dockerfiles from its own Jinja2 templates (spec §12).
- A user-supplied `Dockerfile` in the uploaded project is **ignored, never built**.
- All `docker build` commands must include `--network=none` and a 10-minute timeout.
- Build-time resource limits: `--memory=2g --cpu-quota=100000` (1 CPU).

### R10 — Never Privileged Containers
Runtime containers: `--memory=256m --cpus=0.5 --pids-limit=100`. Never `--privileged`, never
`--network=host`.

### R11 — Disclosure Logging
Before any cloud LLM API call, insert a row into the `disclosures` table containing the exact
JSON being sent and the destination (`anthropic_api` / `glm_api` / `nvidia_nim_api`). This row
must be written **before** the API call, not after.

### R12 — Remediation Never Touches Source
Remediation only touches deployment configuration (Dockerfile, compose file, start command, env
vars, resource limits, exposed port, restarting a known service). It **never** modifies the
uploaded project's source files.

### R13 — Secret Filtering
`SET_ENV_VAR` must reject: keys matching `(?i)(secret|token|password|api[_-]?key)`, values
matching `://[^:]+:[^@]+@` (embedded credentials), and values longer than 500 characters.

### R14 — Cascading Deletes
All child foreign keys use `ON DELETE CASCADE` (except `projects.user_id` which uses
`ON DELETE SET NULL`). Verify this in every Alembic migration.

### R15 — TIMESTAMPTZ Not TIMESTAMP
All timestamp columns use `TIMESTAMPTZ`, not `TIMESTAMP`. This is PostgreSQL-specific and
avoids timezone ambiguity.

---

## 3. ANTI-HALLUCINATION PROTOCOL

Before writing code that calls any external API, SDK, or CLI, verify the exact method signature:

### 3.1 — boto3 Verification Checklist
- [ ] `ec2.run_instances()` — verify parameter names: `ImageId`, `InstanceType`, `SecurityGroupIds` (list), `KeyName`, `SubnetId`, `UserData` (base64-encoded string), `TagSpecifications`, `MinCount`, `MaxCount`
- [ ] `ec2.describe_instances()` — verify `Filters` format: `[{"Name": "tag:key", "Values": ["value"]}]`
- [ ] `ec2.start_instances()` — verify parameter: `InstanceIds` (list)
- [ ] `ec2.create_security_group()` — verify parameters: `GroupName`, `Description`, `VpcId`
- [ ] `ec2.authorize_security_group_ingress()` — verify `IpPermissions` structure
- [ ] `ec2.create_key_pair()` — verify response includes `KeyMaterial`
- [ ] `ec2.describe_images()` — verify `Filters`, `Owners` parameter
- [ ] `sts.get_caller_identity()` — verify no parameters needed
- [ ] `ec2.describe_vpcs()` — verify `Filters` for `isDefault`
- [ ] `ec2.describe_subnets()` — verify `Filters` for `MapPublicIpOnLaunch`

### 3.2 — Docker SDK Verification Checklist
- [ ] `client.images.build()` — verify `path`, `tag`, `network_mode`, `timeout`, `buildargs`, `rm`, `decode` params
- [ ] `client.containers.run()` — verify `image`, `ports`, `detach`, `mem_limit`, `cpu_quota`, `pids_limit`, `network_mode` params
- [ ] `client.containers.get()` — verify `.attrs["NetworkSettings"]["Ports"]` for port inspection
- [ ] `container.logs()` — verify `stream=True`, `follow=True` for real-time streaming

### 3.3 — Paramiko Verification Checklist
- [ ] `SSHClient.connect()` — verify `hostname`, `username`, `pkey` (from `RSAKey.from_private_key_file()`), `timeout`
- [ ] `SSHClient.exec_command()` — verify returns `(stdin, stdout, stderr)` tuple
- [ ] `SFTPClient.put()` — verify local_path, remote_path parameters
- [ ] SFTP via `client.open_sftp()` — verify this is how you transfer files

### 3.4 — LLM Provider Verification
- [ ] NVIDIA NIM: base URL is `https://integrate.api.nvidia.com/v1`, uses OpenAI SDK, model slug `z-ai/glm-5.2` (verified Aug 2026)
- [ ] Z.ai direct: base URL is `https://api.z.ai/api/paas/v4`, uses OpenAI SDK, model slug `glm-5.2`
- [ ] Anthropic: uses Anthropic SDK, model slug `claude-haiku-4-5-20251001`
- [ ] All three must accept the same prompt structure and return structured JSON parseable against §8

### 3.5 — Ollama Verification
- [ ] Local endpoint: `http://localhost:11434`
- [ ] Verify `/api/chat` or `/api/generate` endpoint and request/response shape
- [ ] Model: `qwen2.5-coder:7b-instruct`
- [ ] Response must be parsed as JSON; parse failure → `NONE` with confidence `0`

---

## 4. PROGRESS TRACKING & SESSION RESUMABILITY

### 4.1 — Progress File

Maintain a `progress.json` file at the repo root that tracks what's been completed:

```json
{
  "last_updated": "2026-08-16T12:00:00Z",
  "current_phase": "week_5",
  "completed_tasks": [
    {
      "task": "weeks_1_2_scaffold_db_adapters",
      "status": "complete",
      "dod_result": "pytest tests/test_detector.py -v — 7/7 passed",
      "commit": "abc1234",
      "notes": "Used 'dist' as React default. Flask pyproject.toml support verified."
    }
  ],
  "in_progress_task": {
    "task": "week_5_aws_setup_wizard",
    "started_at": "2026-08-16T10:00:00Z",
    "files_modified": [
      "backend/app/aws_setup/setup_service.py",
      "backend/app/api/aws_setup.py"
    ],
    "files_remaining": [
      "frontend/src/pages/AWSSetup.jsx",
      "frontend/src/components/AWSSetupWizard.jsx",
      "backend/tests/test_aws_setup.py"
    ],
    "blockers": [],
    "decisions_made": [
      "Used ec2.describe_vpcs with Filters=[{'Name':'isDefault','Values':['true']}]"
    ]
  },
  "pending_tasks": ["week_6", "week_7", "..."],
  "known_issues": [],
  "environment_verified": {
    "docker": true,
    "ollama": true,
    "postgres": true,
    "node": true,
    "python": true,
    "aws_credentials": false
  }
}
```

### 4.2 — Session Start Protocol

When starting a new session or resuming work:

1. **Read `progress.json`** — understand what's done, what's in progress, what's blocked.
2. **Read this file** — refresh all rules and constraints.
3. **Read the spec** — if the current task references specific sections, read those sections.
4. **Check the codebase** — `git log -5`, `git status`, review any files listed in `in_progress_task.files_modified`.
5. **Resume from exactly where the previous session left off.** Do not restart completed work.
6. **Run existing tests** — `pytest tests/ -v` to confirm nothing is broken before making changes.

### 4.3 — Session End Protocol

Before ending a session:

1. **Update `progress.json`** — mark completed tasks, update in-progress state, note any decisions.
2. **Run all tests** — `pytest tests/ -v`. Record the result.
3. **Commit with a descriptive message** — include the task reference (e.g., "Week 5: AWS Setup wizard — SG creation + key pair gen").
4. **Note any blockers or open questions** in `progress.json.known_issues`.

---

## 5. IMPLEMENTATION ORDER (dependency-aware)

Build in this exact order. Each task depends on the ones above it. Do not skip ahead.

### Phase 1: Foundation (Weeks 1–2)

```
TASK 1.1: Project scaffold
  Create: docker-compose.yml (§24 of spec), .env.example, repo structure (§5)
  DoD: `docker compose up -d db` succeeds, postgres is reachable

TASK 1.2: Database schema + migrations
  Create: Alembic config, initial migration with ALL 14 tables from §7
  Verify: ON DELETE CASCADE on all child FKs, TIMESTAMPTZ everywhere
  DoD: `alembic upgrade head` succeeds, all tables exist with correct columns

TASK 1.3: FastAPI skeleton + health endpoint
  Create: backend/app/main.py, GET /health
  DoD: `curl localhost:8000/health` returns {"status":"ok"}

TASK 1.4: SQLAlchemy models
  Create: backend/app/models/ — one model per table, matching §7 exactly
  DoD: models import without error, relationships match FK definitions

TASK 1.5: Adapter registry + all 5 detectors
  Create: detector/registry.py, adapters/react.py, express.py, flask.py, fastapi.py, mern.py
  Detection order: MERN → React → Express → Flask → FastAPI → 422
  Entry-point extraction: per spec §12 for each stack
  DoD: pytest tests/test_detector.py -v — passes all fixtures

TASK 1.6: Test fixtures
  Create: tests/fixtures/ — react-sample/ (Vite), react-cra-sample/ (CRA),
          express-sample/, flask-sample/, fastapi-sample/,
          mern-sample/ (client/ + server/ with GET /api/health route)
  Also: one broken variant per stack, one TypeScript Express project
```

### Phase 2: Build & Deploy Infrastructure (Weeks 3–7)

```
TASK 2.1: Jinja2 templates + .dockerignore
  Create: all Dockerfile.j2 templates per §12, dockerignore.j2
  Verify: FastAPI template uses {{ module_path }}:{{ app_var }}
          React template uses {{ build_output_dir }}
          Express template uses {{ entry_file }}
          Flask template uses {{ wsgi_module }}
          MERN templates: client + server + nginx.conf + compose.yml
  DoD: pytest tests/test_dockerfile_gen.py -v

TASK 2.2: Build service
  Create: build_service/ — docker build with --network=none, 10-min timeout,
          --memory=2g, --cpu-quota=100000, per-service log streaming
  DoD: all 5 fixtures build successfully

TASK 2.3: AWS Setup wizard (backend)
  Create: aws_setup/setup_service.py — 6 steps per spec §23
          api/aws_setup.py — POST /aws/setup, GET /aws/setup/status, POST /aws/teardown
  Config resolution: aws_setup_state table → .env → fail with error
  DoD: pytest tests/test_aws_setup.py -v (mocked boto3)

TASK 2.4: AWS Setup wizard (frontend)
  Create: pages/AWSSetup.jsx, components/AWSSetupWizard.jsx
  WS: /ws/aws-setup with aws_setup_progress events
  DoD: manual test — wizard completes all 6 steps against real AWS

TASK 2.5: EC2 provisioner
  Create: deployer/ec2_provisioner.py per spec §8a (advisory lock algorithm)
  MUST implement: advisory lock, reconciliation, reuse/restart/create, cap enforcement
  User-data: spec §25 bootstrap script, base64-encoded
  Readiness: SSH retry every 5s up to 120s, check for .cloudforge-bootstrap-done + docker info
  DoD: pytest tests/test_ec2_provisioner.py -v (mocked boto3) — 6 test cases

TASK 2.6: Deploy service
  Create: deployer/deploy.py — SSH transfer for single-container, compose for MERN
  Single: docker save → SSH → docker load → docker run
  MERN: build both → docker save both → SSH → docker load both → docker pull mongo:7 →
        docker compose down --remove-orphans → write compose file → docker compose up -d
  DoD: FastAPI AND MERN fixtures deploy and return live URLs within 120s
```

### Phase 3: Monitoring & Health (Weeks 8–9)

```
TASK 3.1: Health checks
  Create: health/check.py — 3-tier fallback chain per spec §13
  Tier 1: GET /health (0-10s), Tier 2: GET / (10-20s), Tier 3: TCP (20-30s)
  For MERN: target client's host_port only
  DoD: healthy app passes Tier 1; app without /health passes Tier 2; raw TCP server passes Tier 3

TASK 3.2: Rollback
  Single: docker stop → docker run previous image tag
  Compose: docker compose down → rewrite compose with previous tags → up -d
  MongoDB volumes: ALWAYS preserved during rollback
  No previous deployment: stay in 'failed' state
  DoD: broken deploy triggers rollback; compose rollback preserves mongo data

TASK 3.3: Port allocator
  Create: deployer/port_allocator.py — allocate from [PORT_POOL_START, PORT_POOL_END]
  MERN: only client gets a host port; server/mongo get NULL
  DoD: pytest tests/test_port_allocation.py -v

TASK 3.4: Metrics collection
  Create: metrics/poller.py — docker stats per container, write to metrics table
  Per-service for compose (all 3 MERN services)
  Stream via WebSocket
  DoD: metrics accumulate for all containers

TASK 3.5: Dashboard frontend
  Create: Upload, Dashboard, ProjectDetail pages
  Tabs: Timeline, Logs (tabbed by service for MERN), Metrics, ServiceList (compose only)
  DoD: dashboard loads, shows deployment timeline, charts display metrics
```

### Phase 4: Remediation Loop (Weeks 10–14)

```
TASK 4.1: Error classifier
  Create: remediation/classifier.py — regex patterns per spec §9 Step 1
  ALL 10 patterns: missing_python_dep, missing_node_dep, port_conflict,
                    wrong_base_image_arch, out_of_memory, missing_or_wrong_start_command,
                    missing_env_var, db_connection_failed, build_network_error, unclassified
  DoD: pytest tests/test_classifier.py -v — each pattern classifies correctly

TASK 4.2: Grammar validator + action functions
  Create: remediation/grammar.py — validate §8 actions, one apply_* function per action
  SET_START_COMMAND: cmd must be JSON array, cmd[0] in allowlist
  SET_ENV_VAR: reject secret keys, embedded credentials, long values
  RESTART_SERVICE: service must exist in deployment's containers
  DoD: pytest tests/test_grammar_validation.py -v

TASK 4.3: Redactor
  Create: remediation/redactor.py — produce the signature object from spec §9 Step 2
  ONLY fields: error_class, framework, deployment_type, service, extracted_token, exit_code, attempt_number
  Secret-pattern filter before inclusion
  DoD: pytest tests/test_redactor.py -v — no secrets leak through

TASK 4.4: Local LLM client
  Create: remediation/local_llm.py — Ollama structured-JSON prompt
  Prompt includes §8 grammar table + few-shot examples
  Parse with strict schema validation; parse failure = NONE/confidence 0
  DoD: local model returns valid action + confidence for each injected failure

TASK 4.5: Cloud LLM client factory
  Create: remediation/llm_client_factory.py — provider-agnostic
  Branching: only HTTP client construction (API key + base URL + model) differs
  Redactor/prompt/parsing: IDENTICAL across all providers
  Disclosure: write to disclosures table BEFORE API call
  DoD: force low-confidence with each provider → valid response + disclosures row

TASK 4.6: Shadow verification
  Create: remediation/shadow.py — build + run in disposable container
  Build: --network=none, same security controls as production
  Ports: use -P (publish all) for automatic port mapping → read back allocated port
  Smoke tests per deployment type (spec §10)
  Cleanup: docker rm -f (single) or docker compose down (compose) after every run
  Max 3 retries then human handoff
  DoD: valid fix passes; bad fix fails and retries; containers cleaned up

TASK 4.7: Orchestrator + autonomy modes
  Create: orchestrator/ — wire the full pipeline
  Modes: full_auto (no click), approve_each (default, needs click), suggest_only (never auto)
  DoD: acceptance test (spec §18) passes in all three modes

TASK 4.8: Deployment documentation generator
  Create: doc_generator/generator.py — Jinja2 template per spec §22
  Queries: deployments, containers, instances, stage_events, failures, diagnoses,
           remediation_actions, shadow_tests
  Store in deployment_reports table
  API: GET /deployments/{id}/report
  Frontend: DeploymentReport component + download button
  DoD: successful deployment produces downloadable report with all sections

TASK 4.9: Remaining frontend
  Agent Reasoning tab (provider badges), Disclosure Ledger, Shadow Verification panel,
  Autonomy Dial, Deployment Report tab, AWS Setup page
  DoD: all tabs render correctly with real data
```

### Phase 5: Hardening & Demo (Weeks 15–16)

```
TASK 5.1: MERN hardening
  Fix any compose-path issues discovered during integration
  Write CONTRIBUTING.md for future adapter developers

TASK 5.2: Input validation & security
  ZIP-bomb guard: reject >100MB or >10,000 entries
  Validate all API inputs (project names, URLs, file uploads)

TASK 5.3: e2e_demo.sh
  Cover: 5 happy paths (one per stack) + 2 injected-failure paths
  DoD: bash scripts/e2e_demo.sh exits 0

TASK 5.4: Resume metrics collection (spec §19)
  Measure and record all metrics listed in spec §19
```

---

## 6. TESTING REQUIREMENTS

Every test file and what it must cover:

| Test File | Covers | Key Assertions |
|---|---|---|
| `test_detector.py` | Adapter registry, all 5 frameworks + negative + TS Express | MERN detected before React; TS Express → 422; entry-point extraction correct for each |
| `test_dockerfile_gen.py` | Template rendering for all 5 stacks | FastAPI: dynamic module_path; React: Vite→dist, CRA→build; Express: dynamic entry_file; Flask: dynamic wsgi_module; MERN: both client+server |
| `test_ec2_provisioner.py` | §8a algorithm (mocked boto3) | reuse-when-running, restart-when-stopped, create-when-under-cap, hard-fail-at-cap, reconciliation-updates-DB, advisory-lock-serialization |
| `test_port_allocation.py` | Port pool allocation | Range respected, no duplicates, MERN only allocates for client |
| `test_health_check.py` | 3-tier fallback chain | Tier 1 success, Tier 1→2 fallback, Tier 2→3 fallback, all-fail triggers rollback |
| `test_classifier.py` | All 10 regex patterns | Each pattern → correct error_class; unknown → unclassified |
| `test_grammar_validation.py` | All 7+1 actions | Valid params accepted; invalid rejected; SET_ENV_VAR secret filter; SET_START_COMMAND array format; RESTART_SERVICE scope check |
| `test_redactor.py` | Privacy boundary | No secrets in output; only 7 fields present; secret-pattern filter blocks embedded credentials |
| `test_llm_client_factory.py` | Provider-agnostic factory | All 3 providers produce valid client; unknown provider → error; disclosure logged before call |
| `test_shadow_verification.py` | Shadow container lifecycle | Build with --network=none; smoke tests run; cleanup after pass; cleanup after fail; max 3 retries |
| `test_aws_setup.py` | AWS Setup wizard (mocked boto3) | SG creation, key-pair creation, AMI detection, IAM validation failure, VPC detection (with/without default), idempotent re-run |
| `test_doc_generator.py` | Deployment report generation | All sections present; data pulled from correct tables; Markdown renders correctly |

**Test command:** `pytest tests/ -v --tb=short`

---

## 7. COMPLETE REFERENCE: DATABASE SCHEMA

14 tables total. See spec §7 for full SQL. Key facts for quick reference:

| Table | PK | Key FKs | Critical Columns |
|---|---|---|---|
| `users` | id | — | Placeholder only — seed 1 admin row, no login flow |
| `projects` | id | user_id → users | framework: react\|express\|flask\|fastapi\|mern |
| `autonomy_settings` | project_id | project_id → projects (CASCADE) | mode: full_auto\|approve_each\|suggest_only |
| `instances` | id | — | aws_instance_id (UNIQUE), status: pending\|running\|stopped\|terminated |
| `aws_setup_state` | id | — | setup_status: pending\|in_progress\|complete\|failed |
| `deployments` | id | project_id → projects (CASCADE), instance_id → instances (SET NULL) | deployment_type: single_container\|compose; status: building\|deployed\|failed\|rolled_back\|healing |
| `stage_events` | id | deployment_id → deployments (CASCADE) | stage + detail text |
| `containers` | id | deployment_id → deployments (CASCADE) | service_name: app\|client\|server\|mongo; image_tag; host_port (NULL for internal) |
| `metrics` | id | container_id → containers (CASCADE) | cpu_percent, mem_usage_mb, TIMESTAMPTZ |
| `failures` | id | deployment_id → deployments (CASCADE) | raw_error_excerpt (LOCAL ONLY), error_class |
| `diagnoses` | id | failure_id → failures (CASCADE) | model_tier: local\|cloud; cloud_provider; confidence; action_type; params JSONB |
| `disclosures` | id | failure_id → failures (CASCADE) | content_sent; destination: anthropic_api\|glm_api\|nvidia_nim_api |
| `remediation_actions` | id | diagnosis_id → diagnoses (CASCADE), deployment_id → deployments (CASCADE) | status: proposed\|shadow_testing\|awaiting_approval\|promoted\|rejected\|discarded |
| `shadow_tests` | id | remediation_action_id → remediation_actions (CASCADE) | test_name, passed (bool), output |
| `deployment_reports` | id | deployment_id → deployments (CASCADE, UNIQUE) | report_markdown |

---

## 8. COMPLETE REFERENCE: API ENDPOINTS

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | Returns `{"status":"ok"}` |
| `POST` | `/projects` | Multipart file or `{"repo_url"}` → `{"project_id","detected_framework"}` or 422 |
| `POST` | `/projects/{id}/deploy` | Triggers deployment → `{"deployment_id"}` |
| `GET` | `/deployments/{id}` | Includes `app_url` (computed, not stored), `services` array |
| `GET` | `/deployments/{id}/diagnoses` | List with `cloud_provider` field |
| `GET` | `/deployments/{id}/disclosures` | List |
| `GET` | `/deployments/{id}/shadow-tests` | Grouped by `remediation_action_id` |
| `GET` | `/deployments/{id}/metrics` | Query params: `?since=<ISO>&service=<name>` |
| `GET` | `/deployments/{id}/remediation-actions` | Query param: `?status=<status>` |
| `GET` | `/deployments/{id}/report` | Deployment report Markdown or 404 |
| `POST` | `/remediation-actions/{id}/approve` | Promotes to EC2 |
| `POST` | `/remediation-actions/{id}/reject` | Discards |
| `GET` | `/projects/{id}/autonomy` | Returns `{"mode"}` |
| `PUT` | `/projects/{id}/autonomy` | Body: `{"mode"}` |
| `GET` | `/projects` | List all projects |
| `POST` | `/aws/setup` | Body: `{aws_access_key_id, aws_secret_access_key, aws_region, allowed_ssh_cidr}` |
| `GET` | `/aws/setup/status` | Current AWS setup state |
| `POST` | `/aws/teardown` | Deletes SG + key pair (not instances) |
| `WS` | `/ws/deployments/{id}` | Deployment events |
| `WS` | `/ws/aws-setup` | Setup wizard progress |

---

## 9. COMPLETE REFERENCE: WEBSOCKET EVENTS

| Event | Payload |
|---|---|
| `stage_update` | `{stage, detail}` — stages: provisioning, detecting, building, deploying, health_check, live, failed, healing, rolled_back, generating_report |
| `build_log` | `{line, service}` |
| `container_log` | `{line, service}` |
| `metrics` | `{cpu_percent, mem_usage_mb, timestamp, service}` |
| `diagnosis_proposed` | `{action_type, params, confidence, model_tier, cloud_provider, reasoning}` |
| `disclosure_logged` | `{content_sent, destination}` |
| `shadow_test_result` | `{test_name, passed, output}` |
| `awaiting_approval` | `{remediation_action_id}` |
| `remediation_promoted` | `{remediation_action_id}` |
| `remediation_rejected` | `{remediation_action_id}` |
| `deployment_complete` | `{app_url, report_url}` |
| `deployment_failed` | `{reason, rolled_back}` |
| `aws_setup_progress` | `{step, detail}` — steps: validating_iam, detecting_vpc, creating_sg, creating_keypair, detecting_ami, complete, failed |

---

## 10. COMPLETE REFERENCE: ENVIRONMENT VARIABLES

```
# AWS
AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION

# EC2 (auto-populated by setup wizard)
EC2_SECURITY_GROUP_ID, EC2_KEY_PAIR_NAME, EC2_SSH_KEY_PATH
EC2_AMI_ID, EC2_SUBNET_ID, EC2_SSH_USER, EC2_INSTANCE_TYPE
MAX_EC2_INSTANCES

# Platform
DATABASE_URL, PORT_POOL_START, PORT_POOL_END

# Local LLM
OLLAMA_HOST, OLLAMA_MODEL, LOCAL_CONFIDENCE_THRESHOLD

# Cloud LLM
CLOUD_LLM_PROVIDER (nvidia_nim | glm | anthropic)
NVIDIA_NIM_API_KEY, NVIDIA_NIM_BASE_URL, CLOUD_LLM_MODEL_NVIDIA
GLM_API_KEY, GLM_BASE_URL, CLOUD_LLM_MODEL_GLM
ANTHROPIC_API_KEY, CLOUD_LLM_MODEL_ANTHROPIC
```

---

## 11. COMPLETE REFERENCE: REMEDIATION GRAMMAR

7 actions + NONE. LLM output MUST be validated before use.

| Action | Params | Validation Rules |
|---|---|---|
| `ADD_DEPENDENCY` | package, version, manifest, service | package: `^[a-zA-Z0-9_\-\.]+$`; service: "app" default, "client"/"server" for MERN |
| `CHANGE_BASE_IMAGE` | image_tag, service | Allowlist: python:3.12-slim, python:3.11-slim, node:18-slim, node:18, nginx:alpine, mongo:7 |
| `EXPOSE_PORT` | port, service | 1≤port≤65535; compose: only "client" may bind host port |
| `SET_START_COMMAND` | cmd, service | cmd: JSON array of strings; cmd[0]: uvicorn\|gunicorn\|node\|nginx\|python |
| `INCREASE_MEMORY_LIMIT` | mb, service | 128≤mb≤1024 |
| `SET_ENV_VAR` | key, value, service | Reject key: `(?i)(secret\|token\|password\|api[_-]?key)`; reject value: `://[^:]+:[^@]+@`; reject value>500 chars |
| `RESTART_SERVICE` | service | Must be a known service_name for the deployment |
| `NONE` | {} | Escalate or human handoff |

---

## 12. COMPLETE REFERENCE: CLASSIFICATION PATTERNS

| Regex/Condition | error_class | Typical Action |
|---|---|---|
| `ModuleNotFoundError: No module named '(\w+)'` | missing_python_dependency | ADD_DEPENDENCY |
| `Cannot find module '(\S+)'` | missing_node_dependency | ADD_DEPENDENCY |
| `EADDRINUSE` | port_conflict | EXPOSE_PORT |
| `exec format error` / `no matching manifest for` | wrong_base_image_arch | CHANGE_BASE_IMAGE |
| container inspect `OOMKilled: true` | out_of_memory | INCREASE_MEMORY_LIMIT |
| exits within 2s, no matching CMD | missing_or_wrong_start_command | SET_START_COMMAND |
| `KeyError`/`undefined` + env var name | missing_env_var | SET_ENV_VAR |
| `MongoNetworkError` / `ECONNREFUSED .*27017` | db_connection_failed | RESTART_SERVICE or SET_ENV_VAR |
| `npm ERR! code ERR_SOCKET_TIMEOUT` | build_network_error | NONE (transient) |
| no match | unclassified | NONE → escalate |

---

## 13. COMPLETE REFERENCE: ENTRY-POINT DETECTION

### FastAPI → {module_path, app_var}
1. Scan files in order: `main.py`, `app/main.py`, `app.py`, `src/main.py`
2. Find `<var> = FastAPI(`
3. module_path = file path with `/` → `.` and `.py` stripped (e.g., `app/main.py` → `app.main`)
4. Fallback: `app.main:app` + warning

### Express → {entry_file}
1. `package.json` → `scripts.start` → parse filename (e.g., `"node src/index.js"` → `src/index.js`)
2. Else `package.json` → `main` field
3. Fallback: `index.js`

### Flask → {wsgi_module}
1. `Procfile` → parse gunicorn module from `web:` line
2. Scan: `app.py`, `application.py`, `wsgi.py`, `run.py`, `src/app.py` for `Flask(__name__)`
3. Derive module:var (e.g., `app.py` with `app = Flask(...)` → `app:app`)
4. Fallback: `app:app` + warning

### React / MERN client → {build_output_dir}
1. `package.json` → `vite` in deps → `"dist"`
2. `react-scripts` in deps → `"build"`
3. Fallback: `"dist"` (Vite is the modern default)

### MERN server → same as Express, scoped to `server/package.json`

---

## 14. COMPLETE REFERENCE: HEALTH CHECK CHAIN

30s total, 2s poll interval:
```
Tier 1 (0-10s):  GET /health  → any 2xx = healthy
Tier 2 (10-20s): GET /        → any status < 500 = healthy
Tier 3 (20-30s): TCP connect  → any success = healthy
All fail → deployment status = 'failed', rollback triggered
```
MERN: targets client's host_port only.

---

## 15. COMPLETE REFERENCE: AWS SETUP WIZARD (6 steps)

```
Step 1: Validate IAM
  sts:GetCallerIdentity → confirm credentials
  ec2:DescribeInstances → confirm EC2 permissions

Step 2: Detect VPC + Subnet
  ec2:DescribeVpcs → find isDefault=true (or present list)
  ec2:DescribeSubnets → filter MapPublicIpOnLaunch=true → first public subnet

Step 3: Create Security Group
  ec2:CreateSecurityGroup → name: cloudforge-sg-<timestamp>
  ec2:AuthorizeSecurityGroupIngress:
    - SSH (22) from allowed_ssh_cidr (or 0.0.0.0/0 + warning)
    - TCP 8000-8099 from 0.0.0.0/0

Step 4: Create Key Pair
  ec2:CreateKeyPair → name: cloudforge-key-<timestamp>
  Save KeyMaterial to keys/cloudforge-key-<timestamp>.pem
  chmod 600

Step 5: Detect AMI
  ec2:DescribeImages → filters:
    name: ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-*
    owner-alias: amazon
    state: available
    architecture: x86_64
  Sort CreationDate desc → pick latest

Step 6: Persist
  Write to aws_setup_state table → setup_status = 'complete'
```

Config resolution: DB table → .env → fail with error directing to wizard.

---

## 16. COMPLETE REFERENCE: EC2 PROVISIONING ALGORITHM

```
1. ACQUIRE pg_advisory_xact_lock (fixed constant key)
2. RECONCILE: describe_instances(tag:cloudforge-managed=true)
     AWS exists in DB → update status, public_ip
     AWS not in DB → insert
     DB not in AWS → status = 'terminated'
3. REUSE: status='running' → use it → skip to 6
4. RESTART: status='stopped' → ec2:StartInstances → wait running → update DB → skip to 6
5. CREATE: count WHERE status IN ('pending','running','stopped')
     < MAX → ec2:RunInstances (AMI, type, SG, key, subnet, user-data, tags) → wait → insert → use
     >= MAX → FAIL with "instance cap reached"
6. RELEASE lock (auto on commit)
```

---

## 17. COMMON PITFALLS (mistakes the v4 audit identified — avoid these)

1. **Don't count terminated instances against the cap.** Only pending/running/stopped count.
2. **Don't use `TIMESTAMP`.** Always `TIMESTAMPTZ` in PostgreSQL.
3. **Don't forget `ON DELETE CASCADE`** on child FKs. Exception: `projects.user_id` uses `SET NULL`.
4. **Don't put `image_tag` on `deployments`.** It belongs on `containers` (each MERN service has its own).
5. **Don't hardcode `server.js` or `app:app`** as entry points. Use dynamic detection (§13 of this file).
6. **Don't use `npm install` when `package-lock.json` exists.** Use `npm ci --omit=dev`.
7. **Don't assume React builds to `build/`.** Vite → `dist/`, CRA → `build/`. Detect from package.json.
8. **Don't forget the `version` key is deprecated in Docker Compose V2.** Don't include it.
9. **Don't build on the EC2 instance.** Build locally, `docker save`, SSH transfer, `docker load`.
10. **Don't expose MERN's `server` or `mongo` ports externally.** Only `client` gets a host port.
11. **Don't use `docker build` without `--network=none`.** Security boundary.
12. **Don't let `docker build` run indefinitely.** 10-minute timeout.
13. **Don't use user-supplied Dockerfiles.** Always generate from templates.
14. **Don't forget to write the disclosure row BEFORE the cloud API call.** Not after.
15. **Don't strip `/api/` prefix in nginx proxy_pass.** No trailing slash = prefix preserved.
16. **Don't forget to `docker compose down --remove-orphans` before redeploying MERN.**
17. **Don't delete MongoDB volumes during rollback.** `mongo-data` must survive.
18. **Don't parse TypeScript Express projects.** Return 422 with a limitation message.
19. **Don't use shadow container ports statically.** Use `-P` (publish all) and read back allocated port.
20. **Don't retry a failed grammar validation with a "fixed-up" version.** Discard and move on.

---

## 18. CROSS-STACK COMPATIBILITY MATRIX

Before marking any task complete, verify it works for ALL applicable stacks:

| Stage | React | Express | Flask | FastAPI | MERN |
|---|---|---|---|---|---|
| Detection | Vite+CRA | JS (TS→422) | req.txt+pyproject | req.txt+pyproject | client/+server/ |
| Entry-Point | N/A (nginx) | Dynamic pkg.json | Dynamic scan | Dynamic scan | Per sub-project |
| .dockerignore | ✓ | ✓ | ✓ | ✓ | ✓ per service |
| Build Output | dist/ or build/ | N/A | N/A | N/A | client: dist/ or build/ |
| Build Security | --network=none | --network=none | --network=none | --network=none | --network=none |
| Deploy (SSH) | docker run | docker run | docker run | docker run | compose up |
| Health Check | Tier 1→3 | Tier 1→3 | Tier 1→3 | Tier 1→3 | client port only |
| Shadow Verify | GET / | GET / | GET / | GET / | GET / + /api/health |
| Rollback | docker run prev | docker run prev | docker run prev | docker run prev | compose down+up prev |
| Metrics | single | single | single | single | per service |
| Remediation | all 7 actions | all 7 actions | all 7 actions | all 7 actions | all 7 + service targeting |
| Deploy Report | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 19. FINAL ACCEPTANCE TEST CHECKLIST

This is spec §18. Every item must pass before the project is considered complete:

- [ ] `docker compose up -d db backend frontend` succeeds
- [ ] Ollama running, cloud provider key set
- [ ] AWS Setup wizard completes (SG, key pair, AMI, IAM)
- [ ] No EC2 tagged "cloudforge-managed" exists
- [ ] MERN fixture deploys: provisioning → detecting → building → deploying → health_check → live → generating_report
- [ ] app_url serves React client; /api/health reaches Express+Mongo
- [ ] Deployment Report tab shows all sections; Markdown downloadable
- [ ] Second project (Flask) reuses SAME instance
- [ ] Stopped instance detected and restarted on third deploy
- [ ] FastAPI with missing dep: diagnosis → shadow → approve_each click → promoted
- [ ] Repeat in full_auto (no click) and suggest_only (never auto-promotes)
- [ ] `bash scripts/e2e_demo.sh` exits 0
