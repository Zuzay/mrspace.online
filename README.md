# mrspace.online (v2)

Mr. Space web stüdyosu sitesi. Ekim 2026 planına göre yeniden yazıldı.

## Sayfalar
- `index.html` : Ana sayfa. Giriş + kontrol paneli, ne yapıyoruz (site / sistem / bakım), "Made to measure" (her şey sana özel yazılır), işler (canlı site iframe + "Your Brand" admin paneli + "Watch the tour" butonuyla açılan animasyon), süreç, paketler özeti, iletişim.
- `packages/` : Paket 1-2-3, ilk müşteri indirimi, karşılaştırma tablosu, ekler, saatlik ücret, Custom çıkış bedeli, değişiklik kotası, kurallar, SSS.
- `first-clients/` : İlk müşteri (launch offer) sayfası. Normal fiyatların üstü çizili, $300 kurulum, $50/ay, eklentiler dahil, değişiklik kotası iki katı. Ana sayfa ve paketler sayfasındaki siyah şerit buraya gider.
- `start/` : Dallanan başvuru formu (8 adım). POS, scanner, printer, etiket, mevcut site, sosyal medya, örnek siteler. “Submit project” özel admin başvuru kuyruğuna kayıt yapar ve gerçek makbuz numarası bekler (`ms-intake` kurulum gerektirir). E-posta ve kopyalama seçenekleri korunur. Başarısız gönderimde taslak ziyaretçinin cihazında kalır.
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
- Otomatik e-posta teslimatı ayrı kurulum gerektirir; başvuru özel Supabase kuyruğuna gerçek makbuzla kaydedilir.
- Rufcut kabul ederse etiketi "Client" olarak kalır; etmezse `index.html` içinde "Concept" yap.

## Tıklama sayacı
GoatCounter kullanılıyor (ücretsiz, çerezsiz). goatcounter.com'da "mrspace" kodlu hesap açılınca sayılar mrspace.goatcounter.com'da görünür:
- `tour/heron`, `tour/laloo`, `tour/rufcut` : "Watch the tour" tıklamaları
- `explore/...` : canlı sitede "Tap to explore"
- `open/...` : "Open site" linkleri

