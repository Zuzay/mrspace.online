# Space Tailoring

Studio-owned tailoring brand at `/space-tailoring/`. Location copy is **3rd Street, Santa Monica, California**; no street number, phone, hours, customer testimonials or operating history are invented. `media/atelier.webp` is original AI-generated editorial imagery, not a photograph of the premises. No previous client's brand, photography, contacts, payment links, stock or customer data is used.

The Maker is one section at `#build`. Choose jeans, bag or jacket using `#makerProduct`, then edit the selected product. Jeans retain the existing fit/denim/wash/thread/fly/hem contract. Bags have tote/crossbody/weekender shapes; jackets have work/overshirt/cropped shapes. Custom pieces share the design dialog, measurements, receipt and tracking flow. Product drafts and theme preferences use `space-tailoring-*` browser keys.

`/space-tailoring/repair/` reuses the visual garment marking workflow. `/panel/space-tailoring/` provides authenticated orders, filters, status changes, fitting measurements, staff notes and A4 tickets, plus a read-only sample panel. Website edits use the existing shared `/edit/?site=space-tailoring` review workflow and stable `data-ms-field` IDs. No separate site editor is created.

## Server

- `ms/space-tailoring.sql` registers the site and creates a service-role-only insertion RPC with duplicate detection and per-site submission limits. It is rerunnable and preserves all existing client records and access grants.
- `ms-tailoring` is a separate Edge Function. Its public validation, submit and tracking actions are fixed to `space-tailoring`. Staff reads and updates use existing admin/site membership checks. Notification preferences and push subscriptions are filtered by the same site.
- Existing `ms_repair_jobs.kind` stays `repair | jeans`; custom garments are design orders (`jeans`) and identify bags/jackets through `design.product`. The panel labels this group “Custom pieces”.
- Receipts start `ST-`; tracking returns status information only. It cannot expose private contact information or another site's receipts.
- Sender configuration and push infrastructure reuse the studio notification system. Delivery depends on that system's configured secrets and preferences; no live notification is sent during tests.

## Validation

`node --test tests/space-tailoring.mjs tests/public-surface.mjs`

`MS_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs MS_CHROME_PATH=/absolute/path/to/chrome node tests/space-tailoring.browser.mjs`

Browser tests intercept all external submissions and cover five languages, narrow/wide layouts, product changes, repair, tracking, themes and sample orders. Read-only validation against the live function uses actual browser SVG payloads. Database insert/retry checks run in a rolled-back transaction.

The existing `/rufcut/` route is retained; homepage promotion is replaced. The public build applies `noindex,nofollow,noarchive` to all pages under that route. This keeps direct access working without treating the URL as an authentication mechanism.

## Image provenance

Built-in ImageGen, no reference photos. Prompt: “Generate a single original editorial photograph for Space Tailoring, a bespoke denim and repair atelier. Portrait 3:4 composition. A beautifully tactile indigo denim jacket draped across a pale cool grey cutting table, one pair of folded raw denim jeans, a handmade indigo canvas tote bag partially visible, tailor scissors and white chalk, pale blue daylight from a Santa Monica studio window. Close cropped garment-focused still life, rich natural denim grain and stitching, understated fashion editorial, real photographic lens and soft shadows. No people, no faces, no signage, no words, no text, no logos, no brand labels, no existing brand references. This is illustrative brand imagery, not a documentary photo of an actual shop.”
