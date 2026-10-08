# Platform teslimi, 8 Ekim 2026

Bu dal yayınlanmadı. Canlı Supabase yalnızca okundu; migration, müşteri verisi değişikliği, anahtar kaydı veya ücretli model çağrısı yapılmadı. İnceleme merkezi `/studio/`. `preview=1` ekranları örnek içerikle çalışır; kurulmayan bağlantıyı başarılı göstermez ve canlı kayıt göndermez.

## İnceleme yolları

| Ekran | Yol |
| --- | --- |
| Ortak admin | `/admin/?preview=1` |
| Kırmızı içerik incelemesi | `/admin/changes/?preview=1` |
| Üç adımlı müşteri editörü | `/edit/?preview=1` |
| Rehberli Paket 1 yapıcısı | `/build/?preview=1` |
| Üç başlangıç tasarımı | `/library/` |
| Çalışan denim prova hesabı | `/tools/denim/` |

Gerçek RPC ve Edge Function akışları kaynakta hazırdır; canlıya kurulmadan operasyonel oldukları iddia edilmez.

## Hazırlanan kapsam

- Ticari sahiplik/ödemeden bağımsız paket, sektör ve marka ilişkisi. Heron Paket 3 portföy, Laloo Paket 3 ürün; müşteri işi yeniden etiketlenerek halka açılamaz.
- Müşterinin yalnızca kendi çalışma alanı, kullanım bilgisi ve talepleri; üyelik veya UUID bağlantısıyla yetkilendirme. Gönderme tekrarları tek kayıt numarası döndürür.
- Yeni müşteri başvurusu özel admin kuyruğuna kaydedilir. Operatör notu/durumu vardır; e-posta veya ödeme gerçekleşmiş gibi gösterilmez.
- Canlı HTML salt okunur alınır, izinli alan adı/yönlendirme/boyut/süre sınırları uygulanır, önizlemede script çalışmaz. Kırmızı işaret içerik önerisidir; hazırlanan PR kodu ayrıca incelenir. Gerçek dal önizlemesi hosting geçişinde kurulacaktır.
- İnsan incelemesi, revizyon isteği, ayrı yayın kararı ve tam SHA eşleşmesi. İş/taslak/yayın atomik sahiplenilir. Merge sonucu “canlıya çıktı” sayılmaz.
- Commerce, Atelier ve Table kompozisyonları, rehberli yapıcı, telefon/masaüstü, kayıt hatasında gönderimin durması, mevcut içeriği koruyan görünüm değişikliği.
- Sektör önerileri yalnızca var olan kaynakları açar. Saklanan fikirden insanın ihtiyaç tanımıyla taslak kuyruğuna geçilir. Atölye mevcut renderer ile özel HTML hazırlar; belirsiz yeni araç insana kalır. İnsan kabulü otomatik müşteri yayını değildir.
- Ücretli işçi iki talep/çalışma, üç sağlayıcı denemesi, dört dosya; izole worktree, yol/symlink/özel dosya/script sınırı, force push yasağı, açık fiyat ve bütçe kontrolleri. Sağlayıcı hesap limiti de gereklidir; bu bir fatura garantisi değildir.

## Marka kaynakları

Mr. Space ana sayfasına Paket 03 kimliği eklendi. Laloo harita kredisi `ms/integrations/laloo-map-credit.patch` olarak ayrı paketlendi: açık Laloo PR #1 aynı `index.html` dosyasını değiştirdiği için harita dosyası yeni kredi PR’ına alınmaz; birleşim yayın incelemesinde yapılır. Laloo kaynak dalında harita ve beş dilde Hakkında sayfaları “Mr. Space ürünü” kredisini taşır. `about_page.py` ve sözlük de güncellendi, gece üretimi etiketi kaybetmez.

Heron `site/index.html` ve `site/assets/heron.js` canlı kaynakla birebir karşılaştırıldı. Tam hazırlanmış kopya `../platform-integrations/heron/`, izlenebilir fark `ms/integrations/heron-credit.patch`. Mevcut yerel Heron kaynağı korunur; mağaza/ödeme API'si değişmedi.

