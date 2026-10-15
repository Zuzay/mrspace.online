# Sade Rufcut müşteri paneli

Yeni giriş: `/panel/rufcut/`. Ana sayfa, İş emirleri, Mr. Space'e talep ve Square ürün bağlantısı olmak üzere dört ana seçenek vardır. Satış ve kargo ayarları ana sayfadan ve üst araç çubuğundan açılır; görünüm tercihi ayrı küçük ayarlar ekranındadır. İngilizce varsayılandır; Türkçe, İspanyolca, Almanca ve Fransızca desteklenir.

## Sorumluluklar

- Müşteri ürün, fotoğraf, fiyat, beden, stok ve kategorilerini Square Dashboard içinde yönetir. Bu panel katalog yazmaz, varyasyon veya kategori editörü göstermez. Satış/kargo ekranı `ms-square` üzerinden mevcut `commerce_status`, `commerce_save`, `commerce_quote` ve ödeme izni isteyen `connect` sözleşmesini kullanır; ürün kataloğunu değiştirmez.
- Tasarım, metin/fotoğraf ve yardım talepleri tek formdan mevcut `ms_submit` fonksiyonuna gider. Site anahtarı, giriş yapan hesabın `ms_my_sites` yanıtındaki Rufcut kaydından alınır. Tasarım talebi `big`, diğerleri `small` türündedir. Kuyruk ve insan incelemesi korunur. Fotoğraf dosyası yüklemek yerine referans bağlantısı paylaşılabilir.
- Başarı ancak sunucunun `ok` ve geçerli `edit_key` yanıtı ile gösterilir. Mevcut `/request/?e=...` bağlantısıyla talep güncellenebilir. Talep geçmişi `ms_client_view` üzerinden okunur. Gönderim hatasında metin bellekte kalır; sayfalar arası gezinmede kaybolmaz. Sayfa kapatılmadan önce kaydedilmemiş taslak için tarayıcı uyarısı vardır. Kalıcı çevrimdışı taslak veya yeni bir gönderim idempotency sözleşmesi eklenmedi.
- İş emirleri ortak `MsOrders` modülünü kullanır: arama, filtre, sayfalama, durum, atölye notları, ölçü ve A4 fiş yazdırma. Liste `ms-panel`, kayıt `ms-repair` üzerinden yapılır. Başarısız kayıt taslağı temizlemez.
- Ortak müşteri oturumu kullanılır. Rufcut erişimi olmayan kullanıcıya panel açılmaz; asıl yetki denetimi mevcut sunucu uçlarında kalır. Demo modu hiçbir kayıt veya gönderim yapmaz. Hassas iş verisi yeni bir cihaz deposuna yazılmaz.

## Geçiş ve sınırlar

`AGENTS.md` aynı dosyaların farklı açık işlerde değiştirilmesini yasaklıyor. Ortak `panel/index.html`, `assets/ms-client-panel.js`, editör, mevcut sözlükler ve diğer açık PR dosyaları değiştirilmedi. Bu nedenle eski `/panel/` girişi henüz yeni ekrana yönlendirilmez. Birleştirme/yayın sonrasında Rufcut müşterisine yeni `/panel/rufcut/` adresi verilmelidir; ortak girişin otomatik yönlendirmesi açık panel çalışmasıyla koordine edilmelidir.

Yeni SQL, Function deploy, Square hesabı değişikliği veya canlı yayın gerekçesiyle bu PR içinde bir kurulum yapılmadı. Mevcut Auth/RPC/Functions kurulumu gerekir. E-posta teslim garantisi gösterilmez. Square OAuth mevcut ortak `/panel/` geri dönüşünü kullanır; bağlantıdan sonra müşteri yeni sade adresi yeniden açabilir. Mevcut telefon uygulaması/Web Push kurulumu eski ortak panelde kalır; yeni ekran için yeni bildirim sistemi oluşturulmadı.

## Doğrulama

`tests/rufcut-simple-panel.browser.mjs` yerel HTTP sunucusu ve Chrome kullanır. Bütün canlı uçlar engellenir. Test kapsamı: sade gezinme, Square'e geçiş, talep payload/site anahtarı, kayıt hatası ve tekrar deneme, çift gönderim, talep geçmişi, kaçışlama, yetkisiz hesap, eksik anahtar, demo, iş emri kayıt/not/sayfalama/yazdırma, beş dil, iki tema ve 320/390/768/1280 px taşma kontrolleri.

```sh
MS_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
MS_CHROME_PATH='/absolute/path/to/Google Chrome' \
node tests/rufcut-simple-panel.browser.mjs
```

Yerel önizleme için repo kökünü HTTP üzerinden sunup `/panel/rufcut/` adresinde **Explore sample panel** seçilebilir.

## Robert’ın satış/kargo ayarları

Eski mail bağlantısı `/panel/?site=rufcut&view=commerce` çalışmaya devam eder. Yeni sade giriş `/panel/rufcut/?site=rufcut&view=commerce` aynı ortak formu ve aynı kayıtları açar. Teslim alma, ülkeler, kargo tarifeleri, çıkış adresi, hazırlama süresi, HTTPS iade politikası, Square vergi teyidi ve ürün satış/profil seçimleri korunur.

Sabit “ödemeler açık değil” notu yerine gerçek `commerce_status.readiness` gösterilir. Eksik bilgisi olan, ayarları tamam ama checkout kapalı olan ve checkout açık olan durumlar ayrı tutulur. Kaydetme yanıtındaki bir bayraktan ödeme durumu tahmin edilmez; son sunucu durumu yeniden yüklenir. Ürün varyasyonlarında Square stok takibi, bilinen pozitif stok, sabit fiyat ve para birimi kontrolünün sonucu gösterilir. Yeni backend veya ödeme çağrısı eklenmedi; mevcut canlı Edge Function değiştirilmedi. Robert’ın ayarları okunarak kontrol edildi, değişiklik yapılmadı.

`tests/rufcut-sales-setup.browser.mjs`: eski/yeni linkler, bütün mail alanlarının kayıt-hata-tekrar deneme akışı, ödeme izni kapsamı, durum ayrımı, ürün uygunluğu, beş dil ve mobil iki tema. Testler canlı API’leri engeller.
