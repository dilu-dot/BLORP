# BLORP V5.3 — Private Owner Console & UPI / UTR payments (local prototype)

This is the next iteration of the Blorp project. It builds on **the existing V5 foundation and original V4.1 frontend**, preserving Multi Task, Build Playground, Workflows, AI Playground, Model Explorer, Projects, account dashboard, membership UI and Add-ons. It adds **Local AI Lab**, a real integration with an Ollama model running on the *same computer*.

> **Scope:** Local learning/development software. Not a production website-building SaaS, not a trained Blorp V1–V5 model, not a Hermes/Codex replacement, and not a public deployment.


## New in V5.3 — Owner Control Center

- Premium, responsive teal/orange **Owner Console** with real local account counts, pending UTR reviews, verified INR revenue charts and membership distribution.
- Owner-only **UPI & Pricing** configuration: upload your actual QR image (PNG/JPEG), set your UPI ID and the exact INR prices for Builder/Studio monthly and annual plans. **Nothing is preconfigured** and no secret payment details are committed.
- The **Membership** page shows that QR and amount, collects a payer name and transaction UTR, and submits a pending request. A UTR alone never unlocks Build Fast.
- The Owner must independently check the transaction and enter the exact UTR, INR amount, verification statement and note before approving. Duplicate UTR submissions and repeated approvals are blocked; membership changes remain audited.
- No automatic UPI validation or recurring billing. This is still a localhost prototype, not a public merchant service.

**Full instructions:** [docs/UPI_OWNER.md](docs/UPI_OWNER.md). After your own owner account is created, use `py -3 manage_owner.py your-account@example.com` locally with the server stopped. **Do not upload the local `data/` folder.**

## New in V5.2 — Accounts and paid-access foundation

- Google sign-in / sign-up integration using **Google Identity Services** (only enabled after owner configures a Google OAuth web client ID and installs optional dependencies).
- **Build Fast** UI lock plus **server-side denial** of agent build/run endpoints for Free accounts. The owner role may access local build tests.
- Private **Manage → Owner Console**, protected by a server-side role check. Owner can approve/reject membership requests, set/revoke plans, and inspect access audit entries.
- **Payment requests**, not automatic card collection: owner-configured UPI QR and user-submitted UTR. Owner must independently verify payment before activating a membership. Monthly access lasts 30 days; annual 365 days.
- Existing `data/` stays local; migrations preserve earlier accounts and projects. Starter credits remain unmetered demo credits. **Do not host this development server publicly.**

**Owner setup:** Sign up normally, stop the local server, run `py -3 manage_owner.py your-email@example.com`, restart and sign in. Full setup, payment limitations, and Google instructions: [docs/AUTH_BILLING.md](docs/AUTH_BILLING.md).

> This is **not** a production checkout or automatically verified UPI service. You cannot charge customers or authenticate with Google until you configure actual merchant links and Google credentials. The requested subscriptions can be activated manually by an authorized owner after verifying payment externally. Full hosted agent execution remains unimplemented.

## Quick start (Windows)

