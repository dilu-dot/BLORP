# Blorp AI Customer — Windows desktop preview

This **public** Electron desktop build is separate from the private Devo Engine / Blorp Owner app.

- Windows 64-bit portable `.exe` (no Electron/Node installation required to **run**).
- If `http://127.0.0.1:8765/api/health` responds with `{"ok":true}`, it connects to your running local Blorp backend.
- Otherwise it opens the bundled Blorp V5.3 UI as an **offline demo** with a clear warning. Sign-in, cloud sync, AI execution, membership approvals, and payments **do not work offline**.
- You may set `BLORP_SERVER_URL=https://your-production-backend.example` before launching if you have a secure compatible hosted server. Remote HTTP is rejected. **There is no production host bundled yet.**
- The current developer server is localhost-only and **must not** be exposed to the internet. A production SaaS needs hardened authentication, secure deployment, billing controls, privacy review and real AI provider integration.

## Download Windows preview

Open [Build public Blorp AI Windows app](https://github.com/dilu-dot/BLORP/actions/workflows/customer-desktop-windows.yml). Choose a **successful** workflow run. Under **Artifacts**, download `Blorp-AI-Windows-Preview`. Extract the ZIP and open `Blorp AI 0.5.3.exe`.

GitHub Actions artifacts expire after 90 days and may require a signed-in GitHub account to download. A proper public release should use GitHub Releases after production backend setup and final security testing.

## Build locally (Windows)

From repository root with Node.js LTS installed:

```powershell
npm install
npm run desktop:check
python desktop/generate_icon.py
npm run desktop:build
```

Result in `dist/`. Executable is currently unsigned. Never bypass security software or distribute it as a production billing tool.

## Privacy & separation

The customer EXE includes only public customer UI assets and the Electron shell. No owner credentials, production secrets, SQLite DB, or code from the private Owner desktop repository is included. The V5.3 public web source still contains legacy owner-role UI; all protected owner API access must be enforced server-side and is not granted by installing the customer EXE.
