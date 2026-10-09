# Rufcut clickable system guide

English customer handover guide: `rufcut/docs/rufcut-system-guide.pdf`.
Public copy: https://mrspace.online/rufcut/docs/rufcut-system-guide.pdf

The nine-page PDF uses screenshots from the actual UI, sample customer records, external link annotations, internal contents navigation and PDF bookmarks. It contains no passwords, site keys or customer records. It distinguishes a workshop request from a payment receipt and clearly states that Rufcut email delivery is awaiting handover setup.

## Rebuild

Start a static server at the repository root. Use the available Playwright and Chrome executables:

```sh
MS_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs MS_CHROME_PATH=/path/to/chrome MS_PREVIEW_ORIGIN=http://127.0.0.1:4174 node ms/guides/capture-rufcut-guide.mjs
python3 ms/guides/build-rufcut-guide.py
```

`capture-rufcut-guide.mjs` blocks external network calls and runs the actual work-order handlers against isolated test data. Screenshots go to `/private/tmp/rufcut-guide` or `MS_GUIDE_ASSETS`. It does not send live orders, emails or push messages. A broken ticket image fails capture via `Image.decode`.

The builder uses ReportLab and macOS Arial/Impact font files. Set `MS_GUIDE_OUTPUT` to change its default `output/pdf/rufcut-system-guide.pdf` output. Render all pages with Poppler, inspect every page and check link annotations with pypdf before copying the approved result to `rufcut/docs/rufcut-system-guide.pdf`. Intermediate captures and rendered pages stay outside Git.

For updates, match button names to the live interface and refresh screenshots after layout changes. Keep the guide focused on the shop's daily tasks, not implementation details. The PDF is intentionally English for Rufcut.
