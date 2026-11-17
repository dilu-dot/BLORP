# Blorp AI Desktop v0.5.6 cloud setup

The public Windows desktop now uses **BLORP** Supabase project `piwcwmspjhtalryzpkez`. Email signup, sign-in, and membership lookup are implemented in the Electron main process. The renderer cannot read access/refresh tokens. Encrypted storage uses Windows DPAPI through Electron `safeStorage`. The only included API key is a public `sb_publishable_` key. Do not place database secrets or Google client secrets in desktop source.

## How to enable Google signup

1. Open **BLORP** Supabase → Authentication → Providers → **Google**.
2. In Google Auth Platform, create a **Web application** OAuth client (not a Desktop application client for Supabase OAuth).
3. Set its authorized Google redirect URI to `https://piwcwmspjhtalryzpkez.supabase.co/auth/v1/callback`.
4. Enter the Google **Client ID and Client Secret only in Supabase**, and enable the Google provider.
5. Supabase Authentication → URL Configuration → Redirect URLs: add exactly `http://127.0.0.1:47856/blorp-auth/callback`. Do not use a public wildcard.
6. Restart the EXE, sign in with Google. Your default browser opens and returns via PKCE code exchange. If port 47856 is occupied, login fails safely.
7. Configure email confirmation redirect/Site URL in Supabase for a usable post-confirmation page; users can return to the app to sign in after confirming.

Google cannot be made active without the project owner's Google OAuth credentials. No OAuth client secret belongs in the public EXE.

## Boundaries
- Cloud holds only Auth identity, plan/expiry, minimal pending UTR and payment audit data.
- Chat and project drafts remain in local Electron storage. Native OS workspace folders are a later deliverable.
- Old Python dev API is not hosted. The local preview UI still has unfinished AI/build and checkout features.
- Your **private** Devo Engine Owner app is **not yet** connected; the customer app always displays role `member`.
- Never put Supabase `service_role` or secret API keys in GitHub or an Electron binary.
