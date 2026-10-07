# mrspace.online (v2)

Mr. Space web stüdyosu sitesi. Ekim 2026 planına göre yeniden yazıldı.

## Sayfalar
- `index.html` : Ana sayfa. Giriş + kontrol paneli, ne yapıyoruz (site / sistem / bakım), "Made to measure" (her şey sana özel yazılır), işler (canlı site iframe + "Your Brand" admin paneli + "Watch the tour" butonuyla açılan animasyon), süreç, paketler özeti, iletişim.
- `packages/` : Paket 1-2-3, ilk müşteri indirimi, karşılaştırma tablosu, ekler, saatlik ücret, Custom çıkış bedeli, değişiklik kotası, kurallar, SSS.
- `first-clients/` : İlk müşteri (launch offer) sayfası. Normal fiyatların üstü çizili, $300 kurulum, $50/ay, eklentiler dahil, değişiklik kotası iki katı. Ana sayfa ve paketler sayfasındaki siyah şerit buraya gider.
- `start/` : Dallanan başvuru formu (8 adım). POS, scanner, printer, etiket, mevcut site, sosyal medya, örnek siteler. Sunucu yok: "Send by email" mail uygulamasını hazır metinle açar, "Copy answers" panoya kopyalar. Taslak sadece ziyaretçinin cihazında saklanır.
- `rufcut/` : Eski Rufcut konsept demosu, dokunulmadı.
- `404.html`, `sitemap.xml`, `robots.txt`, `CNAME`, `og.png`

## Ortak dosyalar
- `assets/site.css` : Renkler, yazılar, cetvel, butonlar, etiket kartları. Açık ve koyu tema.
- `assets/demos.css` + `assets/demos.js` : Demo oynatıcı. Her demo bir dakikanın altında, sessiz, döngüde. Ekrandan çıkınca durur, adıma tıklayınca oraya atlar, "hareketi azalt" ayarında duraklatılmış başlar.
- `assets/laloo-logo.png`

## Demoları değiştirmek
`assets/demos.js` içinde üç tanım var: `HERON`, `RUFCUT`, `LALOO`. Her birinde `chapters` (adım adları), `html` (ekranın içeriği) ve `run` (senaryo) var. Senaryo komutları: `a.scene()`, `a.url()`, `a.go()`, `a.tap()`, `a.type()`, `a.toast()`, `a.wait()`.

## Yapılacaklar
- hello@mrspace.online çalışıyor mu kontrol et.
- Form için ileride: Supabase'e kayıt + otomatik mail (şu an mail uygulaması üzerinden).
- Rufcut kabul ederse etiketi "Client" olarak kalır; etmezse `index.html` içinde "Concept" yap.

## Tıklama sayacı
GoatCounter kullanılıyor (ücretsiz, çerezsiz). goatcounter.com'da "mrspace" kodlu hesap açılınca sayılar mrspace.goatcounter.com'da görünür:
- `tour/heron`, `tour/laloo`, `tour/rufcut` : "Watch the tour" tıklamaları
- `explore/...` : canlı sitede "Tap to explore"
- `open/...` : "Open site" linkleri