## Doğrulama

- `tests/platform.sql.mjs`: gerçek PostgreSQL semantiğinde 21 kontrol, iki migration çalıştırması, RLS/grant, site/UUID, tekrar/hız sınırı, özel başvuru, atomik sahiplenme, insan ve SHA yayın sınırı.
- `tests/worker-safety.mjs`: 6 kontrol, klasör/symlink, birlikte doğrulanan değişiklik, script/origin ve dolaylı inline script/admin dosyası müdahalesi, sürüm bağı, taslak kapsamı.
- `tests/platform.edge.mjs`: 6 kontrol, JWT/admin, eksik secret, redirect/host, 1 MB HTML sınırı, sırların hata yanıtına girmemesi, özel başvuru.
- `tests/platform.browser.mjs`: 9 akış; beş dil, mobil, gerçek katalog yolları, kırmızı önce/sonra, başarısız kayıt/aynı token tekrar, kayıt hatasında gönderimin durması, ölçü aracı başvuru makbuzu ve sözlük yükleme hatası. Canlı API trafiği engellenir.

Test-only PGlite, TypeScript ve Playwright dış runtime'dan `MS_PGLITE_MODULE`, `MS_TYPESCRIPT_MODULE`, `MS_PLAYWRIGHT_MODULE`, `MS_CHROME_PATH`, `MS_SUPABASE_UMD` ile yüklenir. Uygulamaya yeni frontend kütüphanesi eklenmedi. Testler canlı Heron/Square yazmasını, e-posta teslimatını, DNS/TLS veya ücretli model kalitesini kanıtlamaz.

Son görsel kontrolde yapıcının form kutuları düzeltilip 1440 ve 390 pikselde alan sınırları ölçüldü. Heron kredi satırı ile Laloo'nun beş dilde ürün kredisi script ve dış trafik kapalıyken doğrulandı; bu kontrol native mağaza/harita entegrasyonlarının uçtan uca testi değildir.

## Onay sonrası yayın

1. Kullanıcı görünümü ve kodu onaylar; draft PR kendiliğinden birleştirilmez.
2. DB yedeği/migration geçmişi doğrulanır. Sistem/access/Square/requests-v2 kurulumları kontrol edilir. `mrspace-worker-panel.sql` kurulur, işçi kapalı kalır. Eski worker SQL'iyle yinelenen tetikleyici/zamanlayıcı kurulmaz.
3. `ms/mrspace-platform.sql` transaction olarak uygulanır. Admin/member/viewer/anon gerçek test hesaplarıyla sınanır.
4. `ms-site-control` JWT doğrulaması açık, `ms-intake` kendi kontrolleriyle JWT doğrulaması kapalı deploy edilir. `HERON_ADMIN_PASSWORD` yalnızca Function secret'ına girilir; Laloo yerel `admins` yetkisi korunur.
5. Statik kaynaklar, ayrı Laloo dalı ve Heron patch'i onayla yayınlanır. Başvuru ve test talebi gerçek kayıt numarasıyla uçtan uca doğrulanır. Bağlantı kontrolü zamanı panelde görünür.
6. İstenirse `MS_DRAFT_ENABLED=true` GitHub variable ile taslak atölyesi açılır. Varsayılan kapalı; iki iş/çalışma, altı saatte bir. Ücretli üretici ayrı kalır; Vault anahtarları, repo/klasör, bütçe ve güncel `GEMINI_PRICE`, `DEEPSEEK_PRICE`, `ANTHROPIC_PRICE` (girdi/çıktı USD/1M token) tanımlanmadan ücretli çağrı başlamaz.

Wildcard DNS/TLS ve host yönlendirmesi `markan.mrspace.online` için hâlâ ayrı hosting işidir. E-posta, yeni ödeme sistemi, Cloudflare dal önizlemesi ve sınırsız özgün araç üreten ajan tamamlanmış özellikler değildir.

Geri dönüş: önce otomasyonları kapat, statik commit'i geri al. Yeni tabloları/verileri silme. Native Heron/Laloo paneli, eski müşteri bağlantıları ve mevcut ödemeler korunur.
