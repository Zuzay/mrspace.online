# Tarayıcı dayanıklılığı ve mobil panel temeli

İlk uygulama `build/` içindeki müşteri site yapıcısı ve ücretsiz deneme düzenleyicisidir. Site yeniden tasarlanmadı, mevcut kayıt ve insan incelemesi RPC'leri kullanılır. Sunucuya gönderilemeyen değişiklikler cihazdaki bir günlükte korunur. Yerel kayıt, sunucuya kaydedildi veya incelemeye gönderildi anlamına gelmez.

## Ortak parçalar

- `assets/ms-drafts.js`: erişim bağlantısının SHA-256 özetiyle ayrılmış cihaz günlükleri. Ham erişim anahtarı, oturum, JWT veya yönetici bilgisi saklanmaz. Yalnızca düzenlenen içerik, görünüm ve sürüm numarası bulunur. Cihazda en fazla 12 çalışma, her biri 600 KB, son kayıt üzerinden 7 gün tutulur. Boyut veya depolama hatası sessizce başarı sayılmaz. Kullanıcı tarayıcı verilerini temizlerse yerel kayıt da gider.
- `assets/ms-connectivity.js`: bağlantı göstergesi için ortak olaylar ve 20 saniyelik istek zaman aşımı. Bağlantı göstergesi sunucuya erişimi kanıtlamaz; kayıt yanıtı gerekir.
- `assets/ms-builder-resilience.js`: günlük ile site yapıcısının kayıt, yenileme ve sürüm seçimi akışını bağlar. Beş dil, 44 px dokunma düğmeleri ve açık/koyu görünüm vardır.

## Davranış

Düzenleme sırasında günlük, otomatik kayıt beklenmeden yazılır. Kayıt başarısızsa sunucuda kaydedildi denmez. Sayfa yenilendiğinde önce güncel sunucu sürümü yüklenir. Yerel içerik farklıysa kullanıcı taslağı geri yükleme veya sunucu sürümünü kullanma kararını verir. Bu karar verilene kadar içerik yazma ve gönderim kapalıdır; önizleme, bölümler ve cihaz görünümü gezilebilir.

Gerçek bir bağlantı kesintisinden sonra sunucuya otomatik yazılmaz. Yeniden yükleme ve sürüm kontrolü gerekir. Sunucuda aynı içerik varsa, yanıt kaybolmuş olsa bile günlük uzlaştırılır. Eski bir kayıt yanıtı daha yeni cihaz kaydını silemez. Sunucu düzenlemeyi kapattıysa veya yeni build oluşturduysa eski taslak geri yazılmaz; incelemek için JSON olarak indirilebilir. Yanlış/silinmiş erişim bağlantısı yerel taslak üzerinden yetki kazanamaz.

Bu değişiklik Mr. Space yönetici panellerini tamamen çevrimdışı yapmaz. `?b=` ve `?ta=` yönetici düzenlemeleri yerel günlüğe alınmaz; yönetim, ödeme, müşteri iletişimi ve API yanıtları service worker önbelleğine konmaz. Mevcut oturum içindeki yönetici kayıt hatası yine kullanıcıya gösterilir.

## Mobil yönetim panellerine sonraki uygulama

Aynı bağlantı ve cihaz günlüğü arayüzleri kullanılabilir. Yönetici günlükleri için önce doğrulanmış kullanıcı + çalışma alanı + sürüm sınırı, çıkışta cihaz verisinin temizlenmesi ve paylaşılan cihaz politikası tanımlanmalıdır. Bunlar tamamlanmadan yönetici verisi cihazda saklanmaz. Sipariş, ödeme, onay ve yayın işlemleri çevrimdışı kuyruğa otomatik alınmaz. Her yazma için sunucu yetkisi ve tekil işlem makbuzu korunur; yayın insan onayından geçer.

Laloo'daki bağımsız çevrimdışı Kaydedilen yerler ekranı ayrı ürün entegrasyonudur. Harita, güncel saatler, yönetim ve veri API'leri ağdan gelir; harita döşemeleri çevrimdışı için indirilmez. Güncelleme mevcut sekmeler kapanana kadar bekler.

## Doğrulama

`tests/browser-resilience.mjs` bağımsız yerel HTTP sunucusu ve gerçek Chrome kullanır. SDK dosyası yerel fixture'dan gelir, bütün harici API'ler engellenir veya taklit edilir; canlı veri yazılmaz. Ortam değişkenleri:

- `MS_PLAYWRIGHT_MODULE`: mevcut Playwright modülünün mutlak yolu.
- `MS_CHROME_PATH`: Chrome çalıştırılabilir dosyası.
- `MS_SUPABASE_UMD`: mevcut Supabase UMD dosyası.
- `MS_TEST_ARTIFACTS`: isteğe bağlı ekran görüntüsü dizini.

Çalıştır: `node tests/browser-resilience.mjs`. Mevcut platform kontrolleri için yerel statik sunucuyu çalıştırıp `node tests/platform.browser.mjs` kullanılır.

Yeni testler; müşteri/deneme, başarısız kayıt, sayfa yenileme, sunucuyla fark ve bilinçli seçim, kesinti sonrası kontrol, kaybolan yanıt, eski kayıt yanıtı, dolu depolama, süre/boyut sınırı, hatalı veri, kapatılmış/yeni sürüm, beş dil, mobil/açık/koyu görünüm ve yetkisiz yönetici kapsamını kontrol eder.
