# Rufcut domain and owner handover · 14 October 2026

## Agreed delivery

Native product details on the Rufcut website; checkout, payment, tax, fulfillment and sales receipts stay on Square Online. Square is the daily catalog editor. The owner can create products, group their sizes/styles as variations, assign categories, change descriptions/photos/prices/stock, and archive items without entering the Mr. Space panel. Repair/design work orders remain in the existing system.

## What the live read-only audit confirmed

- Square account **Rufcut-Venice**, USD, is connected; public catalog is enabled.
- The published response contains 32 cards: 24 shop, 1 workshop and 7 repair cards. Separate variation cards account for some of this total.
- Eight publication records still contain `www.rufcut.com/product/...` sale links (7 shop parents, 1 workshop).
- The existing Square store is `rufcutvenice.square.site`, discovered in the old website's public configuration. A real HTTP check on 14 October returned **302 from that Square host back to www.rufcut.com**. Merely changing link hostnames does not resolve the migration until Square's custom-domain redirect is removed/reconfigured.
- Shared commerce setup has pending shipping rates, no reviewed tax setup or returns URL, and no eligible ready-made items. This preparation is separate from the merchant's existing Square Online checkout; it does not establish whether that checkout's shipping/tax policies are correct.
- Existing open work: #45 mail/editor/English presentation, #47 fitting/media, #58 project admin, #35 builder persistence. This change avoids all their modified files. They are not part of the tested release and must not be described as installed.

No production catalog, credential, email, DNS, Square checkout configuration or payment was changed during this audit. A connected account alone does not demonstrate successful checkout.

## Implemented on the delivery branch

- Photo/title links open `/rufcut/product/?id=...&variation=...` on the studio preview and `/product/?id=...&variation=...` on the standalone domain. Current Square data is fetched on each page load. Size choice updates price, photo and shareable URL. Missing products and catalog outages have contact fallbacks; a removed requested variation requires a new choice before exposing checkout.
- Checkout links use Square-hosted product pages/payment links. Existing Rufcut product URLs are converted to the verified merchant Square hostname. A product lacking a valid Square sale link remains viewable with a contact option; an item existing in Square POS is not proof it is published for Square Online sale.
- `SQUARE_MANAGED_SITES` selects direct Square catalog mode. Default is `rufcut`; an explicitly empty value restores curated behavior for all sites. Other merchants remain curated.
- Current Square categories, buyer-facing name/name, description, photos, prices and stock are read on each public request (HTTP cache up to 30 seconds). This is pull-on-load sync, not a background webhook and not automatic updating of an already open tab.
- New uncategorized Square items default to Shop; new variations appear automatically. Existing review/hidden destinations and explicitly excluded variations remain protected until the owner assigns a Square category. This preserves old deposits/internal records during migration. A Square category then takes precedence over old website placement. Names/titles follow Square in direct mode.
- Categories **Jeans** / **Jeans & overalls**, **Outerwear** / **Jackets & coats**, **Shirts** / **Shirts & tops**, **Accessories** map to existing groups. Any other ordinary category becomes its own named website group. The first ordinary assigned category is the primary group; Square's ordinal controls ordering within it. One item belongs to one primary group on this site.
- Reserved categories **Workshop(s)**, **Repair(s)** route services to the relevant sections. **Website hidden** hides a record. Square archive/deletion, non-sellable choices, location exclusions and active sold-out flags suppress availability. Setting Square Online category visibility alone is not this custom website's publication switch; use Website hidden/archive.
- Square-managed catalog records show a read-only Square source notice in the panel; the API rejects ineffective publication saves with 409. Existing per-site hide/global public-off controls remain authoritative. Direct mode does not grant anonymous write access and never changes Square itself.
- `tools/build-rufcut-release.mjs` creates a separate static host package and CNAME. It does not change the studio's CNAME or publish. It adds legacy product/shop/contact/service redirects for hosts supporting `_redirects`, removes concept/noindex branding in the generated homepage, and updates storefront cache versions.

## Domain cutover, in this order

1. Review the branch/PR and the generated standalone preview, including the product page, Jean Maker, Repair Atelier and work-order tracking. Compare current Square categories before enabling direct mode: ordinary categories deliberately make their assigned products public, including formerly hidden records. Put register-only deposits/internal services in **Website hidden** or archive them first.
2. In the owner's Square Online settings, retain/re-publish the store on `rufcutvenice.square.site` or an owner-approved separate checkout subdomain. Remove the redirect to `www.rufcut.com`. If a different host is selected, update the single `squarePurchaseURL` host mapping before release. Do not take away the current working shop before the replacement Square address has been verified.
3. Check each sellable product in Square Online. Ensure variants, modifiers, discounts, taxes, shipping/pickup, refunds/returns and contact information are correct. New POS-only products may need Square Online publication before they have a usable `ecom_uri`; that field is deprecated by Square, so an existing validated per-variation payment/product link is also supported as fallback. Do not manufacture URLs for unpublished items.
4. Deploy `ms-square` and its imported shared assets from the reviewed commit. Keep the existing public/OAuth `verify_jwt=false` configuration; authenticated POST actions still validate the actual user and site membership. No schema or payment-scope expansion is required for this hosted-checkout approach. Do not deploy unrelated branch changes.
5. Generate the dedicated website into a fresh directory: `node tools/build-rufcut-release.mjs /private/tmp/rufcut-release-UNIQUE`. Deploy that directory to a **separate Rufcut hosting project**, not over the studio. Configure real redirects matching `_redirects` if the chosen host does not support that file (GitHub Pages does not).
6. Preview the package before DNS. Inventory old `/about`, `/press`, `/gallery` and any other search-indexed pages; preserve required content/URLs or agree redirects before cutover. The package currently supplies product/shop/contact/workshop/repair redirects, not replacement press/gallery content.
7. In DNS change only the records required by the selected website host, covering apex and www with one canonical hostname and valid HTTPS. Preserve the owner's mail MX/TXT/SPF/DKIM/DMARC records. Public RDAP identifies Register.com - Network Solutions, LLC as registrar and live NS lookups use register.com nameservers. Whether the owner manages them through Square remains unverified. Hosting target and account access have not been selected/verified in this audit; do not guess a CNAME target.
8. Verify real `https://www.rufcut.com` and apex, `/product/` details and old product paths, script/font/photo loads, maker/repair submission and ticket lookup, and a newly added Square item/category. Confirm no Square product redirect comes back to the same native detail page.
9. The merchant completes a controlled purchase, checks the correct variation/total/fulfillment and receipt in Square, then confirms the refund/cancellation procedure. The agent must not claim checkout tested from an href or an HTTP 200. No test purchase was made here.
10. Record approved commit SHA, hosting deployment, domain/HTTPS verification, checkout result, owner access, and rollback point. Retain the previous website deployment and DNS snapshot for rollback.

