# BLORP Studio subscription frontend preview

This branch adds the approved standalone BLORP Studio HTML at `public/blorp-studio-subscriptions-preview.html`. The existing app entry point `public/index.html`, local Python server, Electron modules, account logic, and owner/payment backend remain untouched.

## Included

- Builder ($20/month; $216/year) and Studio ($50/month; $540/year), with 10% annual discount.
- Owner-supplied Builder and Studio QR **artwork** embedded in the offline HTML.
- Five-minute client-side timer for an illustrative UTR submission.
- Sample-only UTR entry, masked draft receipt, and no plan activation.

## Important: NOT a live payment flow

The two QR screenshots were checked with a QR decoder and **no valid payment payload could be extracted**. Their appearance is not proof they are scannable or point to the correct account. Never ask customers to pay through these screenshots without independent verification on real UPI apps.

The USD membership prices are **not** INR payable amounts. Do not infer an exchange rate or a fixed INR payment amount from the artworks. Before enabling the Subscribe flow in production, use owner-approved, verified UPI payment details and exact INR amounts provided securely by the backend.

This version uses browser sessionStorage for masked demo records and a browser-controlled timer. No real UTR, secret, or payment is sent to the server, and a fake client timer must never control entitlement.

## Backend integration required

1. Validate authentic UPI QR payloads, payee identity and INR amount for each plan/billing cycle.
2. Create payment attempts and authoritative 5-minute deadlines server-side; enforce expiry on submission.
3. Receive UTR submissions with authentication and server-side validation; prevent duplicate references and race conditions.
4. Keep membership pending until the owner independently checks the transaction and approves it. Never activate from a client-side receipt.
5. Connect to the existing owner/UTR backend only after regression and security tests.
6. Integrate the final frontend modularly rather than replacing the existing app entry point wholesale.

## Review

Open the standalone preview, visit Membership, test Builder and Studio selectors, toggle Monthly/Yearly, and review the QR reference and UTR demo. Manual desktop/mobile QA and real payment scanning are still required.
