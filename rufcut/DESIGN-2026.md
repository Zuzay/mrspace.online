# Rufcut ana sayfa, 2026

Amaç: Rufcut'un indigo, bakır ve Anton/Archivo kimliğini koruyarak ana sayfayı yeniden tasarlamak; Jean Maker ve Repair Atelier'i aynı sayfada kullanılabilir hale getirmek.

Tasarım ayarları: DESIGN_VARIANCE 7, MOTION_INTENSITY 4, VISUAL_DENSITY 3. Statik HTML/CSS/JS, yeni uygulama bağımlılığı yok. Açık ve koyu tema, az hareket tercihi, mobil yerleşim ve klavye desteği mevcut. Dikiş makinesi sağ üstte korunur. Her iki araç çerçevesinin altında “powered by mrspace” bağlantısı bulunur.

## Gerçek fotoğraflar

Kullanıcının isteğiyle AI üretimi ürün fotoğrafları kullanılmaz. Yeni sayfaya eklenen fotoğraflar Rufcut'un kendi sitesinden alınmıştır. Dosyalar yalnızca boyutlandırılıp WebP formatına çevrilmiştir; içerikleri değiştirilmemiştir.

- `media/rufcut-store.webp`: Rufcut atölyesindeki gerçek dikiş fotoğrafı. Kaynak: https://138550530.cdn6.editmysite.com/uploads/1/3/8/5/138550530/IBDCKHFLENPFYL3QVUNTFVRY.jpeg
- `media/rufcut-detail.webp`: Rufcut'un kendi atölye tezgâhı fotoğrafı. Kaynak: https://www.rufcut.com/uploads/b/4b19b8f0-b397-11f1-b647-a14608de4b3a/rufcut-social.jpg

Jean Maker'da mevcut giysi çizimi seçimlere yanıt veren teknik önizleme olarak kullanılır; ürün fotoğrafı veya son ürünün birebir temsili değildir. Kesim, fiyat ve süre atölyede teyit edilir. Seçimler bu cihazda saklanır; “Request this pair” e-postaya bu seçimleri ekler.

Repair ayrı sayfadaki mevcut iş emri akışını ana sayfada açar. Giysi seçimi, işlem işaretleme, birden çok parça, iletişim ve fiş numarası korunur. Mobilde çizim ilgili form adımının içinde gösterilir. Gerçek müşteri talebi ancak ziyaretçi gönderim düğmesine bastığında gönderilir.

Backend, veritabanı ve dağıtım ayarları değiştirilmemiştir. Yeni değişiklik ayrı PR ile incelenir; birleştirme yapılmadan canlı siteye geçmez.

## Doğrulama

- Chrome ile İngilizce, İspanyolca, Almanca, Fransızca ve Türkçe; 320, 390, 768, 1024 ve 1440 px genişliklerde 25 kombinasyon kontrol edildi. Taşma, eksik çeviri veya tarayıcı hatası bulunmadı.
- Jean Maker: klavye ile sekmeler, kesim ve renk değişimi, ön/arka görünüm, kaydedilen seçimler ve e-posta içeriği doğrulandı.
- Repair: zorunlu alanlar, klavye ile işlem işareti, iki giysi, gönderim hatasında taslağın korunması, tekrar gönderim, başarı sonrası taslağın temizlenmesi ve fişin ana sayfa takibine aktarılması kontrol edildi. Gönderim ve takip uç noktaları testte taklit edildi; gerçek müşteri iş emri oluşturulmadı.
- Square stok filtreleri, sonuç bulunamaması, 12 parçalık sayfalama, filtre değişince sayfanın sıfırlanması ve bulunamayan fişte tekrar deneme doğrulandı.
- Açık/koyu tema, iframe tema ve dil eşleşmesi, az hareket tercihi ve yerel dosya bağlantıları kontrol edildi. Var olan sözlük değerleri değiştirilmedi.
- Lighthouse mobil laboratuvar sonucu: performans 97, erişilebilirlik 100, iyi uygulamalar 100; CLS 0 ve toplam bloklama 60 ms. Yerel önizleme ölçümüdür; canlı ağ koşullarında süreler değişebilir.

Stok ilk açılışta 12 parçayla başlar; ziyaretçi “Show more pieces” ile devam eder. Gerçek fotoğraflar ekran genişliğine göre WebP boyutlarından seçilir. Dış API, veri modeli veya dağıtım ayarı değiştirilmemiştir.
