# Platform teslimi, 8 Ekim 2026

Kullanıcı bu sürümün yayınını onayladı. Ortak Supabase’e işçi kontrolü ve platform migration’ları uygulandı; özel başvuru servisi ve JWT korumalı yönetim servisi canlıya kuruldu. Ücretli model işçisi kapalıdır; ücretli model çağrısı yapılmadı. İnceleme merkezi `/studio/`. `preview=1` ekranları örnek içerikle çalışır; kurulmayan bağlantıyı başarılı göstermez ve canlı kayıt göndermez.

## İnceleme yolları

| Ekran | Yol |
| --- | --- |
| Ortak admin | `/admin/?preview=1` |
| Kırmızı içerik incelemesi | `/admin/changes/?preview=1` |
| Üç adımlı müşteri editörü | `/edit/?preview=1` |
| Rehberli Paket 1 yapıcısı | `/build/?preview=1` |
| Üç başlangıç tasarımı | `/library/` |
| Çalışan denim prova hesabı | `/tools/denim/` |

Gerçek RPC ve Edge Function akışları canlıya kuruldu. `preview=1` hâlâ kayıt göndermeyen örnek moddur; gerçek yönetim `/admin/` oturumuyla açılır. Heron native köprüsü ayrı erişim/secret kurulumu gerektirir.

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
- `tests/platform.edge.mjs`: 8 kontrol, JWT/admin, eksik secret, redirect/host, 1 MB HTML sınırı, sırların hata yanıtına girmemesi, özel başvuru, ücretsiz hazırlama sınırı ve kayıt hatasının başarı sayılmaması.
- `tests/platform.browser.mjs`: 10 akış; beş dil, mobil, gerçek katalog yolları, kırmızı önce/sonra, başarısız kayıt/aynı token tekrar, kayıt hatasında gönderimin durması, ölçü aracı, başvuru makbuzu, sözlük yükleme hatası ve taslak hazırlama hatasından sonra kuyruğu koruyan tekrar deneme. Canlı API trafiği engellenir.

Test-only PGlite, TypeScript ve Playwright dış runtime'dan `MS_PGLITE_MODULE`, `MS_TYPESCRIPT_MODULE`, `MS_PLAYWRIGHT_MODULE`, `MS_CHROME_PATH`, `MS_SUPABASE_UMD` ile yüklenir. Uygulamaya yeni frontend kütüphanesi eklenmedi. Testler canlı Heron/Square yazmasını, e-posta teslimatını, DNS/TLS veya ücretli model kalitesini kanıtlamaz.

Son görsel kontrolde yapıcının form kutuları düzeltilip 1440 ve 390 pikselde alan sınırları ölçüldü. Heron kredi satırı ile Laloo'nun beş dilde ürün kredisi script ve dış trafik kapalıyken doğrulandı; bu kontrol native mağaza/harita entegrasyonlarının uçtan uca testi değildir.

## Canlı doğrulama ve kurulum durumu

