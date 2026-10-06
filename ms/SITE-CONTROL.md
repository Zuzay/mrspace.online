# Heron + Laloo control in Mr. Space

`/admin/` now has a **Site yönetimi** view with a quick-control surface and a **Tam yönetim** view for each site. The latter reuses the complete Laloo and Heron admin screens from their source files, hosted under the Mr. Space admin origin. Laloo inherits the existing Mr. Space login and its admin RLS policy; Heron calls its existing admin API through the server proxy.

Quick controls can edit Laloo map places and businesses, moderate suggestions, and enable or disable cities. Place search is performed against the live table and returns at most 100 matches. The complete Laloo source panel is embedded too: stats, starred locations, business signup, municipalities, suggestions, Reddit moderation, stories, reviews, members and settings. Heron's embedded panel includes item creation, inventory, eBay import, publishing, offers, catalog and receipts. Heron's Google Aerial video test stays in the original admin because its existing Google key is restricted to Heron's domains.

Heron remains in its own Supabase project and Square integration. `supabase/functions/ms-site-control/index.ts` is a narrow authenticated proxy: it verifies the Mr. Space admin JWT, accepts only existing Heron admin actions, and keeps Heron's admin password in a Supabase Function secret. The password is never sent to the browser. The Heron admin page hosted in Mr. Space uses the same proxy, so every existing Heron action is covered.

## One-time Heron bridge setup

1. In the `tizfdnsjhhepxnqqrzuk` Supabase project, add the existing Heron admin password as the Edge Function secret `HERON_ADMIN_PASSWORD`.
2. Deploy `supabase/functions/ms-site-control/index.ts` to that same project with JWT verification **enabled**.
3. Publish the Mr. Space static-site changes in this branch.
4. Sign in to `/admin/` with an account whose email is in `ms_admins`. Open **Site yönetimi**, choose a site, then **Tam yönetim**. Check with a disposable product/offer before operational use.

If the secret is missing, Heron controls show a setup message and the existing Heron admin link remains available. No database migration is required. Keep the secret only in Supabase Function secrets; do not add it to GitHub, HTML, or local config files.

No database migration is needed for the Laloo quick controls. The copied native panels continue to use their existing Supabase RLS and feature handlers. The Mr. Space project has one new server-side secret to configure for Heron before the embedded Heron panel can load.

Successful Heron write actions and Laloo admin changes record a short summary in the Mr. Space activity log (`ms_activity`). The log omits product/place IDs, customer data, and submitted content; a log insert failure never blocks the underlying admin action.