## Talepler v2: sitenin üstünde düzenleme ve sürümler (Ekim 2026)
- `request/?k=ANAHTAR` artık müşterinin kendi tasarımını açar. Parçanın üstüne gelince "Edit me", tıklayınca sisli kutu açılır; yazdıkça sitede canlı görünür. Fotoğraf yerine resim linki yapıştırılırsa anında yerine oturur.
- Gönderince bitiş ekranında ve mailde `request/?e=DÜZELTME_ANAHTARI` linki çıkar. Müşteri geri dönüp ekler, değiştirir, kaldırır. Onaylanmış/bitmiş işler kilitlidir.
- Her gönderim bir sürüm (v1, v2...). Panelde **Sürümler**: iki sürüm yan yana, kelime kelime fark, "A sürümüne dön". Taleplerde revize edilmiş olanların yanında `v2` etiketi var.
- Kurulum: `ms/mrspace-requests-v2.sql` (sistem SQL'inden sonra). Mail için Resend anahtarı: `select vault.create_secret('re_XXXX', 'resend_key');` (anahtar yoksa mail gitmez, gerisi çalışır).
- Tasarımlarda düzenlenmesin istenen parçaya `data-ms-skip`, özellikle düzenlenebilir olsun istenen bloğa `data-ms-edit`.
- Yerinde düzenleme tasarım mrspace.online altında durduğu sürece çalışır; başka alan adındaki sitelerde sayfa düz not formuna düşer.
- Kontrol listesi: talep sayfası müşteriyi tasarımın başından sonuna adım adım götürür. Her adımda bir yönlendirme ("Enter your real opening hours" gibi) ve "Looks good / Change it" var. Adımlar tasarımda `data-ms-step="ipucu"` ile yazılır, birden çok parçayı kapsayan bloklara `data-ms-group` eklenir. Etiket yoksa sayfadaki başlık ve metinlerden otomatik liste çıkar. Onaylananlar `ms/mrspace-requests-v2b.sql` ile saklanır, panelde Sürümler kartında sayısı görünür.

## Müşteri paneli + Square (Ekim 2026)
- `panel/` : Müşterinin kendi paneli (mrspace.online/panel). Giriş kullanıcı adıyla (`rufcut` → `rufcut@mrspace.online`). Sekmeler: Genel bakış, Stok, Etiketler. Girişsiz "Örnek verilerle bak" demo modu var.
- Square: müşteri panelde "Connect Square" der, kendi hesabıyla onay verir. Stok ve fiyatlar Square'den canlı gelir, sayı değiştirince Square'de de değişir, "Add item" yeni ürünü Square'e ekler. İstenirse stok sitede de gösterilir (`ms-square/public?site=...`).
- Etiket: Code 128 barkod (SKU), fiyat, beden, dükkan adı. 2.25×1.25 in (Rollo/Zebra/Dymo 30334), 2×1, 1.5×1, 3×2 in ve Brother 62×29 mm. Barkod Square kasasında okutulunca ürün bulunur.
- Kurulum:
  1. `ms/mrspace-square.sql` (SQL Editor).
  2. developer.squareup.com'da "Mr. Space" uygulaması. OAuth > Redirect URL: `https://tizfdnsjhhepxnqqrzuk.supabase.co/functions/v1/ms-square/callback`
  3. Supabase > Edge Functions: `supabase/functions/ms-square/index.ts` deploy, "Enforce JWT verification" KAPALI. Secrets: `SQUARE_APP_ID`, `SQUARE_APP_SECRET`, `SQUARE_ENV` (`production` veya deneme için `sandbox`).
  4. Authentication > Users > Add user: `rufcut@mrspace.online`, şifre, Auto confirm. Panel erişimi admin panelinde site kartındaki "Panel erişimi" ile verilir.
- Square anahtarları `ms_square` tablosunda, politikası yok: sadece fonksiyon okur, panel ve REST göremez.

## Rufcut tamir iş emirleri
- `rufcut/repair/`: ayrı tamir başvuru sayfası. Giysi ve kadın/erkek kalıbı seçilir, kırmızı sis işaretleri doğrudan giysi çizimi üstünde taşınır, birden çok parça ve ölçü/not girilebilir.
- `panel/` içindeki **Repairs** sekmesi yalnızca Rufcut hesabına görünür; görsel, müşteri bilgileri, fiş numarası, iş durumu, prova ölçüleri ve atölye notları tek iş emrinde tutulur.
- Rufcut ana sayfasındaki takip alanı aynı fiş numarasından gerçek durumu sorgular. Durumlar: received, in progress, finishing (yarına hazır), ready, completed.
- Kurulum: `ms/mrspace-repair.sql` çalıştır, `supabase/functions/ms-repair/index.ts` fonksiyonunu deploy et ve `verify_jwt=false` ayarıyla yayınla. İsteğe bağlı e-posta bildirimi için `RESEND_API_KEY` ve `RESEND_FROM_EMAIL` secrets ekle. Kod e-posta göndermeden de iş emrini ve takibi kaydeder.
- `ms_repair_jobs` tablosunda RLS açık ve doğrudan istemci erişimi kapalıdır. Tarayıcı yalnızca Edge Function'ı çağırır; Rufcut çalışanı panel oturumuyla yetkilendirilir.

## Birleşik site yönetimi (Ekim 2026)
- Mr. Space `/admin/` içindeki **Site yönetimi** bölümünden Laloo ve Heron'un hızlı kontrolleri ve tam panelleri açılır.
- Heron köprüsü için gereken secret, güvenlik sınırları ve yayın adımları: [`ms/SITE-CONTROL.md`](ms/SITE-CONTROL.md).
- Başarılı Laloo/Heron yönetim değişiklikleri hassas içerik taşımayan kısa kayıt olarak `ms_activity` tablosuna yazılır.
