# Ortak iş emirleri ve telefondaki panel

Rufcut Repair ve Jean Maker, `ms-repair` üzerinden aynı `ms_repair_jobs` tablosuna kayıt yapar. Jean Maker e-posta uygulamasını açmaz. `kind` alanı tamir ile jeans tasarımını ayırır; seçimler, gerçek SVG çizimi ve müşteri bilgileri aynı fişte tutulur. Müşteri yalnızca veritabanının teyit ettiği fiş numarasından sonra başarı ekranını görür.

## Atölyenin kullanımı

1. `https://mrspace.online/panel/?site=rufcut` adresine yetkili Rufcut hesabıyla gir.
2. İş emirlerinde tamir/jeans ve durum filtrelerini veya müşteri/fiş aramasını kullan.
3. Fişi aç; çizim, seçimler, iletişim, prova ölçüleri ve atölye notlarını incele. Durum ve not değişikliklerini kaydet.
4. Kayıtlı fişi A4 yazdır. Kaydedilmemiş değişiklikler filtreleme sırasında bellekte korunur ve sayfadan ayrılırken uyarı verir. Yazdırma kayıtlı veriyi kullanır. Bu bir atölye iş fişidir; ödeme veya mali fatura oluşturmaz.

Panel görünürken işler dakikada bir ve uygulamaya dönüldüğünde yenilenir. Liste en yeni 200 işi getirir. Müşteri fiş numarasıyla yalnızca durum/tarih/tür görebilir; herkese açık takipte iletişim veya çizim gösterilmez.

## Telefon ve bildirimler

`panel/manifest.webmanifest` ve `panel/sw.js` tek Mr. Space uygulamasına aittir. Panelde **Ana ekrana ekle** kurulum istemini veya tarayıcıya uygun adımları gösterir. iPhone/iPad'de Safari paylaşım menüsünden ana ekrana ekle; simgeden açtıktan sonra **Bildirimler > Telefon bildirimlerini aç** seçeneğini kullan. Desteklenen Android/masaüstü tarayıcılarda da aynı düğmeden izin verilir. Bildirimler kullanıcı izni olmadan açılmaz.

Yeni bir kayıt önce kaydedilir, sonra e-posta ve Web Push denenir. Push fiş numarası/türü ve yetkili panele bağlantı taşır; kilit ekranına müşteri adı veya iletişimi göndermez. Bildirim teslimi başarısız olsa da iş emri kaybolmaz. Servis sağlayıcısının teslimi garanti edilmez; mevcut sürümde kalıcı bildirim yeniden deneme kuyruğu yoktur. Süresi biten veya yetkisi kaldırılan cihazlar devre dışı bırakılır. Çıkış cihaz aboneliğini kapatır.

E-posta için Supabase Dashboard > Edge Functions > Secrets alanında şunları ayarla:

- `RESEND_API_KEY`: Resend API anahtarı.
- `RESEND_FROM_EMAIL`: Resend'de doğrulanmış alan adından gönderici, örneğin `Rufcut <orders@doğrulanmış-alan-adı>`.

Alternatif olarak sunucunun okuyabildiği Vault sırları `resend_key` ve `resend_from` kullanılabilir. Anahtarları repoya veya sohbete yazma. Panel e-posta ayarı eksikse bunu açıkça gösterir. Paneldeki adres ve aç/kapat seçimi yetkili kullanıcının tercihleridir. Rufcut'un varsayılan atölye alıcısı `shop@rufcut.com`; müşteri de fişini alır. İngilizce müşteri e-postaları mevcut Rufcut bildirim dilini korur. Gerçek göndericiyle teslim testi ayrıca yapılmalıdır.

## Tek platform sözleşmesi

- `assets/ms-orders.*`: ortak gelen işler/fiş arayüzü.
- `assets/ms-panel-app.*`: ortak kurulum, izin ve bildirim tercihleri.
- `ms-notifications`: site üyeliğini sunucuda doğrulayan ortak bildirim servisi. `settings`, `preferences`, `subscribe`, `unsubscribe` oturum ve site yetkisi ister. Herkese açık `capabilities` yalnızca iki kurulum boolean değeri döndürür.
- `_shared/notifications.ts` ve `_shared/web-push.ts`: tek e-posta/Web Push motoru. Gelecek siteler bu modülleri kullanır, müşteri başına kopyalamaz.
- Rufcut formu ve iş emri uç noktası Rufcut'a özgü ürün/giysi kurallarını uygular; başka müşterilere otomatik sipariş yetkisi vermez.

İmzalama anahtarı ilk yetkili `settings` çağrısında Edge Function içinde üretilir ve Vault'ta şifrelenir. Tarayıcı sadece açık anahtarı alır. Push uç noktaları izin verilen HTTPS sağlayıcılarıyla sınırlıdır. Yeni tablolar RLS ile korunur, istemci rolleri tablo okuyamaz; sunucu rolü ve doğrulanmış Edge işlemleri kullanılır. İzleyiciler müşteri kayıtlarına veya bildirim ayarlarına erişemez.

## Kurulum ve doğrulama

Mevcut `ms/mrspace-repair.sql` kurulumundan sonra `ms/mrspace-order-notifications.sql` uygulanır. Ardından `ms-repair` ve `ms-notifications` fonksiyonlarını `_shared` dosyalarıyla birlikte yayınla. Her iki fonksiyon özel oturum/site denetimi yaptığı için gateway `verify_jwt=false`; korumalı işlemler fonksiyon içinde `auth.getUser` ile doğrulanır.

Gönderim tokeni tekrar denemede aynı fişi döndürür; aynı tokenle farklı içerik reddedilir. Gönderici ve müşteri başına limitler veritabanı transaction'ında uygulanır. Sunucu numbered SVG metinlerini kabul eder, script/harici görsel/olay kodunu reddeder. Service worker müşteri verilerini, API yanıtlarını ve hesap bilgilerini çevrimdışı önbelleğe almaz.

Testler:

```sh
node tests/work-orders.mjs
MS_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs MS_CHROME_PATH=/path/to/chrome MS_PREVIEW_ORIGIN=http://127.0.0.1:4174 node tests/work-orders.browser.mjs
```

Testler gerçek handler kodunu izole veritabanı/iletişim doubles ile çalıştırır; canlı müşteriye kayıt veya mesaj göndermez. Browser testi gerçek ceket çizimini ve jeans seçimlerini kullanır, beş dil/iki tema/mobil görünüm, tekrar deneme, panel filtre/not/yazdırma, açık bildirim izni ve gerçek service worker kapsamını doğrular. Şifreleme ayrıca bağımsız HKDF/decrypt ve JWT imza doğrulamasıyla sınanır. Canlı `validate` / `validate_pair` aynı çizim sözleşmesini kayıt oluşturmadan denetler.
