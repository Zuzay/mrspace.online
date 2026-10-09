# Shared website catalog

Every Square-connected Mr. Space site uses the same publication contract, server and panel. Square owns product/variation IDs, SKUs, prices, photos and stock. Website placement and website titles live separately in `ms_catalog_publications`; saving a placement never rewrites Square.

## Daily use

1. Open **Site catalog** in the panel. Search product, variation or SKU; filter **Needs review** to find new choices.
2. Expand a product. Choose its destination, shop category, order within the category (0–9999, lower first), optional website title and grouped or separate cards. Rufcut shows Jeans & overalls, Jackets & coats, Shirts & tops, Accessories and Other pieces in that order. Services never appear in shop categories. Select only the variations to display. New Square variations are excluded until selected and saved.
3. Read **Saved placement**, check the proposed location and **Website preview**, tick the confirmation, then **Save website placement**. A failed save leaves the draft and an inline error. Drafts remain in memory across panel tabs and filters; leaving the browser warns before losing them.
4. Same product in another size/fabric: use **Add variation to this product**. Different product: **Add product or service**, select destination and whether physical stock is tracked. New direct Square imports start in review. An item created through the panel can publish immediately only to the destination explicitly chosen there.
5. Stock count and product photos remain under **Stock**. Labels use the original variation SKU. Use the existing SKU guide only for SKU organization, not publication routing.

Rufcut supports Shop, Workshop and Repair. Other sites start with Shop. Hidden means Square/register only. Review is unpublished. Each new site must implement its offered sections before exposing them in `MsSiteCatalog.sections`; do not offer a destination without a storefront renderer.

## First-entry guide

The normal first panel entry opens the shortcut guide. Explicit order/catalog deep links still open their target. The opt-out checkbox lives at the bottom, with an explicit save/continue button. Preference is per site on this device (`ms_help_skip_v1:<slug>`), contains no account credentials and is reversible from the persistent **Need help?** tab. The help page links to work orders, Site catalog, Stock, the editor and the English Rufcut PDF. It includes self-service troubleshooting. The shared help supports all five panel languages; the Rufcut PDF is English.

## Deployment

Apply `ms/mrspace-site-catalog.sql` and then `ms/mrspace-site-catalog-categories.sql` (both idempotent). The table has RLS; anon/authenticated have no direct grants; only the service function persists decisions after real user and site membership checks. Active viewers cannot use the Square handler. No new client RPC or database secrets.

Deploy `supabase/functions/ms-square/index.ts` with `verify_jwt=false` (public catalog and OAuth callback; authenticated POST actions verify user and membership). Include `assets/ms-site-catalog.js` at its repository-relative path because the Edge handler imports the same pure contract used in the browser. Public responses contain only approved cards; no SKUs, credentials, ownership or unpublished records. Settings load errors fail closed. Cache: 30 seconds.

`save_publication` validates destination, category, whole-number display order, layout, title lengths and exact variation ownership. `set_count` checks variation ownership and whole quantities. Add-product/variation calls use a persistent form idempotency key. Once Square confirms creation, later stock/photo/publication errors return the confirmed object plus explicit follow-up errors, avoiding a misleading “nothing saved” response.

## Initial Rufcut review

The existing 34 public Square items were read with their 63 variation IDs. Website-only decisions were initialized without changing Square: 13 shop products, 1 full workshop, 7 repair services, 7 register-only/hidden records, 6 needing owner review. Same-product sizes/fabrics are grouped. Mixed-model parents use separate cards and may use website-only titles. Overalls' Miscellaneous variation is excluded. Workshop deposit stays register-only. The priced New Hem entry goes to Repair; its unpriced duplicate stays hidden. No records were merged or deleted.

Needs review: Bespoke Collection, Chore Coat, Name Tags, Patches, Rufcut 5-Pocket Bespoke Jeans and T-Shirts. Their intended product identity or overlap with other items needs the shop owner's choice. No automatic name/SKU heuristics run on future imports. The 13 approved shop parents are curated into 5 jeans/overalls, 5 outerwear, 1 shirt and 2 accessories. Bespoke jeans lead; Belt and Jean Journal are Accessories. Original destinations and variation decisions are preserved.

## Verification

```sh
node tests/site-catalog.mjs
MS_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs MS_CHROME_PATH=/path/to/chrome node tests/site-catalog.browser.mjs
```

The actual Edge handler runs against an isolated Square/database double. Browser groups exercise first-entry dismissal/reopening, save errors, draft preservation, add-product/variation, five languages at phone width and grouped storefront choices with exact prices. All external production APIs are blocked. Rebuild and render the updated 11-page English PDF using `ms/guides/README.md`.

Limits: no checkout/payment flow is added. Workshop and product inquiry links use the shop contact section; repair cards open Repair Atelier. Null stock means untracked, not confirmed physical availability. Website drafts are memory-only and do not survive a closed/reloaded browser after its warning. Publication writes currently use last-save-wins per product; the preview is the selected subset of the latest catalog fetched by the panel. Server validation rejects foreign/deleted variation IDs.
