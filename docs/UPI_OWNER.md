# Blorp V5.3 — Private Owner Console, QR Payments & UTR Approval

> **LOCAL DEV ONLY.** This version is designed for development on your own computer. Do **not** expose this Python server or SQLite database to the internet or use it to operate a real public paid service without a production security, privacy, and compliance review.

## Owner-only access

1. Start Blorp (`START_BLORP_WINDOWS.bat` or `py -3 server.py`) and sign up for the account that will be the owner.
2. Stop the server, then run `py -3 manage_owner.py your-registered-email@example.com` in the project directory.
3. Restart the server, sign in, and click **Manage → Owner Console**. Normal accounts cannot see its navigation link; all Owner API endpoints also check the authenticated server-side `owner` role. Knowing the page address or modifying HTML does not grant payment approval rights.
4. Keep this owner account private and use a unique password. **Before public hosting**, use verified identity, phishing-resistant MFA, HTTPS, CSRF protection, account recovery, monitoring, backups, and separate roles. The existing CLI bootstrap is for development only.

## Set up your own UPI QR

Open **Owner Console → UPI & Pricing**. Supply:
- Your real UPI ID (for display to the buyer)
- Your own QR image in PNG or JPEG format (up to **350 KB**)
- Four exact rupee amounts: Builder monthly, Builder annual, Studio monthly and Studio annual

Press **Save payment settings**. QR bytes are stored in the local SQLite database under `data/blorp.sqlite3`, not in the public GitHub repository. No QR or INR price is preconfigured in the release.

Blorp's subscription list prices remain **$20/month, $216/year, $50/month, $540/year**. The owner enters the actual INR collection amounts manually, so Blorp does not invent a currency exchange rate. Verify the amounts and scan your QR in an independent UPI app before showing it to customers. An annual plan represents 365 days and a monthly plan 30 days in this local implementation.

## Customer payment journey

1. Customer signs in and opens **Membership**.
2. Customer selects Builder or Studio, then Monthly or Annual.
3. Clicking **Subscribe / Request membership** creates an authenticated, server-issued checkout attempt (`POST /api/billing/attempt`). The server returns a 5-minute deadline, exact INR price, UPI ID, and its reference QR route. The timer remains authoritative on the Python server even if the page is reloaded, the clock is changed, or JavaScript is edited.
4. Customer sees your uploaded QR, UPI ID and exact INR amount. If the owner hasn't configured a QR and price, the attempt cannot start. **Verify the QR's payee and amount independently before collecting real funds.**
5. Customer pays using their own UPI app, then submits their **payer name** and **UTR / transaction reference** (8–35 uppercase letters/digits/hyphens) with the attempt ID to `POST /api/billing/request` **before the 5-minute deadline**. The request starts as `pending` and does not unlock Build Fast.
6. Expired or previously submitted attempts cannot be reused. Reopening the same still-active plan returns the existing attempt instead of restarting the countdown. Other accounts cannot submit someone else's attempt. Duplicate UTR references remain rejected globally by a SQLite unique index.
7. If the deadline expires **after money was sent**, the customer should not pay twice; contact the owner for review/support. The timer is a deadline to submit the UTR, not proof a transfer completed.

## Owner decision journey

Open **Owner Console → Payments** or the pending card in Overview. **Never rely on the UTR field or screenshot alone.** Open your actual bank/UPI merchant record and independently confirm:
- Money arrived to your intended account
- The exact UTR matches
- The received INR amount matches the purchase amount
- The transaction is genuine and is not already approved/reversed

Click **Approve**, then type the exact UTR and INR amount, tick the independent verification statement, and write a note of at least eight characters. Only then does the server activate the plan and record an audit entry. **Reject** leaves Build Fast locked. A repeated attempt to approve an already reviewed request is rejected.

The Owner may also grant/revoke memberships under **Users** with an audited reason. Access automatically expires after the plan duration. Future cloud deployments will need proper idempotency, fraud review, refunds, tax invoices, renewal/cancellation handling, retention/deletion policies and support processes.

## Server API integration

- `POST /api/billing/attempt` with `{"plan":"builder","interval":"monthly"}` begins or resumes a timed checkout for an authenticated user, returning `attempt_id`, `expires_at`, `server_time`, `paid_inr_paise`, `upi_id`, and `qr_url`.
- `GET /api/billing/attempt?id=<attempt_id>` returns the authenticated customer's attempt status and remaining seconds. Do not trust a browser timer as the source of truth.
- `POST /api/billing/request` requires `attempt_id`, `plan`, `interval`, `method":"manual"`, `payer_name`, and `reference`; rejects late, reused, other-user, or changed-configuration attempts.
- `GET /api/billing/requests` shows pending/approved/rejected records. Real membership activation remains solely through independently verified owner approval.

## What's real / not real

**Real in local development:** authenticated owner-only API controls, QR storage and retrieval, prices in integer paise, scoped requests, UTR de-duplication, logged approvals, plan activation/expiry, owner stats from local records, current plan locks.

**Not yet implemented:** automatic UPI transaction lookup, a provider payment gateway, recurring billing, actual bank validation by Blorp, email notifications, production-grade public authentication, managed multi-user cloud security, Blorp proprietary model hosting, or unlimited agent compute. You must verify payments manually.

## Test

```powershell
py -3 tests\test_api.py
py -3 tests\test_memberships.py
py -3 tests\test_local_agents.py
```

The automated tests use temporary test accounts, fictional UTRs and a generated sample PNG. **No real QR, funds, or payment details are involved.**
