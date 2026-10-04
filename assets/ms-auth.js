// Mr. Space: yonetici sayfalari (Onay, Fikirler) ana panelin oturumunu kullanir.
// Ayri giris yok. Panelde giris yapan yonetici bu sayfalari acabilir; demo ve izleyiciler acamaz.
window.msAdminGate = async function (sb, opts) {
  opts = opts || {};
  const panel = opts.panel || "../";
  const box = (html) => {
    document.body.innerHTML = '<div style="max-width:420px;margin:15vh auto;padding:24px;font:16px/1.5 system-ui,-apple-system,sans-serif;text-align:center">' + html + '</div>';
  };
  let s = null;
  try { s = JSON.parse(localStorage.getItem("ms_admin") || "null"); } catch (e) {}
  const now = Math.floor(Date.now() / 1000);
  if (!s || !s.access_token || !s.refresh_token || !(Number(s.expires_at) > now + 30)) {
    box('<p>Bu sayfa için önce panelden giriş yap.</p><p><a href="' + panel + '">Panele git</a></p>');
    return false;
  }
  const { error } = await sb.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
  if (error) {
    box('<p>Oturum açılamadı. Panelden tekrar giriş yap.</p><p><a href="' + panel + '">Panele git</a></p>');
    return false;
  }
  const { data: role } = await sb.rpc("ms_role");
  if (role !== "admin") {
    box('<p>Bu sayfa sadece yöneticiler için.</p><p><a href="' + panel + '">Panele dön</a></p>');
    return false;
  }
  return true;
};
