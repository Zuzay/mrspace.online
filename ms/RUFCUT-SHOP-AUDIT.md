# Rufcut shop audit · 2026-10-11

## Found and repaired

- Catalog publication was globally off despite existing approved website placements. Restored publication of reviewed choices; new/unreviewed records remain unpublished.
- Seven Levi’s jeans choices repeated the same photo in seven cards. Website layout now groups them into one selectable card. Model filters retain only matching choices; clothing sizes sort XS–XXL.
- Cards went to `#visit` and lost the selected product context. Existing merchant-owned Square Online product URLs now attach to exact approved catalog variations. Changing a choice refreshes photo, price and sales action together. No URL is fabricated from a product name.
- Eight currently published product pages were read from Rufcut’s actual Square Online shop. The seven shop parents and the workshop deposit were matched by their real catalog IDs. The existing online 5-Pocket jeans are now approved for Shop. Belt and Jean Journal remain Accessories; workshop and repairs remain outside Shop.
- The actual workshop online booking charges a $200 deposit. Show that record, not the $2,249 full-price catalog record, to avoid an ambiguous purchase link.
- Shared Site catalog has an optional Square link per variation, a working preview and an explicit link-change summary. Links can be cleared. Old panel tabs preserve links they do not know about. HTTPS Square-hosted URLs are allowed; Rufcut’s own existing product domain is allowed only for Rufcut and must end with the matching product ID.
- A piece without a confirmed online listing opens its actual details and availability information. It never shows a pretend Buy button. The Available online filter exposes only choices with a confirmed sales URL. Filters include category counts and do not briefly claim an empty shop while loading.

## Sales boundary

Purchases continue on the existing Rufcut Square Online store. Choose size, fabric and fulfillment there; Square controls live promotions, tax, shipping, pickup and payment. Montana currently has a $449 promotion while the catalog base price is $499. We do not hard-code a temporary promotion. The common Mr. Space cart/checkout remains disabled, and pending shipping rates are not treated as free shipping. No payment, refund, order or shipping-label purchase was made during this audit.

## Remaining merchant decisions / unfinished work

- Items without published Square Online pages still need online publication or a confirmed Square payment link. Their shop cards clearly show that online checkout is not available yet.
- Square stock is untracked for the visible products. It does not prove physical availability. Staff must confirm counts and sale eligibility in Square before promising one-off vintage inventory.
- Mr. Space Sales & shipping still needs approved tariffs, packed measurements, dispatch timing, returns URL and tax review before its own future checkout can launch.
- Book a fitting still uses email in the released homepage. Ticket integration and the updated PDF/photo tools remain the unmerged work in PR #47. Do not describe them as delivered.
- Repair and Jean Maker ticket submission, tracking and the recent editor fix are separate from product payments. Audit does not send test customer jobs into the shop panel.

## Validation

Run `node tests/site-catalog.mjs` and `node tests/commerce.mjs`. 17 catalog and 9 commerce checks passed. Public HTTP reads and browser checks verify real category order, variant switching, native Square destinations, unavailable-piece details, mobile layout and five languages. Existing Square product page shows required variant/waist selectors, Shipping/Store pickup and Add to Cart; no checkout was submitted.
