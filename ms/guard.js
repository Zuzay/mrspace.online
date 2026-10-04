/* Mr. Space site guard.
   <script src="https://mrspace.online/ms/guard.js" data-site="SLUG" defer></script>
   - If the site is suspended (late payment or paused by Mr. Space), shows a polite break screen.
   - data-badge="on" adds the small "Made by Mr. Space" mark at the bottom right.
   Fails open: if the check cannot be reached, the site simply keeps working. */
(function () {
  "use strict";
  var SB_URL = "https://tizfdnsjhhepxnqqrzuk.supabase.co";
  var SB_KEY = "sb_publishable_DcfxBTRo0n2m1go5_yYjkw_qNzD6ie6";
  var me = document.currentScript || document.querySelector('script[src*="ms/guard.js"]');
  if (!me) return;
  var slug = me.getAttribute("data-site");
  var css = "#ms-break{position:fixed;inset:0;z-index:2147483647;background:#0E1014;color:#F4F5F3;display:grid;place-items:center;padding:24px;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;text-align:center}" +
    "#ms-break .b{max-width:440px;display:grid;gap:16px;justify-items:center}" +
    "#ms-break i{width:46px;height:46px;border-radius:50%;background:#F4F5F3;display:grid;place-items:center}" +
    "#ms-break i:after{content:'';width:16px;height:16px;border-radius:50%;background:#F6B93B}" +
    "#ms-break h1{font-size:28px;line-height:1.15;margin:0}#ms-break p{margin:0;color:#C9CED8}" +
    "#ms-break a{color:#F6B93B;font-size:13px;letter-spacing:.06em;text-transform:uppercase;text-decoration:none}" +
    "#ms-badge{position:fixed;right:10px;bottom:10px;z-index:2147483646;display:flex;align-items:center;gap:6px;background:#0E1014e6;color:#F4F5F3;font:500 10px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;padding:6px 9px;border-radius:99px;text-decoration:none}" +
    "#ms-badge:before{content:'';width:8px;height:8px;border-radius:50%;background:#F6B93B}";
  function style() { var s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); }
  function badge() {
    if (me.getAttribute("data-badge") !== "on") return;
    var a = document.createElement("a"); a.id = "ms-badge"; a.href = "https://mrspace.online/"; a.target = "_blank"; a.rel = "noopener"; a.textContent = "Made by Mr. Space";
    document.body.appendChild(a);
  }
  function pause(msg) {
    var d = document.createElement("div"); d.id = "ms-break"; d.setAttribute("role", "alert");
    var b = document.createElement("div"); b.className = "b";
    b.innerHTML = "<i></i><h1></h1><p></p><a href='https://mrspace.online/' target='_blank' rel='noopener'>Site by Mr. Space</a>";
    b.querySelector("h1").textContent = "Be right back.";
    b.querySelector("p").textContent = msg || "This site is taking a short break. It will be back soon.";
    d.appendChild(b); document.body.appendChild(d); document.documentElement.style.overflow = "hidden";
  }
  // Kendi paneli olan siteler kayit gonderebilir: <script ... data-key="SITE_KEY">, sonra MrSpace.log("Item added", 2)
  var key = me.getAttribute("data-key");
  window.MrSpace = { log: function (action, minutes) {
    if (!key || !window.fetch) return Promise.resolve(false);
    return fetch(SB_URL + "/rest/v1/rpc/ms_log_event", { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_key: key, p_action: String(action || ""), p_minutes: minutes || 0 }) }).then(function (r) { return r.ok; }).catch(function () { return false; });
  } };
  function run() {
    style(); badge();
    if (!slug || !window.fetch) return;
    var ctl = window.AbortController ? new AbortController() : null;
    if (ctl) setTimeout(function () { ctl.abort(); }, 5000);
    fetch(SB_URL + "/rest/v1/rpc/ms_site_state", {
      method: "POST", signal: ctl ? ctl.signal : undefined,
      headers: { apikey: SB_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_slug: slug })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (s) { if (s && s.suspended) pause(s.message); })
      .catch(function () {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
