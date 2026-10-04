// Mr. Space · Paket 1 site cizici
// Kurucu onizlemesi, onay ekrani ve yayin sayfasi ayni dosyayi kullanir.
(function () {
  const PRESETS = {
    liman:  { label: "Liman",  colors: { bg: "#f2f5f7", ink: "#15212b", accent: "#1d5c78", soft: "#dbe6ed" }, fonts: { head: "Bricolage Grotesque", body: "Source Sans 3" }, layout: "left",   radius: 6 },
    firin:  { label: "Fırın",  colors: { bg: "#fff9f2", ink: "#3b2618", accent: "#b8442b", soft: "#f2dfcc" }, fonts: { head: "Young Serif",         body: "Work Sans" },     layout: "center", radius: 14 },
    gece:   { label: "Gece",   colors: { bg: "#16171d", ink: "#f0ece3", accent: "#e2b34c", soft: "#24262f" }, fonts: { head: "Syne",                body: "Manrope" },       layout: "left",   radius: 2 },
    atolye: { label: "Atölye", colors: { bg: "#eef0e9", ink: "#1e221c", accent: "#4a6a3a", soft: "#dde3d3" }, fonts: { head: "Fraunces",            body: "IBM Plex Sans" }, layout: "left",   radius: 4 },
    kiyi:   { label: "Kıyı",   colors: { bg: "#ffffff", ink: "#1a1f24", accent: "#d0573a", soft: "#f0ebe4" }, fonts: { head: "DM Serif Display",    body: "DM Sans" },       layout: "center", radius: 999 },
  };

  const SECTION_TYPES = {
    hero:    "Giriş",
    about:   "Hakkımızda",
    menu:    "Menü / Fiyatlar",
    gallery: "Galeri",
    hours:   "Çalışma saatleri",
    contact: "İletişim",
    text:    "Serbest metin",
  };

  const DAYS = { en: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
                 tr: ["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi","Pazar"] };
  const WORDS = {
    en: { closed: "Closed", call: "Call", email: "Email", directions: "Directions", hours: "Hours", contact: "Contact", made: "Made by Mr. Space" },
    tr: { closed: "Kapalı", call: "Ara", email: "E-posta", directions: "Yol tarifi", hours: "Çalışma saatleri", contact: "İletişim", made: "Mr. Space yaptı" },
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => /^(https?:|mailto:|tel:)/i.test(String(u || "").trim()) ? String(u).trim() : "";
  const para = (t) => esc(t).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");

  function hexRgb(h) {
    let x = String(h || "").replace("#", ""); if (x.length === 3) x = x.split("").map((c) => c + c).join("");
    if (!/^[0-9a-f]{6}$/i.test(x)) return [0, 0, 0];
    return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
  }
  function lum(h) { return hexRgb(h).map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0); }
  const onColor = (h) => lum(h) > 0.4 ? "#111418" : "#ffffff";

  function themeOf(t) {
    const p = PRESETS[t?.preset] || PRESETS.liman;
    return {
      colors: { ...p.colors, ...(t?.colors || {}) },
      fonts: { ...p.fonts, ...(t?.fonts || {}) },
      layout: t?.layout || p.layout,
      radius: t?.radius ?? p.radius,
    };
  }

  function fontLink(f) {
    const fam = [...new Set([f.head, f.body])].filter(Boolean)
      .map((n) => "family=" + encodeURIComponent(n).replace(/%20/g, "+") + ":wght@400;600;700").join("&");
    return fam ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${fam}&display=swap" rel="stylesheet">` : "";
  }

  function css(t) {
    const c = t.colors, r = Math.min(Number(t.radius) || 0, 40);
    return `
:root{--bg:${c.bg};--ink:${c.ink};--accent:${c.accent};--soft:${c.soft};--on:${onColor(c.accent)};--r:${r}px;
 --head:"${t.fonts.head}",Georgia,serif;--body:"${t.fonts.body}",system-ui,-apple-system,"Segoe UI",sans-serif;
 box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
*,*::before,*::after{box-sizing:inherit}
html,body{margin:0}
body{background:var(--bg);color:var(--ink);font:17px/1.6 var(--body);-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
a{color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.w{max-width:1040px;margin:0 auto;padding:0 20px}
h1,h2,h3{font-family:var(--head);line-height:1.12;margin:0 0 .5em;font-weight:700;letter-spacing:-.01em}
h1{font-size:clamp(2.2rem,6vw,4rem)}
h2{font-size:clamp(1.6rem,3.6vw,2.4rem)}
h3{font-size:1.15rem}
p{margin:0 0 1em;max-width:62ch}
.top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-top:18px;padding-bottom:18px}
@media(max-width:640px){.top nav{display:none}}
.top .brand{display:flex;align-items:center;gap:12px;text-decoration:none;font-family:var(--head);font-weight:700;font-size:1.2rem}
.top .brand img{height:44px;width:auto}
.top nav{display:flex;gap:16px;flex-wrap:wrap;font-size:.95rem}
.top nav a{text-decoration:none;opacity:.8}
.top nav a:hover{opacity:1;text-decoration:underline}
section{padding:clamp(48px,8vw,96px) 0}
section.alt{background:var(--soft)}
.btn{display:inline-block;background:var(--accent);color:var(--on);text-decoration:none;padding:.8em 1.4em;border-radius:min(var(--r),999px);font-weight:600}
.btn.ghost{background:transparent;color:var(--ink);border:1.5px solid currentColor}
.hero{padding-top:clamp(24px,5vw,56px)}
.hero .grid{display:grid;gap:32px;align-items:center}
.hero .lead{font-size:1.2rem;opacity:.85}
.hero img{border-radius:var(--r);width:100%;aspect-ratio:4/3;object-fit:cover}
@media(min-width:820px){.hero .grid.has-img{grid-template-columns:1.1fr 1fr}}
.center .hero .grid,.center .head{text-align:center}
.center .hero p,.center .head p{margin-left:auto;margin-right:auto}
.center .hero .grid.has-img{grid-template-columns:1fr}
.center .hero img{max-width:760px;margin:0 auto}
.split{display:grid;gap:32px;align-items:center}
@media(min-width:820px){.split.has-img{grid-template-columns:1fr 1fr}}
.split img{border-radius:var(--r);width:100%;aspect-ratio:1/1;object-fit:cover}
.menu{display:grid;gap:36px}
@media(min-width:820px){.menu{grid-template-columns:1fr 1fr}}
.menu h3{border-bottom:1.5px solid var(--ink);padding-bottom:.4em;margin-bottom:.8em}
.item{display:grid;grid-template-columns:1fr auto;gap:2px 16px;margin-bottom:14px}
.item .n{font-weight:600}
.item .p{font-variant-numeric:tabular-nums;font-weight:600}
.item .d{grid-column:1/-1;opacity:.75;font-size:.95rem}
.gal{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
.gal figure{margin:0}
.gal img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:min(var(--r),18px)}
.gal figcaption{font-size:.85rem;opacity:.75;margin-top:4px}
.hours{width:100%;max-width:440px;border-collapse:collapse}
.center .hours{margin:0 auto}
.hours td{padding:8px 0;border-bottom:1px solid color-mix(in srgb,var(--ink) 15%,transparent)}
.hours td:last-child{text-align:right;font-variant-numeric:tabular-nums}
.contact{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
.center .contact{justify-content:center}
.addr{font-size:1.1rem}
footer{padding:36px 0 48px;font-size:.9rem}
footer .row{display:flex;flex-wrap:wrap;gap:12px 20px;justify-content:space-between;align-items:center;border-top:1px solid color-mix(in srgb,var(--ink) 18%,transparent);padding-top:20px}
footer .soc{display:flex;gap:14px;flex-wrap:wrap}
footer .made{opacity:.6;text-decoration:none}
footer .made:hover{opacity:1}
@media(prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
`;
  }

  // Onizleme filigrani: ust serit + arka planda tekrar eden soluk yazi
  function wmCss(text, ink) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='380' height='220'><text x='190' y='120' text-anchor='middle' transform='rotate(-24 190 110)' font-family='system-ui,sans-serif' font-size='21' font-weight='700' fill='${ink}'>${String(text).replace(/[<>&'"]/g, "")}</text></svg>`;
    return `
.ms-wm-bar{position:sticky;top:0;z-index:60;background:#111418;color:#fff;text-align:center;font:600 13px/1.3 system-ui,-apple-system,sans-serif;padding:10px 14px;padding-top:calc(10px + env(safe-area-inset-top,0px));margin-top:calc(-1 * env(safe-area-inset-top,0px))}
.ms-wm{position:fixed;inset:0;z-index:50;pointer-events:none;opacity:.10;background-image:url("data:image/svg+xml,${encodeURIComponent(svg)}")}
body.wm{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
body.wm img{-webkit-user-drag:none;user-drag:none;pointer-events:none}
`;
  }

  function hoursTable(biz, L, lang) {
    const h = biz.hours || [];
    if (!h.length) return "";
    const days = DAYS[lang] || DAYS.en;
    return `<table class="hours"><tbody>${days.map((d, i) => {
      const x = h[i] || {};
      const v = x.closed ? L.closed : (x.open && x.close ? `${esc(x.open)} – ${esc(x.close)}` : (x.note ? esc(x.note) : ""));
      return v ? `<tr><td>${d}</td><td>${v}</td></tr>` : "";
    }).join("")}</tbody></table>`;
  }

  function contactBlock(biz, L) {
    const tel = biz.phone ? `tel:${String(biz.phone).replace(/[^\d+]/g, "")}` : "";
    const map = biz.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.address)}` : "";
    return `${biz.address ? `<p class="addr">${esc(biz.address).replace(/\n/g, "<br>")}</p>` : ""}
      <div class="contact">
        ${tel ? `<a class="btn" href="${esc(tel)}">${L.call} ${esc(biz.phone)}</a>` : ""}
        ${biz.email ? `<a class="btn ghost" href="mailto:${esc(biz.email)}">${L.email}</a>` : ""}
        ${map ? `<a class="btn ghost" href="${esc(map)}" target="_blank" rel="noopener">${L.directions}</a>` : ""}
      </div>`;
  }

  function section(s, i, biz, L, lang) {
    const id = `s${i}`;
    const alt = i % 2 === 1 ? " alt" : "";
    switch (s.type) {
      case "hero": {
        const img = safeUrl(s.image);
        const url = safeUrl(s.button?.url);
        return `<section class="hero" id="${id}"><div class="w"><div class="grid${img ? " has-img" : ""}">
          <div><h1>${esc(s.title || biz.name)}</h1>${s.text ? `<p class="lead">${esc(s.text)}</p>` : ""}
          ${url && s.button?.label ? `<a class="btn" href="${esc(url)}">${esc(s.button.label)}</a>` : ""}</div>
          ${img ? `<img src="${esc(img)}" alt="${esc(s.image_alt || biz.name || "")}">` : ""}
        </div></div></section>`;
      }
      case "about":
      case "text": {
        const img = safeUrl(s.image);
        return `<section class="${alt.trim()}" id="${id}"><div class="w"><div class="split${img ? " has-img" : ""}">
          <div class="head">${s.title ? `<h2>${esc(s.title)}</h2>` : ""}${para(s.text)}</div>
          ${img ? `<img src="${esc(img)}" alt="${esc(s.image_alt || s.title || "")}">` : ""}
        </div></div></section>`;
      }
      case "menu":
        return `<section class="${alt.trim()}" id="${id}"><div class="w">
          <div class="head">${s.title ? `<h2>${esc(s.title)}</h2>` : ""}${s.text ? `<p>${esc(s.text)}</p>` : ""}</div>
          <div class="menu">${(s.groups || []).map((g) => `<div>${g.name ? `<h3>${esc(g.name)}</h3>` : ""}
            ${(g.items || []).map((it) => `<div class="item"><span class="n">${esc(it.name)}</span><span class="p">${esc(it.price)}</span>${it.desc ? `<span class="d">${esc(it.desc)}</span>` : ""}</div>`).join("")}
          </div>`).join("")}</div></div></section>`;
      case "gallery":
        return `<section class="${alt.trim()}" id="${id}"><div class="w">
          ${s.title ? `<div class="head"><h2>${esc(s.title)}</h2></div>` : ""}
          <div class="gal">${(s.images || []).filter((g) => safeUrl(g.url)).map((g) =>
            `<figure><img loading="lazy" src="${esc(safeUrl(g.url))}" alt="${esc(g.alt || "")}">${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ""}</figure>`).join("")}</div>
        </div></section>`;
      case "hours":
        return `<section class="${alt.trim()}" id="${id}"><div class="w"><div class="head"><h2>${esc(s.title || L.hours)}</h2>${s.text ? `<p>${esc(s.text)}</p>` : ""}</div>${hoursTable(biz, L, lang)}</div></section>`;
      case "contact":
        return `<section class="${alt.trim()}" id="${id}"><div class="w"><div class="head"><h2>${esc(s.title || L.contact)}</h2>${s.text ? `<p>${esc(s.text)}</p>` : ""}${contactBlock(biz, L)}</div></div></section>`;
      default: return "";
    }
  }

  function render(content, themeIn, opts = {}) {
    const c = content || {};
    const biz = c.business || {};
    const lang = c.lang === "tr" ? "tr" : "en";
    const L = WORDS[lang];
    const t = themeOf(themeIn);
    const secs = (c.sections || []).filter((s) => SECTION_TYPES[s.type]);
    const nav = secs.map((s, i) => s.type !== "hero" && s.nav !== false && (s.title || SECTION_TYPES[s.type])
      ? `<a href="#s${i}">${esc(s.nav_label || s.title || (s.type === "hours" ? L.hours : s.type === "contact" ? L.contact : SECTION_TYPES[s.type]))}</a>` : "").join("");
    const logo = safeUrl(biz.logo);
    const soc = Object.entries(biz.socials || {}).filter(([, u]) => safeUrl(u))
      .map(([k, u]) => `<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener">${esc(k.charAt(0).toUpperCase() + k.slice(1))}</a>`).join("");
    const title = esc(biz.name || "Site");
    const desc = esc(biz.tagline || "");

    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}${desc ? " · " + desc : ""}</title>
${desc ? `<meta name="description" content="${desc}">` : ""}
${logo ? `<link rel="icon" href="${esc(logo)}">` : ""}
${opts.noindex ? '<meta name="robots" content="noindex">' : ""}
${fontLink(t.fonts)}<style>${css(t)}${opts.watermark ? wmCss(opts.watermark, t.colors.ink) : ""}</style></head>
<body class="${t.layout === "center" ? "center" : "left"}${opts.watermark ? " wm" : ""}"${opts.watermark ? ' oncontextmenu="return false"' : ""}>
${opts.watermark ? `<div class="ms-wm-bar">${esc(opts.watermark)}</div><div class="ms-wm" aria-hidden="true"></div>` : ""}
<header class="w top"><a class="brand" href="#">${logo ? `<img src="${esc(logo)}" alt="">` : ""}<span>${title}</span></a><nav>${nav}</nav></header>
<main>${secs.map((s, i) => section(s, i, biz, L, lang)).join("")}</main>
<footer><div class="w row"><span>© ${new Date().getFullYear()} ${title}</span><span class="soc">${soc}</span>
<a class="made" href="https://mrspace.online/" target="_blank" rel="noopener">${L.made}</a></div></footer>
</body></html>`;
  }

  function starter(name, lang) {
    return {
      lang: lang || "en",
      business: { name: name || "", tagline: "", phone: "", email: "", address: "", logo: "", hours: Array.from({ length: 7 }, () => ({ open: "", close: "", closed: false })), socials: {} },
      sections: [
        { type: "hero", title: name || "", text: "", image: "", button: { label: "", url: "" } },
        { type: "about", title: "", text: "", image: "" },
        { type: "hours", title: "" },
        { type: "contact", title: "" },
      ],
    };
  }

  window.MsRender = { PRESETS, SECTION_TYPES, render, starter, themeOf };
})();
