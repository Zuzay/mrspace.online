# Customer content publishing

Rufcut is explicitly authorized by Uzay to publish existing text, photos and flat colour fields without worker/admin review. All other sites retain the normal request flow. Entry: `/edit/?site=rufcut`, shared engine: `/request/?self=rufcut`.

`ms-content` verifies the real Supabase user and current site membership for every private operation. A capability link alone cannot publish. Server `manifest.ts` allows stable fields, not arbitrary CSS selectors, code, links, payments or attribution. Photo replacements must be immutable uploads in `ms-media/rufcut/`; no remote fetch of customer-selected hosts. Text uses textContent. Text edits apply to the language selected in the editor; photos and colours apply to all languages.

The public website reads the current data revision. A publish transaction locks the site row and checks its expected revision and request UUID. A stale tab receives a conflict; retries of the last committed UUID are idempotent. No model or worker runs for publication. Keep `enabled=false` until the runtime and private API have both been deployed and verified.

## Daily archives

A change day uses America/Los_Angeles. Before its first successful publish, the server captures the current static website files (HTML, CSS, JavaScript, fonts, original images and language dictionaries) and previously published uploaded photos. Each archive also contains the complete published content map, revision, capture time and file SHA-256 hashes. Downloads must succeed; private Storage upload must succeed before the SQL transaction can publish. Within that day, all further publishes retain the original daily snapshot. Days without changes do not rotate anything.

Only the newest five change-day records are retained. The sixth snapshot is committed before the oldest enters the cleanup queue. Storage deletion runs after commit; failures remain queued and retry on future publishes. No public/customer archive access or self-restore exists. Customer text explains that restoration is paid and completed within 24 hours after payment confirmation. No restoration price has been invented and no automatic invoice is created.

Archives are private in bucket `ms-site-backups`; tables are `ms_site_content`, `ms_site_content_backups`, `ms_site_content_gc`. They have RLS and no anon/authenticated table grants. The status/publish RPCs are service_role only. `ms-content` action `backups` requires a real Mr. Space admin and returns signed archive download links expiring in 60 seconds. These archives contain public website files only, not private jobs, billing or customer records.

For a paid restoration, Mr. Space downloads the selected JSON through the admin-only action, verifies the file hashes, restores archived files through a reviewed PR and restores the archived content map using service_role. Do not expose this operation to the customer or overwrite jobs/billing. Preserve the current version before restoration. Archives are recovery packages, not a click-to-run standalone deployment. Any future new public dependency must also be added to backupFiles. A failed/uncertain publication can leave an unreferenced private archive. The next publish reconciles such objects only after they are 24 hours old and confirms they are not retained snapshots. Never delete a backup merely because a network request timed out.

## Validation

`tests/self-publish.edge.mjs` checks membership, field boundaries, unsafe images/colours, stale versions, archive failures and private archive denial. `tests/self-publish.browser.mjs` checks five languages, mobile preview, conflict retry, successful publication and reload using an isolated mocked backend. SQL integration checks retention, same-day idempotency, stale versions, backup-required rejection and privilege isolation inside transactions that roll back; they create no real work records.
