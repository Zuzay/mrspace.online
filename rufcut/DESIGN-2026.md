# Rufcut ana sayfa, 2026

Amaç: Rufcut'un indigo, bakır ve Anton/Archivo kimliğini koruyarak ana sayfayı yeniden tasarlamak; Jean Maker ve Repair Atelier'i aynı sayfada kullanılabilir hale getirmek.

Tasarım ayarları: DESIGN_VARIANCE 7, MOTION_INTENSITY 4, VISUAL_DENSITY 3. Statik HTML/CSS/JS, yeni uygulama bağımlılığı yok. İlk açılışta koyu tema kullanılır; ziyaretçinin son tema seçimi hatırlanır. Açık ve koyu tema, az hareket tercihi, mobil yerleşim ve klavye desteği mevcut. Dikiş makinesi sağ üstte korunur; modeli yalnızca makinenin üzerindeki etikette gösterilir. Her iki araç çerçevesinin altında “powered by mrspace” bağlantısı bulunur.

## Gerçek fotoğraflar

Kullanıcının isteğiyle AI üretimi ürün fotoğrafları kullanılmaz. Yeni sayfaya eklenen fotoğraflar Rufcut'un kendi sitesinden alınmıştır. Dosyalar yalnızca boyutlandırılıp WebP formatına çevrilmiştir; içerikleri değiştirilmemiştir.

- `media/rufcut-store.webp`: Rufcut atölyesindeki gerçek dikiş fotoğrafı. Kaynak: https://138550530.cdn6.editmysite.com/uploads/1/3/8/5/138550530/IBDCKHFLENPFYL3QVUNTFVRY.jpeg
- `media/rufcut-detail.webp`: Rufcut'un kendi atölye tezgâhı fotoğrafı. Kaynak: https://www.rufcut.com/uploads/b/4b19b8f0-b397-11f1-b647-a14608de4b3a/rufcut-social.jpg

İki fotoğrafta CSS ile ortak renk düzenlemesi uygulanır: azaltılmış doygunluk, dengeli kontrast, indigo gölgeler ve hafif bakır ışık. Makine çizimi bu katmanların üstünde kalır. Mobil ve masaüstünde, açık ve koyu temalarda görsel kontrol yapıldı; ilk açılışın koyu olması ve son tema seçiminin saklanması doğrulandı.

Jean Maker'da mevcut giysi çizimi seçimlere yanıt veren teknik önizleme olarak kullanılır; ürün fotoğrafı veya son ürünün birebir temsili değildir. Kesim, fiyat ve süre atölyede teyit edilir. Seçimler bu cihazda saklanır; “Request this pair” e-postaya bu seçimleri ekler.

Ana sayfa düzeni, atölye fotoğrafıyla birleşen büyük tipografi, Jean Maker yanında sabitlenen başlık ve fotoğrafın üzerine gelen atölye metniyle yenilendi. Bölümler aynı kart şablonunu tekrar etmez. Mobilde tek sütuna geçer.

Repair iki aşamada çalışır: giysi ve tamir haritası, ardından iş emri kontrolü ve iletişim. Çizim ile işlem seçimleri aynı çalışma alanındadır; mobilde seçimler çizimin üstüne taşınır. Bel, cep, diz, paça veya seçilen giysiye uygun diğer konum düğmeleri aktif işareti tek dokunuşta yerleştirir. Numaralı işaretler ayrı ayrı seçilir, dokunarak veya fareyle sürüklenir; yakınlaştırma ve klavyedeki yön tuşları hassas düzenlemeyi destekler. Kısaltma/uzatma ve daraltma/genişletme gibi zıt işlemler birlikte seçilmez.

En fazla sekiz giysi kaydedilir; kaydedilen parçalar düzenlenebilir veya çıkarılabilir. Boş yeni giysi bırakıldığında önceki parçalar kontrol aşamasına geçebilir. Taslak ve işaret konumları cihazda saklanır; eski taslaklar da açılır. Gerçek müşteri talebi ancak ziyaretçi gönderim düğmesine bastığında gönderilir. Başarıda fiş numarası ana sayfadaki takibe aktarılır.

Backend, veritabanı ve dağıtım ayarları değiştirilmemiştir. Aynı tasarıma ait geri bildirimler mevcut taslak PR #32 içinde incelenir; birleştirme yapılmadan canlı siteye geçmez.

## Doğrulama

- Chrome ile İngilizce, İspanyolca, Almanca, Fransızca ve Türkçe; 320, 390, 768, 1024 ve 1440 px genişliklerde 25 kombinasyon kontrol edildi. Taşma, eksik çeviri veya tarayıcı hatası bulunmadı.
- Jean Maker: klavye ile sekmeler, kesim ve renk değişimi, ön/arka görünüm, kaydedilen seçimler ve e-posta içeriği doğrulandı.
- Repair: hazır konumlar, aktif numaralı işaret seçimi, yakınlaştırma, gerçek fare ve dokunma sürüklemesi, klavye, konumların yeniden açılışta korunması, zıt işlemler, kaydedilen giysilerin düzenlenmesi/çıkarılması ve eski taslaklar kontrol edildi. İki giysi, zorunlu alanlar, gönderim hatasında taslağın korunması, tekrar gönderim, başarı sonrası taslağın temizlenmesi ve fişin ana sayfa takibine aktarılması doğrulandı. Gönderim ve takip uç noktaları testte taklit edildi; gerçek müşteri iş emri oluşturulmadı.
- Square stok filtreleri, sonuç bulunamaması, 12 parçalık sayfalama, filtre değişince sayfanın sıfırlanması ve bulunamayan fişte tekrar deneme doğrulandı.
- Açık/koyu tema, iframe tema ve dil eşleşmesi, az hareket tercihi ve yerel dosya bağlantıları kontrol edildi. Var olan sözlük değerleri değiştirilmedi.
- Lighthouse mobil laboratuvar sonucu: performans 87, erişilebilirlik 100, iyi uygulamalar 100; CLS 0, LCP yaklaşık 2,8 sn ve toplam bloklama 355 ms. Yerel önizleme ölçümüdür; canlı ağ koşullarında süreler değişebilir.

Ana sayfa yalnızca Rufcut metinlerini içeren `assets/lang/rufcut-{es,de,fr,tr}.json` sözlüklerini yükler. Değerler genel sözlüklerle aynıdır; her dilde yaklaşık 7 KB yüklenir. Genel sözlük değerleri korunur. Paylaşılan yapılandırma betiği sıralı `defer` ile yüklenir.

Stok ilk açılışta 12 parçayla başlar; ziyaretçi “Show more pieces” ile devam eder. Gerçek fotoğraflar ekran genişliğine göre WebP boyutlarından seçilir. Dış API, veri modeli veya dağıtım ayarı değiştirilmemiştir.