## Owner's own AI account

Give the owner the **dedicated generated Rufcut repository/project** and `rufcut/OWNER-AI.md`, not the multi-client studio repository. Their own coding agent can propose website changes using that repo; their Square account remains the product/order editor. A Claude/Codex subscription does not by itself authenticate to Square, GitHub or hosting. The owner connects those accounts separately and receives a preview/PR before publication. Do not hand over a shared Supabase service-role key, Square application secret, multi-merchant OAuth tokens, studio admin account or another client's files.

For direct AI-driven Square writes, use an owner-authorized Square integration with only the required merchant scopes; that integration is **not created by these changes**. Website/public-catalog reads require no secrets. The owner can manage products directly in Square today, independently of which coding assistant they use. Backend repair/order management still uses existing per-site panel authorization; complete backend ownership transfer would be a separate project/data migration, not copying the public release.

## Verification

- `node tests/rufcut-square-sync.mjs`: automatic imports/variations, groups, source edits, service routing, exclusions/archive/sold-out, safe checkout URLs, curated-mode isolation and no public private fields.
- `node tests/site-catalog.mjs`, `node tests/commerce.mjs`, `node tests/panel-daily.mjs`: existing contracts and access checks.
- `MS_PLAYWRIGHT_MODULE=... MS_CHROME_PATH=... node tests/rufcut-handover.browser.mjs`: category/photo/title navigation, exact variant price, reload, removed item/failure, five languages and light/dark phone layouts.
- Existing shared panel/catalog browser regression: 5 relevant groups passed using a temporary copy with two stale groups omitted. The unchanged original suite fails at the old `.order-inbox` home expectation (the panel now opens Today), then at the multilingual Rufcut-panel assertion (Rufcut is now intentionally English). These are recorded, not counted as passing. Placement/save/failure/add-variation and the existing storefront category/price groups passed.

The release was merged locally with current main `5d7633593d9517fbc76b6fb8c2f61d77462fc7a8`; its newer catalog save protections are retained. The 6 handover browser groups and 5 current-main catalog-save race groups passed again after that merge.

Final local results: 7 Square-sync groups, 17 curated catalog groups, 9 commerce groups, the daily panel contract suite, 6 new browser groups (including independent host packaging and removed-variation protection), and 5 focused existing browser groups passed. JS syntax, language JSON parsing and `git diff --check` passed. New product page desktop/mobile screenshots were visually inspected.

Local fixtures block production payments, catalog writes and customer notifications. Local success does not remove the pending live Square/domain checks above.

Primary references: [Square catalog/variations/categories](https://developer.squareup.com/docs/catalog-api/design-a-catalog), [CatalogItem and deprecated ecom_uri](https://developer.squareup.com/reference/square/objects/catalogitem), [CatalogCategory](https://developer.squareup.com/reference/square/objects/CatalogCategory), [Supabase per-function configuration](https://supabase.com/docs/guides/functions/function-configuration).

Domain guidance: Square can retain domain registration/DNS while another host serves the website. For Square-owned domains inspect Dashboard → Channels → Domains → Manage → Manage domain → DNS Records. Obtain actual A/CNAME values from the new host; keep mail records. Public RDAP and DNS lookups identify Register.com infrastructure; the customer account/reseller that controls it remains unverified. [Official Square DNS guidance](https://squareup.com/help/us/en/article/6962-manage-dns-records), [replace a custom domain with a Square subdomain](https://squareup.com/help/us/en/article/6916-connect-your-domain-with-square-online-store).

## Live publication correction · 14 October 2026

PR #59 was published to GitHub Pages and ms-square v10. The actual Square category names exposed a gap in the original test fixtures: ordinary existing categories republished old internal Shipping/Custom Charge records and sent Alterations / Repairs to Shop. A targeted forward fix retains automatic new products/variations while preserving legacy hidden/review destinations and excluded variations unless the owner explicitly adds Website publish. Shipping/Register only/Internal remain hidden; Alterations / Repairs and Patches / Embroidery are repair destinations. This supersedes earlier statements above that ordinary category assignment alone unlocks legacy exclusions. Nine Square-sync groups, including the actual category names and explicit publication marker, pass. The initial v9 rollback request was rejected by automatic approval review; the forward fix preserves the newly authorized Square management feature.
