# Heron + Laloo control in Mr. Space

`/admin/` now has a **Site yönetimi** view with a quick-control surface and a **Tam yönetim** view for each site. The latter reuses the complete Laloo and Heron admin screens from their source files, hosted under the Mr. Space admin origin. Laloo inherits the existing Mr. Space login and its admin RLS policy; Heron calls its existing admin API through the server proxy.

Quick controls can edit Laloo map places and businesses, moderate suggestions, and enable or disable cities. Place search is performed against the live table and returns at most 100 matches. The complete Laloo source panel is embedded too: stats, starred locations, business signup, municipalities, suggestions, Reddit moderation, stories, reviews, members and settings. Heron's embedded panel includes item creation, inventory, eBay import, publishing, offers, catalog and receipts. Heron's Google Aerial video test stays in the original admin because its existing Google key is restricted to Heron's domains.

Heron remains in its own Supabase project and Square integration. `supabase/functions/ms-site-control/index.ts` is a narrow authenticated proxy: it verifies the Mr. Space admin JWT, accepts only existing Heron admin actions, and forwards a verified super-admin session (or uses an existing legacy server password secret). The password is never sent to the browser. The Heron admin page hosted in Mr. Space uses the same proxy, so every existing Heron action is covered.

## One-time Heron bridge setup

The new bridge accepts the existing Mr. Space super-admin session. It does not require copying Heron's password. These changes are prepared for review and have not been deployed.

1. Apply `ms/mrspace-control-access.sql` in `tizfdnsjhhepxnqqrzuk`. The RPC checks current admin membership, confirmed user identity and an active matching Auth session. Normal members/viewers get no Heron access.
2. Deploy the companion Heron `heron-shop` change in `wvvizyrroqejwrfadbpx`, including `mrspace-auth.ts`. Its source was taken from live version 18; only the admin authorization gate changes. Heron's existing password login remains available. The bridge calls a fixed Mr. Space RPC with the forwarded JWT; its publishable API key is public, not a server secret.
3. Deploy `ms-site-control` in the Mr. Space project with JWT verification **enabled**. If an existing `HERON_ADMIN_PASSWORD` secret is configured, that legacy route still works. Otherwise the verified current user JWT is forwarded server-to-server. Missing Heron support shows a setup message.
4. Publish both static site changes after approval. Test read access, then a disposable product/offer and the activity log before operational use. A successful read alone does not prove write access.

Laloo controls continue to use the current Mr. Space admin identity and existing RLS. No password/key enters the browser. The proxy retains its action allowlist. Removing an admin or revoking the Auth session stops new Heron bridge requests.

## Shared visual editor

Heron and Laloo public home pages load `assets/ms-editor-bridge.js` from Mr. Space only when embedded. Only the actual parent on the exact Mr. Space origin can request an export; response origin, frame and nonce are checked. Both ends remove executable/form content. The editor renders the DOM snapshot in a sandbox without script permission. Public paths are allowlisted; private admin pages are excluded.

`/edit/` and `/request/` remain the single editor for all sites. Text/photo proposals become normal review requests; they do not mutate production. Dynamic Heron catalogs and Laloo maps are excluded from snapshot editing and use native admin tools. A static snapshot does not demonstrate live checkout, map or stock interaction. Mr. Space and both companion site releases are required before the cross-domain editor can work.

Rufcut customer pages, easy editor, visual editor and panel use English without changing the studio's saved language preference.

Successful Heron write actions and Laloo admin changes record a short summary in the Mr. Space activity log (`ms_activity`). The log omits product/place IDs, customer data, and submitted content; a log insert failure never blocks the underlying admin action.

## Shared platform checks and previews

The native quick-control setup above is unchanged. New connection status and review screens additionally require `ms/mrspace-platform.sql`. `check_connections` stores read-check results and timestamps; it does not prove write operations, mail or delivery. `preview_snapshot` reads only registered allowlisted HTTPS sites with bounded redirects, body size and time. The browser uses a script-free sandbox. Source is ready in the review branch; these additions have not been deployed.
