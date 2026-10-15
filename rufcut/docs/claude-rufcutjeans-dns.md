# Claude prompt: connect www.rufcutjeans.com to the new Rufcut website

**The prompt is not ready for a DNS write until the studio fills in the real hosting project and provider-issued DNS records below.** The current website preview is https://mrspace.online/rufcut/; this URL and its /rufcut/ path are not a DNS target.

The owner opens Claude in Chrome with their own authorized domain/Square account. Claude needs browser/domain-management access; the Square catalog MCP connector alone is not that access. If DNS is not managed through Square, use the actual domain provider account.

```text
I own Rufcut. Connect ONLY rufcutjeans.com and www.rufcutjeans.com to the new native Rufcut website. Use https://www.rufcutjeans.com as the canonical address.

Do not ask me to choose between my two domains. The selected domain is rufcutjeans.com. Leave rufcut.com and www.rufcut.com, their DNS/email records and the existing Square Online store unchanged. Do not disconnect rufcut.com from Square. The existing Square payment store can keep redirecting to rufcut.com; that is intentional and separate from the new rufcutjeans.com website.

New website preview: https://mrspace.online/rufcut/
Dedicated hosting project and actual production URL: [STUDIO MUST FILL THIS]
Exact provider-issued DNS records for rufcutjeans.com and www.rufcutjeans.com, including any required domain-verification records: [STUDIO MUST FILL TYPE, NAME, VALUE/TARGET]

First verify that the real hosting project serves the prepared standalone Rufcut site and has BOTH rufcutjeans.com and www.rufcutjeans.com registered as custom domains. Check the actual host instructions for canonical redirect and HTTPS. A DNS change alone cannot create missing host routing or the site deployment.

If the hosting project or exact DNS values above are missing, inspect only and ask for the missing values. Do not make any DNS changes. Never use the studio preview URL, its /rufcut/ path, a local file URL or an invented server address as the target. Do not create a paid service or transfer domain registration.

Using my explicitly connected accounts, locate the DNS management screen for rufcutjeans.com. It may be inside Square Domains or with a different provider; verify rather than assume. Let me complete login and permission steps. Never ask me to paste passwords, OAuth tokens or secret keys into chat.

Save the current records for rufcutjeans.com and show the exact before/after changes. Preserve its MX, SPF, DKIM, DMARC and unrelated verification records. Change only the provider-required website/verification records, without changing nameservers unless a separately reviewed plan requires it. Do not modify any records on rufcut.com or another domain.

Check the hosting preview: native product details, variations, photos/prices, repair/design forms and tracking must load. Buy links should reach the existing Square storefront/payment pages; ending on rufcut.com is expected. Do not point rufcut.com back to the new site or change the site's Square API setup.

Ask me to approve the exact record changes, apply those approved values, and verify that https://www.rufcutjeans.com opens the new Rufcut website. Verify apex canonical redirect, HTTPS, scripts/images/fonts, a product details page and its Square purchase destination. Compare email records and the untouched rufcut.com records with the saved snapshot. Account for DNS propagation rather than declaring completion from a saved dashboard alone.

Report changed records, hosting deployment, checks passed, pending items and the rollback procedure. Do not submit payments, refunds or shipping-label purchases. Let me perform the final controlled purchase myself. Do not claim success if the domain still shows the old site or if the hosting/DNS/HTTPS checks are incomplete.
```

Expected result after actual setup: **www.rufcutjeans.com → the studio's native Rufcut website → the existing Square-backed catalog and Square checkout.** The product integration already lives in the site; DNS is not a new Square account connection.

Official domain record guidance: https://squareup.com/help/us/en/article/6962-manage-dns-records
