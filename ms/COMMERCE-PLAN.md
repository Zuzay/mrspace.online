# Shared purchasing and delivery plan

This is the common Mr. Space commerce preparation system for Rufcut, Heron and later sites. Website category placement stays in Site catalog; sale eligibility, parcels, delivery coverage and policies stay in Sales & shipping. Square owns product/variation IDs, prices, currency and stock. Site settings and credentials are never copied between merchants.

## Phase 1: installed preparation

Open `/panel/?site=rufcut&view=commerce&lang=en` or `/panel/?site=heron&view=commerce&lang=en`. Existing panel membership is required; active viewers cannot read or save these settings. Rufcut starts with US delivery and free shop pickup, as requested. Heron starts with no selected delivery region or tariff. Heron’s existing native Square store and checkout remain separate and operational; this preparation does not alter them or copy their tokens. The shared panel can connect the same Heron merchant through its own OAuth grant when needed.

The screen stores delivery countries, shipping origin country/postal code, dispatch time, returns-policy URL, Square tax-review acknowledgement, parcel profiles and each product’s sale eligibility and packed measurements. All products start as inquiry/fitting required. Ready-made products must be individually reviewed; made-to-measure jeans and repair jobs remain requests. Weight includes packaging; no weights, box sizes or carrier charges are guessed from photographs. A blank shipping fee is unknown, never zero.

Rufcut shipping tariffs remain pending until Rufcut confirms them. The same applies independently to Heron. Money inputs use the connected merchant’s Square currency. There is no default USD account for Heron. Confirmed flat tariffs apply to every explicitly selected delivery country; do not use them for coverage the merchant has not agreed to, including remote-area surcharges. A carrier option is recorded as a future integration and cannot return fabricated live rates.

The internal purchase preview reads current server-side Square data and approved Shop variations. It rejects unpublished/service choices, inquiry products, untracked/insufficient stock, foreign variations, unsupported delivery regions, wrong currencies and unset tariffs. Repeated variation lines are combined before stock checks. Cart input contains variation IDs and quantities; client prices are ignored. Shop pickup has zero shipping. One parcel uses the highest first-item tariff plus additional-item fees for its other units, rather than charging a full parcel for every product. Taxes remain explicitly uncalculated in this preview.

Drafts survive panel-tab navigation in memory. Before/after summaries identify changed fields, tariffs and products. Failed saves retain the draft. Leaving the browser warns; drafts do not survive a closed/reloaded browser. Settings use last-save-wins per site; coordinate simultaneous operators.

**Preparation never enables live checkout.** `checkout_live` is always false in this phase, including when every setup prerequisite is complete. No payment links, card charges, carrier quotes or shipping labels are created. Existing storefront inquiry links stay available.

## Phase 2: connect purchasing after handover decisions

1. Rufcut approves additional Square permissions through **Authorize Square payments**. Required for the intended flow: `ORDERS_READ`, `ORDERS_WRITE`, `PAYMENTS_READ`, `PAYMENTS_WRITE`, in addition to existing stock/catalog permissions. Ordinary stock Connect Square does not request payment permissions. Status reads the token’s actual granted scopes rather than assuming a reconnect worked. Heron authorizes its own account independently.
2. Confirm each shop’s shipping tariff or carrier account, full sender address, service regions, packed product weights/dimensions, dispatch time, tax handling and returns policy. USPS/UPS or another carrier must be chosen by the merchant; do not purchase a carrier label during setup. US-first does not imply the same shipping cost for every ZIP code or for Alaska/Hawaii. Heron coverage and currency must be confirmed separately.
3. Add a shared cart using exact variation IDs. Show product subtotal, delivery/pickup choice, shipping, tax and the final total before commitment. The server revalidates current publication, sale eligibility, price, currency, availability and destination. Any change asks the buyer to review the updated total. The current preview is a calculation foundation, not an address/tax verification service.
4. Build a per-order Square-hosted checkout using catalog variation IDs. Square Checkout accepts an explicit shipping fee and can collect a shipping address; it does not automatically provide our carrier quote. For address-sensitive rates, validate the destination before creating checkout, bind the quote to that destination/cart, give it an expiry, and prevent a changed checkout address from retaining an incompatible shipping charge. Confirm this behavior in sandbox before choosing hosted checkout versus the Web Payments SDK.
5. Save a durable purchase record before checkout creation and use a stable idempotency key. A timeout retry must reuse the original request and must not create a duplicate order/link. Persist the Square merchant, location, order/payment IDs and immutable line/price/shipping/tax snapshots. Keep buyer addresses/contact data server-side behind membership checks.
6. Verify payment through Square, never the return URL, browser storage or a query parameter. Validate webhook HMAC over the exact notification URL and raw body, bind merchant/order/payment/currency/amount, deduplicate event IDs, handle retries and out-of-order events, and add reconciliation. A completed paid record must not regress to pending after an older event. Refunds/partial refunds are distinct from fulfillment status.
7. Implement inventory handling for one-off vintage stock. A pre-check is not a reservation against simultaneous Square POS sales. Recheck stock, respect location-level sold-out flags, serialize competing website attempts and define cancellation/refund recovery if POS sells the last unit concurrently. Do not promise zero overselling from payment links alone. Test the last-unit race before launch.

