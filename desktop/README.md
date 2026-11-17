# Blorp AI Customer — Windows desktop preview

This **public** Electron desktop build is separate from the private Devo Engine / Blorp Owner app.

- Windows 64-bit portable `.exe` (no Electron/Node installation required to **run**).
- If `http://127.0.0.1:8765/api/health` responds with `{"ok":true}`, it connects to your running local Blorp backend.
- Otherwise it opens the bundled Blorp V5.3 UI as an **offline demo** with a clear warning. Sign-in, cloud sync, AI execution, membership approvals, and payments **do not work offline**.
- You may set `BLORP_SERVER_URL=https://your-production-backend.example` before launching if you have a secure compatible hosted server. Remote HTTP is rejected. **There is no production host bundled yet.**
- The current developer server is localhost-only and **must not** be exposed to the internet. A production SaaS needs hardened authentication, secure deployment, billing controls, privacy review and real AI provider integration.

## Download Windows preview

Open [Build public Blorp AI Windows app](https://github.com/dilu-dot/BLORP/actions/workflows/customer-desktop-windows.yml). Choose a **successful** workflow run. Under **Artifacts**, download `Blorp-AI-Windows-Preview`. Extract the ZIP and open `Blorp AI 0.5.4.exe`.

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

## Google sign-up and sign-in in the Windows app (V0.5.4)

The new **Continue with Google** button is integrated with the native Electron desktop application. Unlike an embedded Google login page, it opens Google's official consent/login flow in the user's **default system browser**, uses authorization-code + PKCE and a temporary `127.0.0.1` loopback callback, and returns an ID token to the existing Blorp backend for **independent signature/audience verification**. The Google access and refresh tokens are never stored in Blorp. Customer Google login and existing-account linking use the same backend authorization checks as before.

### Developer configuration (required before login will work)

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), configure an OAuth consent screen and **create an OAuth client with application type: Desktop app** (not Web application). Note its public Client ID. Configure testing users/consent where required.
2. On your **Blorp development backend**, set `BLORP_GOOGLE_DESKTOP_CLIENT_ID=YOUR_DESKTOP_CLIENT_ID.apps.googleusercontent.com` and restart the server. This ID is not a secret. If browser login is also desired, continue using `BLORP_GOOGLE_CLIENT_ID` for its separate **Web application** client.
3. Install verification dependencies in the backend: `python -m pip install -r requirements-google.txt`.
4. Launch the Windows desktop app with this matching updated server. Click **Sign in → Continue with Google**, choose a Google account in your default browser, and return to Blorp. A new Google identity creates a Free account; an email belonging to an existing password-only account must be explicitly linked through the signed-in account first.

**Not enabled in the public downloadable preview until you configure a compatible backend.** If no backend or Desktop OAuth client ID is configured, the button is visible but disabled with an explanation. There is no production cloud backend yet. Do **not** expose this local development server to the public internet.

For a future Supabase hosted backend, the desktop OAuth flow needs corresponding server-side token verification and a compatible session exchange; configuring Supabase alone does not activate this legacy local backend flow. Before public release add secure server auth, Owner protection, a production redirect/session strategy, and end-to-end tests.