## Talepler v2: sitenin üstünde düzenleme ve sürümler (Ekim 2026)
- `request/?k=ANAHTAR` müşterinin sitesini bölüm listesiyle açar. Bölümden veya doğrudan sayfadan alan seçilir; konum, mevcut içerik ve önerilen değişiklik aynı yerde görünür. Fotoğraf dosyası yüklenebilir veya link verilebilir. Kaydetme taslağa ekler; gönderimden önce alanlar tek tek karşılaştırılır. Ayrıntılar: [ms/REQUEST-EDITOR.md](ms/REQUEST-EDITOR.md).
- Gönderince bitiş ekranında ve mailde `request/?e=DÜZELTME_ANAHTARI` linki çıkar. Müşteri geri dönüp ekler, değiştirir, kaldırır. Onaylanmış/bitmiş işler kilitlidir.
- Her gönderim bir sürüm (v1, v2...). Panelde **Sürümler**: iki sürüm yan yana, kelime kelime fark, "A sürümüne dön". Taleplerde revize edilmiş olanların yanında `v2` etiketi var.
- Kurulum: `ms/mrspace-requests-v2.sql` (sistem SQL'inden sonra). Mail için Resend anahtarı: `select vault.create_secret('re_XXXX', 'resend_key');` (anahtar yoksa mail gitmez, gerisi çalışır).
- Tasarımlarda düzenlenmesin istenen parçaya `data-ms-skip`, özellikle düzenlenebilir olsun istenen bloğa `data-ms-edit`.
- Yerinde düzenleme tasarım mrspace.online altında durduğu sürece çalışır; başka alan adındaki sitelerde sayfa düz not formuna düşer.
- Alan listesi sayfanın bölümlerine göre düzenlenir; arama metin ve fotoğraf alanlarını bulur. `data-ms-section` bölüm, `data-ms-label` alan adını belirtir. Rufcut açılış ve atölye fotoğrafları sabit kimliklerle bulunur. Eski kontrol listesi onayları veritabanında korunur; yeni editör alan seçimi, değişiklik karşılaştırması ve gönderim onayını kullanır.

## Müşteri paneli + Square (Ekim 2026)
- `panel/` : Müşterinin kendi paneli (mrspace.online/panel). Giriş kullanıcı adıyla (`rufcut` → `rufcut@mrspace.online`). Sekmeler: Çalışma alanı, Genel bakış, Stok, Etiketler ve Rufcut için İş emirleri. Girişsiz "Örnek verilerle bak" demo modu var.
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
- `panel/` içindeki **İş emirleri** sekmesi yalnızca Rufcut hesabına görünür; görsel, müşteri bilgileri, fiş numarası, iş durumu, prova ölçüleri ve atölye notları tek iş emrinde tutulur.
- Rufcut ana sayfasındaki takip alanı aynı fiş numarasından gerçek durumu sorgular. Durumlar: received, in progress, finishing (yarına hazır), ready, completed.
- Kurulum: `ms/mrspace-repair.sql` çalıştır, `supabase/functions/ms-repair/index.ts` fonksiyonunu deploy et ve `verify_jwt=false` ayarıyla yayınla. İsteğe bağlı e-posta bildirimi için `RESEND_API_KEY` ve `RESEND_FROM_EMAIL` secrets ekle. Kod e-posta göndermeden de iş emrini ve takibi kaydeder.
- `ms_repair_jobs` tablosunda RLS açık ve doğrudan istemci erişimi kapalıdır. Tarayıcı yalnızca Edge Function'ı çağırır; Rufcut çalışanı panel oturumuyla yetkilendirilir.

## Birleşik site yönetimi (Ekim 2026)
- Mr. Space `/admin/` içindeki **Site yönetimi** bölümünden Laloo ve Heron'un hızlı kontrolleri ve tam panelleri açılır.
- Heron köprüsü için gereken secret, güvenlik sınırları ve yayın adımları: [`ms/SITE-CONTROL.md`](ms/SITE-CONTROL.md).
- Başarılı Laloo/Heron yönetim değişiklikleri hassas içerik taşımayan kısa kayıt olarak `ms_activity` tablosuna yazılır.

## Ortak hizmet platformu

Plan: [ms/PLATFORM-PLAN.md](ms/PLATFORM-PLAN.md). Kurulum, sınırlar ve testler: [ms/PLATFORM-DELIVERY.md](ms/PLATFORM-DELIVERY.md). `/studio/` izole inceleme ekranlarını açar. `/edit/` bütün sitelerin ortak editör girişi ve kolay talepler, `/admin/changes/` kırmızı insan incelemesi, `/library/` sektör başlangıçları, `/tools/denim/` deneysel ölçü aracı. `/admin/` ve `/panel/` ortak çalışma alanını kullanır. Platform SQL’i ve Functions kullanıcı onayıyla canlıya kuruldu. Ücretsiz taslak hazırlama yönetici oturumuyla çalışır; ücretli model işçisi kapalıdır. Native bağlantıların eksik kurulumları açıkça gösterilir.

Yeni tasarımlar için tek site editörü kullanılır: [ortak editör sözleşmesi](ms/REQUEST-EDITOR.md). Mr. Space ve Rufcut bu sözleşmeye bağlıdır; `assets/ms-render.js` ile üretilen sonraki tasarımlar alan kimliklerini otomatik alır. Deneme: `/request/?preview=mrspace` veya `/request/?preview=rufcut`.

## Ortak iş emirleri ve telefon uygulaması
Repair ve Jean Maker aynı Rufcut gelen işler ekranına kaydeder. Fişler çizim ve müşteri bilgileriyle açılır, filtrelenir ve A4 yazdırılır. Panel ana ekrana eklenebilir; izinle Web Push, gönderici kurulumuyla e-posta bildirimi kullanır. Tek platform modülleri, kurulum ve sınırlar: [ms/WORK-ORDERS-APP.md](ms/WORK-ORDERS-APP.md).