## Phase 3: merchant order desk and shipping

Add a shared **Sales orders** panel alongside repair/design work orders. The purchase ticket shows line/variation quantities, product price, shipping/tax/total, verified payment state, buyer contact/address, delivery method and tracking. Fulfillment states: paid → preparing → shipped → delivered; pickup uses ready for pickup → collected. Cancellation/refund and payment states remain separate. Printing produces an order/packing ticket, not a claim to replace Square’s official payment receipt.

Only a verified paid order can create a shipping label. A carrier adapter validates the destination, chooses a configured parcel, displays the live rate and label cost, and requires an explicit operator action to buy a label. Store carrier shipment ID, service, label/tracking URL and delivery events. Retries use provider idempotency/reconciliation; repeated clicks must not buy repeated labels. Product price and the buyer’s collected shipping fee remain separate from the merchant’s actual carrier cost. Reuse existing Mr. Space phone installation and notification modules for sales events; email sender setup remains deferred to handover.

## Launch acceptance

- Rufcut and Heron merchant/currency/data isolation verified; viewer/anonymous/cross-site denial verified.
- Ready-made purchase, multiple variations, mixed parcels, free pickup, rejected destinations, pending rates and price/stock changes exercised in sandbox.
- Tax/address/total matching reviewed with merchant. A preview tax acknowledgement is not a tax calculation.
- Declined payment, abandoned/expired checkout, duplicate submission, lost response, webhook retry/out-of-order events, partial/full refund and last-unit POS collision tested.
- Paid order reaches the panel and printable ticket; label/tracking workflow works without duplicate label purchases.
- Merchant confirms tariffs/policies and a final controlled purchase/refund. Only then expose Buy for reviewed products. Do not enable purchase solely because Square connected.

## Installation and verification

Apply `ms/mrspace-commerce.sql` (idempotent). `ms_commerce_setups` has RLS; no direct anon/authenticated table grants. Existing authenticated `ms-square` actions enforce real JWT user, site membership and viewer exclusion. `commerce_save` validates exact owned product IDs and all fields. `commerce_quote` is an authenticated internal preview, not a public checkout API. `commerce_status` returns settings, eligible published items and read-only setup blockers; no OAuth secrets.

Deploy `ms-square` with `assets/ms-site-catalog.js` and `assets/ms-commerce.js` under their repository-relative paths. Retain custom authentication and the existing public/OAuth routes. No additional secrets are required for Phase 1. Publication and Square catalog data are not modified by saving commerce preparation.

Tests: `node tests/commerce.mjs`; `MS_PLAYWRIGHT_MODULE=... MS_CHROME_PATH=... node tests/commerce.browser.mjs`. Test doubles block live payments, labels and notifications.

## Primary references checked 2026-10-09

- [Square CreatePaymentLink and required scopes](https://developer.squareup.com/reference/square/checkout/create-payment-link)
- [Square catalog variations in checkout](https://developer.squareup.com/docs/checkout-api/square-order-checkout)
- [Square shipping address and explicit shipping fee](https://developer.squareup.com/docs/checkout-api/optional-checkout-configurations)
- [Inspect granted token scopes](https://developer.squareup.com/reference/square/o-auth-api/retrieve-token-status)
- [Validate Square webhook signatures](https://developer.squareup.com/docs/webhooks/step3validate)
- [Location-level sold-out status](https://developer.squareup.com/docs/inventory-api/monitor-sold-out-status-on-item-variation)
