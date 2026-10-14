# Rufcut owner: Square and your own coding assistant

Your products and orders stay in your own Square account. Your website can be edited with your own Claude or Codex account after you connect the dedicated Rufcut source repository and website host. Those are separate account permissions; an AI subscription alone does not connect them.

## Daily products, without the Mr. Space panel

1. In Square, create a product. Put sizes/fabrics/styles under that product as **variations**; they appear as choices on one website card.
2. Add a category to group the website. Jeans, Outerwear, Shirts and Accessories use the existing shop sections. You can create your own category, such as Vintage Finds. If there are several categories, the first ordinary category is the website group.
3. Use Workshop or Repairs for service sections. Use **Website hidden** or archive the product to keep an internal product/deposit off the website. Square Online's own category visibility control is separate from this website's rules.
4. Change the name, buyer-facing name, photo, description, price or stock in Square. Reload the website after about 30 seconds. An already open page does not refresh itself.
5. To sell online, also publish the product for sale in **Square Online**, with the correct variation, shipping/pickup and tax settings. Website details link to the Square product/payment page. A POS-only product can appear on the website without an online payment link; it shows a contact option until online sale is configured.

Existing internal/hidden/review records are kept off the website until you intentionally categorize them. Assigning an ordinary category makes that record public. Check deposits and internal services before assigning categories in bulk. Existing studio hide controls can also suppress records; ask the studio if an item remains hidden after these checks.

## Use your own assistant for website changes

Open the **Rufcut-only** source repository in your assistant and ask:

> Read OWNER-AI.md first. Change [describe the website change]. Keep product IDs, Square checkout, contact information, repair submission and tracking working. Show a preview and the changed files, test mobile and desktop, and open a pull request. Wait for my publication approval.

You own the GitHub and hosting access you grant. Product edits do not require giving your assistant a Square secret or using its API. If you want it to change Square directly, connect an integration authorized against your own Square merchant account with the appropriate permissions first; this handover does not install one.

Do not paste passwords, card data, Square OAuth tokens or Supabase service keys into prompts or public source files. The public website needs only its public API configuration. Studio backend access is per site; it does not give you other merchants' data or the studio's admin credentials.

## Before publishing a change

Check product photo/title links, size selection and price, the Square payment destination, phone/email, repair/design submission and ticket lookup. Check a phone screen. Publish the reviewed commit and keep the previous hosting deployment available to restore.

Domain setup must keep the Square payment store on a separate working hostname. If the Square address redirects back to this website's product details, contact the studio before publishing; that loop cannot complete checkout.
