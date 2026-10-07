# Mr. Space ana sayfa tasarımı, 7 Ekim 2026

## Tasarım kararı

Küçük işletmeler için bağımsız bir web stüdyosu: güçlü bir ilk izlenim, ardından gerçek işler ve anlaşılır bir hizmet modeli. Ana fikir, işletmenin merkezde olduğu ve site, operasyon araçları ve bakımın etrafında birlikte çalıştığı bir sistem.

Tasarım çeşitliliği 9, hareket 6, içerik yoğunluğu 3. Yerel HTML/CSS/JS; yeni çalışma zamanı kütüphanesi veya derleme adımı yok.

## Mevcut sayfanın incelemesi

- Kimlik: Mr. Space daire/nokta işareti, sarı vurgu, Anton / Archivo / IBM Plex Mono. Kaynak renkler `assets/site.css` değişkenlerinden gelir.
- Mevcut ana sayfa: büyük sarı giriş alanı, metinden oluşan proje kutusu, uzun açıklamalar ve istemciye göre renk değiştiren proje bölümleri.
- Değer önerisi: küçük işletmeler için site, özel yönetim araçları ve yayından sonra bakım. Özel tasarım, kendi veri ve hesapların, açık paket koşulları.
- Korunanlar: logo, menü etiketleri, sayfa adresleri, `work`, `system`, `process`, `packages`, `contact` ve üç proje bağlantısının kimlikleri; fiyatlar, teklif, başvuru ve ücretsiz deneme yolları, kanonik adres ve sosyal paylaşım metaverileri, yasal alt metin, GoatCounter `open/...` olayları.
- Yenilenenler: giriş kompozisyonu, proje sunumu, hizmet anlatımı, boşluk ve tipografi düzeni, mobil menü, açık/koyu tema kontrolü, hareket katmanı. Eski ana sayfadaki kullanılmayan iframe ve tur kodu kaldırılan satırlar arasındadır; tur kontrolleri güncel sayfada zaten yoktu. Paylaşılan demo dosyaları değiştirilmedi.

## Uygulama

- Sarı merkezli metal yörünge heykeli: markanın nokta işaretinden esinlenen özgün bir görsel. Bir raster 3B render; canlı WebGL modeli değildir. İnce imleç tepkisi ve tek giriş animasyonu kullanılır.
- Heron CA, laloo ve Rufcut: canlı sayfalardan alınan gerçek ekran görüntüleri. Görsellere tıklamak asıl projeyi açar. Rufcut konsept olarak etiketlenir.
- Site / sistem / bakım: klavye ile değiştirilebilen sekmeler ve kavramsal bağlantı diyagramı. JavaScript kapalıyken bütün hizmet içerikleri görünür.
- Açık ve koyu tema sayfa boyunca tutarlı; tercih cihazda saklanır. Hareket azaltma ayarında hareket ve imleç eğimi kapalıdır.
- Beş dil: İngilizce, Türkçe, İspanyolca, Almanca ve Fransızca. Başlık ölçüsü uzun çevirilerde bulunduğu alana sığar; görsel alternatif metinleri de çevrilir.
- WebP görseller, sabit görsel oranları, görünür olduğunda açılan bölüm geçişleri, yerel WOFF2 yazı tipleri. Font lisansları `assets/fonts/` içinde.

## Görsel kaynakları

`assets/home/orbit.webp`: yerleşik imagegen ile üretildi. Üretim komutu:

> Use case: stylized-concept. Asset type: transparent 3D sculpture for the homepage of Mr. Space, an independent web studio whose brand palette is graphite black, cool white, and sun yellow #F6B93B. Create a single extraordinarily refined floating orbital sculpture: a large thick polished liquid-chrome toroidal ring, slightly irregular organic cross section, inclined in a diagonal 3/4 perspective, embracing a perfectly spherical sun-yellow core. A second much thinner satin graphite orbital hoop threads around the chrome torus at a different inclination. Visually express one business at the center with a beautifully engineered system around it. Ultra high quality physically based industrial product render, strong directional studio softboxes, beautiful black-to-silver specular highlights, amber reflected light on the underside of the chrome, crisp silhouettes, no exaggerated colored glows. Ring and sphere are centered and occupy 85% of the canvas, generous transparent margin, isolated floating object, no ground, no floor, no environment. True transparent background. Sophisticated art direction, monumental and sculptural, tactile metal, suitable for an award-worthy design studio website. No lettering, no text, no logo, no UI, no watermarks, no stars, no planets, no decorative small objects.

`assets/home/{heron,laloo,rufcut}-site.webp`: sırasıyla https://heronca.com/, https://www.laloo.org/ ve https://mrspace.online/rufcut/ sayfalarının 1440×1000 ekran görüntüleri. 7 Ekim 2026'da alındı. Kaynak PNG dosyaları yerel `homepage-2026-review/` klasöründe korunur.

Font kaynağı: Google Fonts, mevcut marka aileleri. OFL lisansları birlikte saklanır.

## Doğrulama

Chrome'da 5 dil × 6 genişlik (320, 390, 768, 960, 1024, 1440 px) toplam 30 görünüm kontrol edildi. Sayfa ve başlık taşması, bozuk görsel, eksik kaynak metin çevirisi ve tarayıcı JavaScript hatası yok. Mobil menü açma/Escape ile kapama, sekmelerde yön tuşları/Home/End, iki tema ve tema tercihinin saklanması doğrulandı. 16 yerel bağlantı/kaynak HTTP 200 döndü.

Her iki temada 123 görünür metin düğümünün hesaplanan renk kontrastı boyutuna uygun WCAG AA eşiğini geçti. Hareket azaltma modunda çalışan animasyon yok. JavaScript kapalıyken üç hizmet içeriği görünür. JavaScript sözdizimi ve `git diff --check` temiz. Bu kontroller fiziksel cihaz testi veya gerçek kullanıcı Core Web Vitals ölçümü değildir.