- `ms-site-control` v3 ACTIVE, JWT doğrulaması açık; `ms-intake` v1 ACTIVE, kendi origin/boyut/HMAC/hız sınırı kontrolleriyle açık başvuru alır. SDK sürümü 2.45.4 sabitlendi.
- Gerçek HTTPS başvurusu 200 ve **#1** makbuzu verdi; aynı token tekrarında aynı #1 ve `duplicate=true` döndü. Test başvurusu silinmeden yönetici RPC’siyle `closed` yapıldı. Girişsiz yönetim 401, izin verilmeyen origin 403 döndü.
- Canlı DB’de dokuz yetki/iş akışı grubu doğrulandı: atanmış müşterinin kendi sitesi; müşteri admin yazma yasağı; geçici viewer sınırı; anonim özel okuma yasağı; UUID talep ve tekrar; yönetici kapsamı; onayın yayın olmaması; tam SHA; taslak kuyruğu/sahiplenme/tamamlama/önizleme/insan kabulü. Test yazmaları alt transaction’da geri alındı. 4 site, 17 talep ve 2 mevcut yapıcı taslağı korundu.
- Bu DB kontrolleri sunucuda JWT claims/rolleriyle yapılmıştır; kullanıcının tarayıcıda gerçek oturumuyla tüm native Heron/Square akışlarının uçtan uca testi değildir. Tarayıcı testleri izole mock yanıtlar kullanır.
- Yönetici taslak gönderince ücretsiz Edge hazırlama çağrılır. En fazla iki iş atomik alınır; hata kaydı başarılı hazırlanmış gibi gösterilmez. Kuyrukta kalan iş için “Sıradaki taslakları hazırla” vardır. Mevcut renderer ile HTML üretir; belirsiz yeni araç `human_implementation_required` ile insana bırakılır.
- Ücretli işçi `enabled=false`. Harcama RPC’si ve trigger authenticated/anon erişimine kapatıldı. Yalnızca hizmet rolü maliyet okur; yönetici özet RPC’si kendi yetki kontrolünü uygular.
- Fonksiyon tanımları ve kayıt sayıları yayın öncesi yerel korumalı dosyada saklandı; bu tam veritabanı yedeği değildir. Yeni tablolar/veriler geri dönüşte silinmez.

## Yayın sırası

1. Kullanıcı görünümü ve yayını onayladı. Mr. Space PR #33 ve Laloo PR #6 beklenen SHA kontrolüyle birleştirilir; gerçek HTTPS kaynakları ayrıca karşılaştırılır.
2. DB yedeği/migration geçmişi doğrulanır. Sistem/access/Square/requests-v2 kurulumları kontrol edilir. `mrspace-worker-panel.sql` kurulur, işçi kapalı kalır. Eski worker SQL'iyle yinelenen tetikleyici/zamanlayıcı kurulmaz.
3. `ms/mrspace-platform.sql` transaction olarak uygulanır. Admin/member/viewer/anon gerçek test hesaplarıyla sınanır.
4. `ms-site-control` JWT doğrulaması açık, `ms-intake` kendi kontrolleriyle JWT doğrulaması kapalı deploy edilir. `HERON_ADMIN_PASSWORD` yalnızca Function secret'ına girilir; Laloo yerel `admins` yetkisi korunur.
5. Statik kaynaklar, ayrı Laloo dalı ve Heron patch'i onayla yayınlanır. Başvuru ve test talebi gerçek kayıt numarasıyla uçtan uca doğrulanır. Bağlantı kontrolü zamanı panelde görünür.
6. Yönetici üzerinden ücretsiz anlık taslak hazırlama kuruludur. Ek zamanlanmış çalışma istenirse `MS_DRAFT_ENABLED=true` GitHub variable ile taslak atölyesi açılır. Varsayılan kapalı; iki iş/çalışma, altı saatte bir. Ücretli üretici ayrı kalır; Vault anahtarları, repo/klasör, bütçe ve güncel `GEMINI_PRICE`, `DEEPSEEK_PRICE`, `ANTHROPIC_PRICE` (girdi/çıktı USD/1M token) tanımlanmadan ücretli çağrı başlamaz.

Wildcard DNS/TLS ve host yönlendirmesi `markan.mrspace.online` için hâlâ ayrı hosting işidir. E-posta, yeni ödeme sistemi, Cloudflare dal önizlemesi ve sınırsız özgün araç üreten ajan tamamlanmış özellikler değildir.

Geri dönüş: önce otomasyonları kapat, statik commit'i geri al. Yeni tabloları/verileri silme. Native Heron/Laloo paneli, eski müşteri bağlantıları ve mevcut ödemeler korunur.

Sonraki yatırım oturumu için kapsam ve kabul ölçütleri: [NEXT-SESSION.md](NEXT-SESSION.md).
