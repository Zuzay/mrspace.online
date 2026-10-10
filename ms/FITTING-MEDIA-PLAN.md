# Rufcut fitting tickets and shared photo tools

Prepared on `feat/rufcut-fitting-media`. This is implementation work in progress, not a deployed capability.

## Integration boundary

PR #45 currently owns Rufcut HTML, the shared editor, panel HTML, `ms-repair`, notification helpers, language dictionaries and the work-order fixture. AGENTS.md rule 2 prohibits changing an open PR's files for a separate job. A coordination choice has been requested before integration. No PR #45 file has been changed in this branch.

## Fitting contract

Reuse `ms_repair_jobs`, the submission-token/rate-limit RPC, staff access checks and the shared work-order inbox. Introduce `kind=fitting` and fitting states received, confirmed, completed and cancelled. Keep existing repair/jeans states intact.

A customer supplies name/email, optional phone, reason, preferred day, time window and note. Dates use America/Los_Angeles, must be real calendar dates and may be up to 365 days ahead. These are preferences, not automatic slot reservations. Success requires a database-confirmed RC ticket. Failed sends retain a draft and retries reuse the token.

Staff confirms an actual date and local time, saves notes and prints the saved ticket. Confirmation must have a valid date/time. Previously confirmed dates may stay in the past when only notes change; changing to a different past slot is rejected. Viewers and other sites cannot read or update the job. Public tracking returns status and appointment confirmation only, never contact details or staff notes.

`rufcut/fitting/index.html` and `assets/ms-fitting-form.*` provide the standalone five-language form and customer tracker. It is not connected to the live backend or homepage yet. The form saves only preferences/token/fingerprint on the device; contact fields stay in the form, not localStorage.

`supabase/functions/_shared/fitting.ts` implements the input/date contract; `tests/fitting.mjs` covers timezone boundaries, impossible/past/out-of-range dates, arbitrary reason/time-window values, missing confirmation and past-slot changes.

## Shared photo preparation

`assets/ms-photo-studio.js/css`: local crop ratio, zoom, horizontal/vertical framing, 90-degree rotation, brightness/contrast, reset and cancel. Export one WebP at a maximum 1600-pixel edge. No AI imagery, no upload from the photo tool itself. Existing authenticated upload service remains responsible for storage. GIF editing exports one still image and states that explicitly.

`assets/ms-photo-deck.js/css`: validates a versioned photo-series object, preserves the original IMG and its stable editor ID, adds accessible previous/next/count controls and touch navigation. Manual slides, no automatic motion. The same module can be used by Rufcut or future sites. Up to six photos, at most 1700 serialized characters, safe HTTP(S) URLs without credentials, bounded alt text. It does not persist or publish an edit by itself.

Integrate series data with the existing shared editor's draft/review/approval contract. Do not silently turn Add to draft into live publication. Review cards must show slide count/order, before/after and photo descriptions. Failed uploads must retain successfully uploaded slides and retry only failed ones. Restoring an image must restore original src/srcset/sizes/alt/series.

## Remaining verification and handover

1. Resolve PR #45 coordination and integrate forms, schema constraints, backend, panel and editor using the existing systems.
2. Add meaningful handler and browser checks: retry/duplicate behavior, authorization, confirmation persistence, saved-ticket printing, upload failure, crop export, slide ordering/reload/undo, keyboard use, five languages, themes and mobile.
3. Capture the actual updated UI with mocked customer data; update the clickable English PDF and render every page for visual QA. Include fitting, photo preparation, slides and the existing sales/shipping preparation limits.
4. Publish only the authorized scope and verify live assets and read-only API contracts. No real customer notification or email during tests.
5. Finalize `ms/guides/rufcut-review-email.md` against actual published behavior. The email is a draft; no message has been sent and no recipient is assumed.
