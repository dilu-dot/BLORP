# Blorp V5.5 Cloud Backend (Supabase Free)

**Scope**: one **new** dedicated Supabase project for Blorp; *never deploy over `teddy-private`*. The cloud holds **identity, current membership and minimal UTR/payment audit data only**. Chats, model prompts, generated websites, attachments and project files must remain on each user's OS drive. There is **no cloud AI inference** or shared website-building runtime in this package.

## Provision and deploy

1. Use your **new Supabase project** named `BLORP` in your selected organization/region. Select a $0 free project if offered and decline upgrades if you want to remain on the free tier.
2. Run the SQL in `supabase/migrations/20261117120000_blorp_membership.sql` **once** in the new project's SQL Editor, or apply it through the Supabase migration tool. Make sure it is the Blorp project ID, not a personal project.
3. Deploy `supabase/functions/blorp-membership/index.ts` as Edge Function **`blorp-membership`**, with JWT verification **ON**. The checked-in `supabase/config.toml` sets `verify_jwt = true`.
4. Configure Supabase Auth email/password in Authentication settings. Configure **Google** under Authentication → Providers → Google (requires your Google Cloud OAuth client credentials, including the consent screen; an OAuth client ID cannot be invented). Add only supported callback/redirect origins. For Electron, a proper system-browser PKCE flow and secure callback handoff must be integrated; the old local Desktop OAuth endpoint is not automatically compatible with this backend.
5. Register yourself via Supabase Auth. After confirming your email, open **SQL Editor as project administrator**, get your Supabase Auth UUID from Authentication → Users and run:

   ```sql
   insert into public.blorp_owner_accounts(user_id)
   values ('YOUR_ACTUAL_SUPABASE_AUTH_UUID')
   on conflict (user_id) do nothing;
   ```

   **No default Owner account exists.** The Owner grant cannot be created from a desktop app.
6. Set Owner-configured real INR prices with `owner-set-price`, and UPI ID + HTTPS QR image URL with `owner-set-upi`. No amount, QR, UPI ID or payment data is preconfigured. A **UTR is not payment proof**: verify the actual transfer and amount in your bank/UPI app before approval.
7. In Blorp/Devo client builds, use the project's **URL** and **publishable key**; never embed the service-role/secret key. Call `https://PROJECT_REF.supabase.co/functions/v1/blorp-membership` with `Authorization: Bearer <SUPABASE_USER_ACCESS_TOKEN>`, `apikey: <SUPABASE_PUBLISHABLE_KEY>`, `Content-Type: application/json`, and `{"action":"me"}`. Sign up/sign in through Supabase Auth SDK first.

The current Windows `.exe` releases still use the localhost V5.3/V5.4 backend and **do not automatically connect to this new backend**. We must update and rebuild both customer and private Owner clients before their production accounts and payments can work from different PCs.

## API actions (authenticated user JWT required)

| Action | Role | Body fields | Result |
|---|---|---|---|
| `me` | Customer | none | Current effective plan/expiry, own payment requests, prices, UPI instructions |
| `submit-payment` | Customer | `plan`, `term`, `utr`, optional `payer_name` | Pending request; **never** unlocks membership |
| `owner-dashboard` | Owner | none | Recent customers/UTRs and verification/audit queue |
| `owner-approve` | Owner | `request_id`, `verified_utr`, `verified_amount_inr_paise`, `statement_confirmed:true`, `note` | Atomic status change, membership extension and immutable audit row |
| `owner-reject` | Owner | `request_id`, `note` | Atomic rejection and audit entry |
| `owner-set-price` | Owner | `code`, `amount_inr_paise` or null | Set exact real price |
| `owner-set-upi` | Owner | `upi_id`, `qr_image_url` | Publish payment instructions |

**Amount uses integer INR paise** (₹100 = `10000`), never floating-point rupees. Prices are intentionally `NULL` until you configure them. A duplicate UTR is rejected. Only a bank-verified Owner action can extend a plan. Expiry auto-falls back to Free.

## Security and operational limits

- All six public tables have RLS ON. Customers can read *only their own* memberships/payment requests and published prices/instructions. No public/client writes. Owner accounts and audit are unreadable to clients.
- Only the server-side function holds the privileged Supabase service-role/secret key via platform-provided environment variables; the Owner desktop app uses only its logged-in Supabase user token.
- The SQL approval function uses row locks to stop double approval. Only the server role can invoke it; the user caller must already be present in the operator-controlled Owner list.
- The Edge Function enforces session checks and basic payment request throttling. Before accepting real money, add account abuse protection, verified payment procedures, recovery mechanisms, audit reviews, backups and proper compliance/privacy disclosures.
- Free tier can pause or limit projects depending on provider policy. Avoid committing customer data or secrets to GitHub. Authentication emails may be rate-limited on the free/default SMTP tier.
- Do not host the old Python `server.py` as a public service. It is localhost-only and does not use this cloud schema.

## Test with a new project

1. Without a valid Supabase JWT, calling `blorp-membership` returns HTTP 401.
2. With an authenticated customer, `me` returns Free and no payment requests. Database read as `authenticated` returns own memberships only.
3. As that customer, call an Owner action: 403. Try direct table `UPDATE`: denied by database grants/RLS.
4. Configure UPI and prices **as Owner**; submit a test pending UTR. Confirm it does not unlock Build Fast.
5. As Owner, deliberately supply a wrong UTR/amount: approval rejected; supply correct values **after independently verifying a real transfer**: one approval. Repeating it fails and expiry increases only once.
6. Review security advisors and confirm no missing RLS/table grants. Run tests after modifying the schema.

## Deployed environment (November 17, 2026)

- Supabase project ref: `piwcwmspjhtalryzpkez` (Singapore, `ap-southeast-1`).
- API project URL: `https://piwcwmspjhtalryzpkez.supabase.co`.
- JWT-protected membership Edge Function: `https://piwcwmspjhtalryzpkez.supabase.co/functions/v1/blorp-membership`; status `ACTIVE`.
- PostgreSQL migration `blorp_v55_membership_foundation` applied successfully; six `blorp_*` tables have RLS enabled.
- Initial setup: four price slots have NULL amounts; UPI ID and QR are blank. No cloud Owner account is granted yet. The local Owner login is NOT automatically a Supabase Auth account.
- Management API and SQL permissions confirmed. An actual authenticated runtime/client request could not yet be tested from this session, and the Windows customer/Owner apps still use legacy localhost sessions.
- Two INFO security-advisor notices for Owner-only/audit tables with RLS and no SELECT policies are intentional: clients have no SELECT privileges to those tables.
- Never deploy this schema into `teddy-private`.