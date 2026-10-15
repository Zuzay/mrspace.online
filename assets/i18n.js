/* Mr. Space languages: English source, plus Español, Deutsch, Français, Türkçe.
   Picks the phone/browser language, remembers a manual choice, swaps text by matching the English HTML of each text block. */
(function () {
  "use strict";
  var LANGS = [["en", "EN"], ["es", "ES"], ["de", "DE"], ["fr", "FR"], ["tr", "TR"]];
  var CODES = LANGS.map(function (l) { return l[0]; });
  var INLINE = { B:1, STRONG:1, EM:1, I:1, SPAN:1, A:1, SMALL:1, BR:1, S:1, CODE:1, SUP:1, SUB:1, KBD:1, U:1 };
  var SKIP = { SCRIPT:1, STYLE:1, SVG:1, NOSCRIPT:1, TEMPLATE:1, IFRAME:1, TEXTAREA:1, SELECT:1 };
  var ATTRS = ["placeholder", "aria-label", "title"];
  var me = document.currentScript;
  var base = (me && me.src ? me.src.replace(/i18n\.js.*$/, "") : "/assets/") + "lang/";
  var source = (me && me.getAttribute("data-source")) || "en";
  var prefix = (me && me.getAttribute("data-dict")) || "";
  var dictVersion = (me && me.getAttribute("data-dict-version")) || "";

  function norm(s) { return String(s).replace(/\s+/g, " ").trim(); }
  function pick() {
    try { var saved = localStorage.getItem("ms_lang"); if (saved && CODES.indexOf(saved) > -1) return saved; } catch (e) {}
    var list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || source]);
    for (var i = 0; i < list.length; i++) { var c = String(list[i]).slice(0, 2).toLowerCase(); if (CODES.indexOf(c) > -1) return c; }
    return source;
  }
  // Rufcut has its own English customer experience, independent of the studio preference.
  var route = new URL(location.href);
  var forced = (me && me.getAttribute("data-force-lang")) || (/^\/rufcut(?:\/|$)/.test(route.pathname) || (/^\/(?:panel|edit)(?:\/|$)/.test(route.pathname) && route.searchParams.get("site") === "rufcut") ? "en" : "");
  var lang = CODES.indexOf(forced) > -1 ? forced : pick();
  if (lang !== source) document.documentElement.classList.add("i18n-wait");
  document.documentElement.lang = lang;

  /* every visible text node is translated on its own, so markup, ids and listeners stay untouched */
  function texts(root) {
    var out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
      for (var p = n.parentNode; p && p !== root.parentNode; p = p.parentNode) {
        if (p.nodeType === 1 && (SKIP[p.tagName] || p.hasAttribute("data-noi18n") || p.hasAttribute("data-demo"))) return NodeFilter.FILTER_REJECT;
      }
      return /[A-Za-zÀ-ÿĞğŞşİıÇçÖöÜü]{2}/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    } });
    while (w.nextNode()) out.push(w.currentNode);
    return out;
  }
  function collect(root) {
    root = root || document.body; var keys = [];
    texts(root).forEach(function (n) { var k = norm(n.nodeValue); if (keys.indexOf(k) < 0) keys.push(k); });
    root.querySelectorAll("[placeholder],[aria-label],[title]").forEach(function (el) {
      ATTRS.forEach(function (a) { var v = el.getAttribute(a); if (v && /[A-Za-z]{3}/.test(v)) { v = norm(v); if (keys.indexOf(v) < 0) keys.push(v); } });
    });
    return keys;
  }
  var DICT = null;
  function apply(root) {
    if (!DICT) return;
    root = root || document.body;
    texts(root).forEach(function (n) {
      if (n.__src == null) n.__src = norm(n.nodeValue);
      var tr = DICT[n.__src]; if (tr == null) return;
      var m = /^(\s*)[\s\S]*?(\s*)$/.exec(n.nodeValue);
      var v = m[1] + tr + m[2]; if (n.nodeValue !== v) n.nodeValue = v;
    });
    root.querySelectorAll("[placeholder],[aria-label],[title]").forEach(function (el) {
      ATTRS.forEach(function (a) {
        var v = el.getAttribute(a); if (!v) return;
        var k = "__src_" + a; if (!el[k]) el[k] = norm(v);
        var tr = DICT[el[k]]; if (tr != null) el.setAttribute(a, tr);
      });
    });
    var tt = DICT[norm(document.title)]; if (tt) document.title = tt;
  }
  function t(s) { return DICT && DICT[norm(s)] != null ? DICT[norm(s)] : s; }

  function switcher() {
    var host = document.querySelector("[data-lang-host]") || document.querySelector(".top .nav") || document.querySelector(".rail .me");
    if (forced || !host || document.getElementById("msLang")) return;
    var sel = document.createElement("select");
    sel.id = "msLang"; sel.setAttribute("aria-label", "Language"); sel.setAttribute("data-noi18n", "");
    sel.className = "lang-pick";
    LANGS.forEach(function (l) { var o = document.createElement("option"); o.value = l[0]; o.textContent = l[1]; if (l[0] === lang) o.selected = true; sel.appendChild(o); });
    sel.addEventListener("change", function () { try { localStorage.setItem("ms_lang", sel.value); } catch (e) {} location.reload(); });
    host.insertBefore(sel, host.firstChild);
  }
  function done() { document.documentElement.classList.remove("i18n-wait"); }

  window.MSI18N = { lang: lang, collect: collect, apply: apply, t: t, ready: null };
  var css = document.createElement("style");
  css.textContent = "html.i18n-wait body{visibility:hidden}.lang-pick{width:auto!important;flex:none;font:500 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.06em;background:transparent;color:inherit;border:1px solid currentColor;border-radius:99px;padding:6px 8px;opacity:.85;cursor:pointer}.lang-pick option{color:#121418}";
  document.head.appendChild(css);
  setTimeout(done, 2500);

  window.MSI18N.ready = new Promise(function (res) {
    function go() {
      switcher();
      if (lang === source) { done(); return res(); }
      fetch(base + prefix + lang + ".json" + (dictVersion ? "?v=" + encodeURIComponent(dictVersion) : ""), { cache: "force-cache" }).then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (d) { DICT = d; apply(); }).catch(function () {}).then(function () { done(); res(); });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
  });
})();
