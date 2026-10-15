# Rufcut contact message

The existing SMS links in Visit now open a two-step local message dialog. The visitor first chooses Repair, Fitting or Information, then enters their name and, optionally, email. The preview uses a separate message for each choice. A blank email is omitted entirely.

Open Messages opens an SMS draft addressed to the shop's existing number, +1 310 473 5384. The visitor sends the message in their own app; opening the dialog never sends anything or creates an appointment. The shop confirms appointments by replying. Copy message supports desktop visitors. Personal details stay in page memory and are not written to storage or posted to a server.

The existing link elements and data-ms-field IDs remain intact. If the script or dictionary fails to load, their original SMS links remain available. Escape, close, backdrop click and focus return are supported. New text has English, Turkish, Spanish, German and French dictionaries. Both site themes and phone layouts use the existing brand tokens.

Verification: tests/contact.browser.mjs uses local Chrome and blocks external services. It checks all three choices, required name, optional email (including omission and invalid-email validation), message encoding, copy, text escaping, intent changes, keyboard/focus return, five languages and 320/390/1280 px layouts. No SMS or email is sent.

Run:

```sh
MS_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
MS_CHROME_PATH='/absolute/path/to/Chrome' node tests/contact.browser.mjs
```

Deployment files: index.html, contact.js, contact.css, and assets/lang/contact-{en,tr,es,de,fr}.json. No DNS, Square, payment or API changes are required.
