# V5.3 — Private Owner Console and UPI/UTR purchase workflow

- Rebuilt Owner Console to resemble the approved dark teal / burnt-orange glassmorphism design.
- Added owner-only QR image upload, UPI ID and exact INR price configuration (not seeded with real amounts).
- Added customer QR payment preview, payer name and UTR submission with duplicate-reference rejection.
- Added manual owner approval dialog requiring independently verified UTR, rupee amount and recorded confirmation note.
- Added revenue and membership statistics derived from local database records; no invented production figures.
- Preserved V5.2 Google sign-in integration and the server-side Build Fast membership gate.
- Still a **local development prototype**, not a public production merchant system.

# V5.2 — Owner-approved memberships and Google account integration

- Build Fast locked for Free and expired members (UI + server-side build API checks).
- Owner-only membership management, pending payment requests, audit trail, and 30/365-day expiration logic.
- Google Identity Services signup/signin and explicit password-account linking, when OAuth client ID and optional verification dependencies are configured.
- Manual payment requests and optional external HTTPS checkout link; **no direct card charging or automatic transaction verification**.
- Original V5.1 Multi Task, Workflows, Local AI Lab, and add-ons preserved.
- Python 3.10+ localhost development app, **not production ready**.

# Blorp V5.1 — Local AI Agents (Phase 2 MVP)

**Delivered:** local Ollama integration, a real chat request path, a sequential three-role static website generator, account-scoped generated ZIP downloads, and matching Local AI Lab screens. No real model weight files are bundled or downloaded.

**Key changes from V5:**
- New Build Fast → **Local AI Lab** with Local Chat / Build Website tabs.
- `local_runtime.py` uses Ollama's local `/api/tags` and `/api/chat` endpoints.
- Architect → Builder → QA Review generates self-contained HTML/CSS/JS files and ZIPs, but never executes generated code.
- Local model discovery excludes hosted `:cloud` model names.
- Security limits on input, generated paths, response sizes and network-dependent content.
- `README.md`, `docs/LOCAL_AI.md` and `docs/SECURITY.md` updated for Windows setup and limitations.
- Offline HTML design preview now matches the V5.1 UI, including the Local AI Lab.

**Verification:** Python API and local-agent tests passed using a fake Ollama endpoint; visual navigation checks passed at 1512px and 390px without JavaScript exceptions or horizontal overflow. The user still needs to install Ollama, pull a model and confirm real inference on their own hardware.

**Not yet shipped:** proprietary Blorp model weights; autonomous terminal agent execution; real browser testing of generated websites; separate Git worktrees; real plugin connections; payment processing; multi-user production security; true Blorp credits billing. Existing features from prior phases remain preview/planning UI where relevant.
