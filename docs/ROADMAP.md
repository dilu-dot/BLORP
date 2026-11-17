# Blorp — Engineering Roadmap (Updated V5)

## Product contract

Keep the **original features** while improving visual clarity. Build Fast must remain distinct from ordinary AI Playground. The visible Build Playground is **chat-first**; project setup, model selection and build output open through focused controls. Preserve coffee-brown, deep teal, seafoam, warm cream, burnt-orange and adaptive glassmorphism. All modes must work at desktop/tablet/mobile widths.

## Phase 1 — Local foundation (delivered)

- [x] Preserve agent CRUD, workflow drafts, Build Playground and original pages from V4.1.
- [x] Add member Dashboard, Project Library, Add-ons/Skills, Membership and cleaner AI chat.
- [x] Local SQLite signup, signin, session cookie and 4M starter-credit allocation.
- [x] Manual signed-in project backup/restore API; strict refusal of missing runtime and checkout.
- [x] Build modular frontend assets; provide Windows launch and test scripts.
- [x] Frontend responsive testing and API tests.
- [ ] Production accounts, real model inference, actual plugin connections, payment collection, hosted deployment: **not included**.

## Phase 2 — Real account & entitlement backend

1. Confirm the exact FreeLLM upstream GitHub repository, license, routes, provider implementations and intended deployment.
2. Replace local auth with production-grade HTTPS, verified email, recovery, anti-abuse, per-user isolated projects, persistent database and secure secrets vault. Add roles and audit logs.
3. Define the **credit unit** and economic model before billing. Current 4M is a non-redeemable starter display balance.
4. Integrate a billing processor (subject to merchant availability) with **server-verified webhooks**, an immutable ledger, refunds/cancellations, and testable entitlement checks.
5. Proposed USD plans: Free, $20 Builder, $50 Studio; annual 10% discount = $216/$540 paid annually. Builder may reset a rolling token allowance every five hours; exact limits require real cost benchmarking. Studio must have transparent fair-use and anti-abuse limits, not economically impossible infinite compute.

## Phase 3 — Inference & Blorp V1–V5

- Start as routing **profiles** on commercially usable hosted/open models. Do not label them as independently trained models.
- Provider adapters: normalized completions/streaming, retries, timeouts, provider failover, model capability catalog, per-model usage accounting, and user-visible latency/cost estimates.
- Evaluation harness: real website builds, unit tests, frontend accessibility and visual QA, security tests, benchmark traces, model comparisons.
- Work toward a specialized Blorp coding model by fine-tuning legally usable open-weight weights (LoRA/QLoRA) on licensed, high-quality coding/test/tool-use corpora. Assess actual model quality and GPU/inference cost.
- Training a frontier model from scratch is a longer-term research effort requiring far greater funding, team size and compute.

## Phase 4 — Real Build Fast orchestration

- One user prompt creates a project spec, visible plan, cost estimate, and gated agent tasks.
- Planner/router creates tasks for Research, Design, Frontend, Backend and QA, with explicit dependencies and a task-activity timeline.
- Each coding agent runs **in an isolated Git worktree and sandbox**, with restricted network/file permissions and build budgets. No untrusted code on the main application server.
- GitHub integration supports branches, PRs, conflict checks, reproducible tests and human-approved merges. Save checkpoints/rollback.
- Secure project preview and visual editing. The user can click a rendered element and request a scoped change.
- Autopilot is not a permission bypass: approvals required for deploy, destructive file operations, billable purchases, secret access and third-party writes.

## Phase 5 — True Add-ons marketplace and skills

- Marketplace listings for GitHub, Figma, Vercel, Supabase, Notion, Google Drive, supported browser/test tooling and custom MCP.
- OAuth or approved service-specific connection workflow; tokens held in an encrypted server vault. Never accept production API keys in generic browser localStorage.
- Per-user/per-project grants, agent scope allowlists, capability discovery, explicit approval for write operations, revocation, install/uninstall, and event logs.
- Reusable agent skills with versioning, reviews, prompt injection mitigation, dependency scanning and safe rollout.
- Browsing, provider checks and deployment all report actual status, never demo indicators as if live.

## Phase 6 — Teams, production & desktop

- Invitations, owner/editor/viewer permissions, collaborative comments, project organization and retention controls.
- Public web deployment with HTTPS, database backups, monitoring, incident response, abuse controls and observability.
- Future desktop wrapper only if needed; signed packages and straightforward Windows security compatibility.

## Acceptance criteria before declaring 'ready for customers'

Real build produces a runnable repository; agent artifacts/tests are verifiable; checkout and plan expiry are server-enforced; every tool call is user-scoped and auditable; project data is private per account; billing never relies on local UI toggles; accessibility and responsive checks pass; Windows installs do not require disabling protection; and legal/licensing review is complete.
