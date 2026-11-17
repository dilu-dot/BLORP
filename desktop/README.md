# Blorp AI Customer – v0.5.6 Supabase Cloud Preview

Public Windows desktop is separate from private Devo Engine.

- Email login / signup uses the Supabase Auth project `piwcwmspjhtalryzpkez`.
- Cloud membership status comes from the server-verified `blorp-membership` Edge Function. Client never has Owner privileges.
- Electron encrypted session storage uses OS `safeStorage`; tokens never go to the web UI.
- The Google desktop option uses Supabase OAuth in the system browser, requires the Supabase Google provider to be configured, and an allowed redirect URL.
- Existing chat/project drafts are stored locally in Electron app data; cloud authentication does not upload them.
- Website building, AI runtime, payments, and Owner dashboard integration are not ready. This is a preview.

See [CLOUD_SETUP.md](CLOUD_SETUP.md) for Google setup.

## Build

```powershell
npm install
npm run desktop:check
python desktop/generate_icon.py
npm run desktop:build
```

The GitHub Actions workflow builds a portable unsigned Windows EXE and publishes a public *preview* release.
