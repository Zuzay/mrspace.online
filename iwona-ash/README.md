# Iwona Ash storefront preview

Public route: `https://mrspace.online/iwona-ash/`.

This is a self-contained storefront demonstration. Collection browsing, search, product galleries, real option combinations, cart quantities, cart persistence and a non-transactional checkout preview work within this route. Shopping controls do not navigate to the original store.

## Data and assets

- `catalog.json` contains the 22 source products, 204 variants and 389 product photographs inspected on 2026-10-14. Product descriptions are rewritten; source dimensions, prices, option values and variant IDs are preserved.
- Product galleries use the original Shopify CDN files with responsive width parameters. All 389 source photographs returned HTTP 200 during verification. Local editorial photography, the original brand logo and self-hosted fonts are in `assets/`.
- Stock flags are a source snapshot, not a live stock feed. Some combinations are unavailable in the source and cannot be added to the preview bag.
- Social, email, telephone, interviews and map links use the brand's verified destinations. Product and collection navigation stays inside this preview.

## Behavior and future connection

- `assets/store.js` loads the catalog from the same origin. Rendering uses DOM text nodes rather than injecting source HTML.
- The preview bag stores variant IDs and quantities under `iwona-preview-bag-v1`. It contains no contact or payment information and never submits orders.
- Product handles, numeric Shopify variant IDs, selected options, unit prices and images are retained for a future commerce adapter. Real catalog, cart and checkout operations must replace the preview implementations when Shopify is connected. No API credentials are installed in this preview.
- Native dialogs provide focus containment, Escape handling and a return to the previous screen. Product deep links use `#product/<handle>`.
- Existing shared-editor identifiers for opening, color edit and visit content remain stable. No customer-specific editor or backend was introduced.

## Verification

- No horizontal page overflow at 320, 390, 768 and 1440 px.
- Collection counts, search empty state, real color/size image selection, unavailable combinations, gallery navigation, adding a chosen variant, quantity changes, removal, empty bag and refresh persistence were checked in the browser.
- Checkout remains explicitly disabled. No payment, order, subscription or message was sent.
- Local asset paths, unique element IDs, all 204 option mappings, JavaScript syntax and Git whitespace checks pass.

The route remains `noindex,nofollow` while it is a design preview.
