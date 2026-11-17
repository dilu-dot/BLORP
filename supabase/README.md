# Blorp Cloud V5.5 — Supabase Backend

Backend source for **cloud accounts and subscriptions only**. Works with Supabase Auth email/Google, PostgreSQL RLS and a single JWT-protected Edge Function. Customer chat history, code and attachments are explicitly **not stored here**; they belong to the user's local PC storage.

Deployed to dedicated BLORP Supabase project **`piwcwmspjhtalryzpkez`** (Singapore) on November 17, 2026. All six application tables and the JWT-protected `blorp-membership` Edge Function were created and verified via management API and database RLS/grant checks. This does **not** mean the existing desktop EXEs are connected to Supabase: client integration and actual end-to-end login testing remain outstanding.

Start with [Deployment instructions](DEPLOY.md). Never copy this backend into your public V5.3 Python development server and expose it to the internet. Update both desktop clients to Supabase Auth before claiming cloud login is operational.