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
