# Blorp V5.2 — Google sign-in, owner access, and subscription requests

> **LOCAL DEV ONLY.** These features are a development foundation. They do not process card payments and must not be deployed as a public SaaS authentication/billing service.

## What's implemented

- Email/password signup and signin (existing). Google login uses **Google Identity Services** and server-side `google-auth` verification when configured.
- New accounts get the **Free** plan and 4,000,000 **demo** credits.
- API access rules: `/api/local/agents/build` and `/api/agents/run` require a valid Builder/Studio membership (or owner role). General local `/api/local/chat` does not require a paid plan. The legacy external agent endpoint still returns HTTP 503 to paid users because a secure hosted execution system does not exist yet.
- Build Fast navigation and tools are gated in the UI, but **server-side API checks are the security boundary**.
- Users create a manual or hosted-checkout-link **payment request**. Requests start as `pending`; **a request or a checkout link never activates paid access**. A real owner verifies the transaction *outside Blorp* and approves it in the Owner Console. Owner can also directly grant/revoke plans with an audit log.
- Membership expires after **30 days** (monthly) or **365 days** (annual). For renewals of the same active plan, remaining time is preserved. Price list: Free $0, Builder $20/month or $216/year, Studio $50/month or $540/year.

## Google authentication setup

1. Create a **Google Cloud OAuth client ID** for a Web application via [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Configure the **Authorized JavaScript origin** to match your local Blorp address, typically `http://127.0.0.1:8765` (and optionally `http://localhost:8765`).
2. Install the optional verification dependencies:

   ```powershell
   py -3 -m pip install -r requirements-google.txt
   ```

3. In PowerShell, set the client ID **for this server process** (a public OAuth client ID; never a client secret):

   ```powershell
   $env:BLORP_GOOGLE_CLIENT_ID='YOUR_WEB_CLIENT_ID.apps.googleusercontent.com'
   py -3 server.py
   ```

4. Sign in or sign up via Google's actual button. The backend verifies ID-token signature, audience, issuer, expiry, email status, and unique `sub` through Google's official library.
5. **Existing email/password accounts do not automatically merge with Google**. Sign in with your password first, open Dashboard → Connect Google, and choose the same Google account. This avoids silent account takeovers via matching email addresses.

**Google sign-in is not functional until you supply your OAuth client ID and install dependencies.** It cannot operate from `file://` offline preview. Do not use fake/unverified Google tokens in production.

## Make yourself the owner

1. Start the local server, **create a normal account** with your email, then stop Blorp.
2. With the server stopped, run in the extracted Blorp source folder:

   ```powershell
   py -3 manage_owner.py your-account@example.com
   ```

3. Start Blorp, sign in, and open **Manage → Owner Console**.

This command edits your **local SQLite database** and is intentionally not available as a web endpoint. Do not commit your `data/` folder. Never make an arbitrary user owner based on an unverified email or a browser-only role flag.

## Payment methods

At the moment, Blorp supports **manual payment requests** and optional **owner-configured external HTTPS checkout links**. Both require an owner to verify funds and approve. **No money is charged directly by Blorp.** Do not ask users to type card numbers, CVVs or bank passwords into Blorp.

Option A: Set public transfer instructions in the server environment (shown after a customer requests manual payment):

```powershell
$env:BLORP_PAYMENT_INSTRUCTIONS='Contact the Blorp owner for payment details. Include your request ID as reference.'
py -3 server.py
```

Option B: Configure a provider-hosted checkout link (which you must obtain using your own merchant account and customize for the correct plan/amount):

```powershell
$env:BLORP_CHECKOUT_URL_BUILDER_MONTHLY='https://your-approved-payment-provider.example/checkout/...'
py -3 server.py
```

Supported environment variables: `BLORP_CHECKOUT_URL_BUILDER_MONTHLY`, `BLORP_CHECKOUT_URL_BUILDER_ANNUAL`, `BLORP_CHECKOUT_URL_STUDIO_MONTHLY`, and `BLORP_CHECKOUT_URL_STUDIO_ANNUAL`. Only `https://` links are exposed; **links alone are not webhook-verified, recurring, or fraud-proof**.

### Before real online payments

- Pick a payment provider available to your business and jurisdiction, complete merchant KYC, and verify USD international payment support.
- Integrate provider-created checkout sessions **server-side**, validate **signed webhooks** and amounts/currencies, and activate subscriptions only from verified, idempotent payment events (or independently verified manual records).
- Implement real automatic renewal, cancellations, refunds, proration, chargebacks, invoices/tax, entitlement revocation and dunning. Secure production hosting (HTTPS), managed secrets, rate limits, MFA for owner, CSRF, monitoring, backups, migration tooling, provider license/compliance review, and robust account recovery.
- In India, Stripe is currently invite-only for new accounts. Do not assume any particular provider is usable without merchant approval. Check provider documentation for current availability.

## Test

```powershell
py -3 tests\test_api.py
py -3 tests\test_memberships.py
py -3 tests\test_local_agents.py
```

Membership tests simulate owner **authorization** and workflow; Google requires real OAuth credentials to conduct a genuine end-to-end test. No actual money or Google user identity is involved in these tests.