**Requirements:** Windows 10/11, Python 3.10+, [Ollama for Windows](https://ollama.com/download/windows), enough free disk/RAM for your chosen model. Python server itself uses no pip/npm dependencies.

1. Extract this ZIP to a folder such as `Documents\BlorpV5.1`.
2. Install Ollama from its official Windows download page, and launch the Ollama application.
3. Open **PowerShell** and download a small coding model:

   ```powershell
   ollama pull qwen2.5-coder:3b
   ollama list
   ```

   This particular model download is approximately **1.9 GB**. It can still be slow on some machines; the 1.5B variant is smaller. You can pick any compatible model shown by Blorp.
4. Double-click `START_BLORP_WINDOWS.bat` in the extracted Blorp folder. Or run from PowerShell:

   ```powershell
   py -3 server.py
   ```

5. Open the `http://127.0.0.1:...` address printed by the server in Edge or Chrome. (Default port is 8765, but it may choose another free port.)
6. Create a **local Blorp account** with Sign up. This is a localhost-only account; use a **unique test password**.
7. For Free users, Build Fast is now **locked**. To test local agent generation, configure your owner account as described above or grant Builder/Studio through the Owner Console. In the left sidebar, choose **Build Fast → Local AI Lab**, click **Detect Ollama**, select the installed model and try **Local Chat**.
8. Switch to **Build Website**, enter a website brief, and click **Run three agents**. When it finishes, select **Download generated website ZIP** to inspect the output files.

Ollama is a separate program that runs on your own PC; Blorp does not install it, download models automatically, or connect to a remote LLM provider. The local server calls Ollama at `127.0.0.1:11434` (configurable using `BLORP_OLLAMA_PORT`). On Windows, Ollama usually runs as a background app.

## What's genuinely functional

- **Local Chat:** Sends your text to the selected installed Ollama model, then displays the actual model response and basic token counters. Includes short conversation history.
- **3-role sequential agent pipeline:** Architect drafts a plan → Builder generates `index.html`, `styles.css`, and `script.js` → QA Reviewer reports potential problems. **This is one underlying model prompted to perform three roles**, not three separately trained models or concurrent processes.
- **Download generated website:** Blorp packages the three static website files plus `BLORP_REVIEW.txt` as a ZIP, stored under the local data folder and accessible only to the locally signed-in account that generated it.
- **Preserved interface:** Original agent manager, workflow drafts, chat-first Build Playground, account dashboard, Add-ons and membership previews.
- **Local account storage:** SQLite sign-in, sign-out, manual project backup/restore and 4 million *non-spendable demo credits* for newly created accounts.
- **Security-conscious limits:** Generated code is never executed, a narrow allowlist controls generated filenames, arbitrary Python/shell commands are not run, and original unsafe execution and billing endpoints remain disabled.

**No real desktop automation:** The agents do **not** open VS Code, run builds, test websites in a browser, commit code, deploy to Vercel, or operate Git worktrees. The model's QA review is a text-only review, not an actual test run. Code generated by AI can still be faulty or unsafe; inspect before running or publishing it.

## Choosing a model

| Model suggestion | Approx. Ollama download | Use |
|---|---:|---|
| `qwen2.5-coder:1.5b` | 986 MB | Older/lower-memory PCs, lower quality |
| `qwen2.5-coder:3b` | 1.9 GB | Good first test for Windows |
| `qwen2.5-coder:7b` | 4.7 GB | Better quality if you have enough RAM/VRAM |

Actual RAM/VRAM needs are higher than download sizes and depend on context, quantization and device. Large or long generated responses can fail on smaller models; retry with a shorter, static website brief or a stronger model. Ollama also has cloud offerings, but **Blorp V5.1 explicitly filters `:cloud` models** because this release is designed for local, no-paid-API use.

## Folder map

```text
START_BLORP_WINDOWS.bat      Windows local launcher
server.py                    Local HTTP, SQLite users/projects and Ollama API endpoints
local_runtime.py             Local model calls, agent prompts and static ZIP generation
public/index.html            Blorp app HTML
public/assets/base.*         Original Blorp V4.1 features
public/assets/v5.*           V5 account, plan, add-on, chat UI
public/assets/v51.*          Local AI Lab UI
public/assets/v52.*          Google sign-in and Build Fast gate
public/assets/v53.*          Owner dashboard and UPI/UTR flow
blorp-v5.1-ui-preview.html   Offline design preview (cannot run AI)
build_frontend.py            Rebuilds foundation and reapplies local agent UI patch
patch_frontend.py            Re-adds V5.1 HTML/CSS/JS asset references
legacy-source-v41.html       Prior source preserved for reference
docs/LOCAL_AI.md             Setup, troubleshooting and API reference
docs/UPI_OWNER.md            Owner QR and manual UTR verification guide
docs/SECURITY.md             Current guardrails and known limitations
docs/ROADMAP.md              Longer-term development plan
tests/                       Automated API, agent and browser tests
```

## Testing

`build_frontend.py` and `patch_frontend.py` are legacy V5.1 regeneration scripts; do not run them to regenerate V5.3 until they are updated to preserve the new UI.

```powershell
py -3 tests\test_api.py
py -3 tests\test_local_agents.py
py -3 tests\test_memberships.py
```

The local-agent test **mocks Ollama**; it verifies Blorp's request/response flow, authentication, agent sequencing, ZIP download and rejection of unsafe file paths without contacting real models. The optional UI test uses Playwright and Chromium; Playwright is not required to run Blorp.

## Important limitations

1. **Local inference is not cloud-grade:** Quality and speed depend on your installed model, hardware and prompt.
2. **Not trained proprietary models:** Blorp V1–V5 remain planned routing profiles. V5.1 uses a named open-weight Ollama model, with its own license.
3. **Not a secure shared service:** Only use on your own computer. No public hosting, automatically verified billing, publicly deployed OAuth flow, external add-on access or managed worker sandbox exists yet.
4. **Static website only:** Generated ZIPs are restricted to `index.html`, `styles.css`, `script.js`, optionally `README.md`. This deliberately excludes full-stack code, package installation and execution.
5. **Credits don't bill:** Your 4 million starter credits remain a demo allocation; local inference does not deduct credits.
6. **Existing browser drafts:** Earlier V4.1 draft persistence may remain in browser local storage and is not isolated between local accounts in the same browser. Use only test content.

For precise safety constraints, read `docs/SECURITY.md`. The project has no requirement to disable Windows Defender or antivirus software.
