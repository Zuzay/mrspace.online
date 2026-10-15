# Rufcut sales separation and billing

The customer site remains on its existing domain. The Jeans Builder, repair form and work-order tracker retain their existing endpoints. Top and bottom ownership notices appear on home, standalone repair and legacy product/return pages. Embedded repair hides duplicate notices. The notices support five languages, pause and reduced motion; the client cannot mark payment verified to remove them.

Rufcut's panel exposes work orders and a separate billing page. Real accounts entering the legacy general panel are routed to the focused panel. Server-side `ms-square` guards deny Rufcut catalog, commerce, checkout, management and OAuth callback access; other sites keep their current behavior. This is a local service restriction, not evidence that the merchant has revoked the application in Square. The `/panel/rufcut/square/` page provides the merchant instructions and leaves confirmation pending. No stored credentials or customer records are deleted by this change.

## Billing deployment order

1. Apply the reviewed schema in `ms/mrspace-billing.sql` using the project's migration tool. It contains no customer terms. Customer data and the work-summary function are inaccessible to anonymous/authenticated Data API callers; the Edge handler checks the actual session and site membership. Viewer accounts are denied.
2. Enter the customer-approved commercial terms privately in `ms_billing`. Never commit the private campaign note or seed SQL to this public repository. Component prices remain empty unless separately specified; only the agreed standard total is shown.
3. Deploy `ms-panel` and `ms-square`, then the static site. The existing main-branch workflows may deploy functions and the client site when configured. Coordinate the schema before merging. Verify both the studio preview and standalone domain.
4. Verify unauthenticated and foreign-site requests cannot read billing; verify the authorized owner sees actual terms, activity count and recorded minutes. Totals use an exact SQL aggregate rather than a truncated client-row sum. Activity counts are not revision counts or invoices.
5. After observing the actual initial payment, an administrator records both `setup_verified_at` and `setup_verified_by`. Then release a reviewed change removing ownership notices from the customer pages. A browser flag, redirect or customer assertion is not payment evidence.

Billing is a statement of terms and setup-payment verification. This change does not create a payment gateway, monthly invoices or automatic recurring charges. Optional services and standard reference value never increase the setup amount due. Monthly billing requires actual invoices before it can be reported as due/paid.

## Validation

- `node tests/rufcut-separated.mjs`: all blocked Rufcut Square routes and a separate site's unchanged access, without real Square calls.
- `node tests/rufcut-billing.mjs`: real authorization helper, site membership/viewer isolation, verified/unverified setup, exact work summary, missing/invalid data and no-store.
- `MS_PLAYWRIGHT_MODULE=... MS_CHROME_PATH=... node tests/rufcut-separated.browser.mjs`: focused panel and billing, five languages, mobile/desktop, pause/reduced motion, tracking, and real jeans/repair handlers backed by isolated data. No live orders or payments.
- `node tools/build-site.mjs rufcut /path/to/empty/output`: actual deployment pack retains its original CNAME, includes both marks, and omits sales modules.

The historical Square sales/handover suites describe the removed behavior and are superseded for Rufcut by the separation suite. Shared sales modules remain available to other customers.

## Reconstructed effort and disconnected account

Billing keeps original activity minutes unchanged. The main effort display uses a separately labelled estimate from privately stored owner-provided durations and history-based session clusters. Night-check counts are exact activity counts, while their effort allowance is explicitly estimated. This estimate does not alter setup fees, agreed monthly fees, or payment verification.

Rufcut account authorization was revoked through the official OAuth endpoint, then its credential row, catalog publication rules and commerce setup were removed. Shared application credentials for other merchants were not changed. The admin connection diagnostic no longer probes Rufcut Square. Historical activity records are retained.

Ownership marquees also appear on the focused panel, billing and separation pages; panel marquees link to billing. Each visible repeat is clickable, with one keyboard focus target per bar. Ownership marks remain until the initial payment is verified.
