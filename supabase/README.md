# Blorp Cloud V5.5 — Supabase Backend

Backend source for **cloud accounts and subscriptions only**. Works with Supabase Auth email/Google, PostgreSQL RLS and a single JWT-protected Edge Function. Customer chat history, code and attachments are explicitly **not stored here**; they belong to the user's local PC storage.

Deploy only into the user-created **BLORP** Supabase project. Existing unrelated Supabase projects are not deployment targets. Supabase connector access is not yet showing BLORP, so the backend has not been deployed.

Start with [Deployment instructions](docs/DEPLOY.md). Never copy this backend into your public V5.3 Python development server and expose it to the internet. Update both desktop clients to Supabase Auth before claiming cloud login is operational.