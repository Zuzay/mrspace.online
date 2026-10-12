# Mr. Space ortak site editörü

`/edit/` ortak girişidir: oturum açan kişi yalnızca yetkili olduğu siteleri görür. Mr. Space’in kendi sitesi ve Rufcut aynı motoru kullanır. `/edit/?site=SLUG` mevcut panel oturumundan siteyi açar; `/request/?k=SITE_KEY` sitenin üzerinde talep hazırlar. Gönderilen paketin `/request/?e=EDIT_KEY` bağlantısı aynı alanları revize eder. `/edit/` içindeki görsel editör kartı bu akışa gider; elle tarif edilen taleplerde de sayfa ve alan adı gerekir.

Sol panel bölüm listesi, arama, seçilen alanın düzenleyicisi veya değişiklik listesini gösterir. Üst konum satırı seçilen sayfa, bölüm ve alanı belirtir. Kaydetme alanı taslağa ekler; aynı alan açık kalır. Yeşil çerçeve ve alandaki konum etiketi kaydedilen talebi gösterir. Sarı çerçeve seçili alandır. Alan değiştirmeden önce kaydedilmemiş içerik için saklama, bırakma veya devam etme seçimi gösterilir.

Gözden geçirme, gönderim onayı ve gönderim sonucu aynı konumları ve önce/sonra içeriklerini gösterir. Bunlar talep akışıdır; doğrudan canlı yayın yapmaz. Mevcut `ms_submit` ve `ms_revise` sözleşmeleri korunur. `target` alanı 60 karakterlik bölüm/alan özeti, `anchor` tam sayfa ve CSS yolu, `original` önceki içerik, `request` öneri ve nottur. İnceleme başlamış talepler değiştirilemez.

İçerik taslağı localStorage'da SHA-256 ile türetilmiş bir anahtarla tutulur; ham site/revizyon anahtarı, oturum veya iletişim bilgisi taslağa yazılmaz. En fazla 40 alan, 7 gün, alan başına 2.000 karakter API sınırı korunur. Sunucuda yeni revizyon varsa cihaz taslağı veya sunucu sürümü seçilir. Depolama hatası açıkça belirtilir. Gönderim ancak API başarı yanıtını doğrulayınca tamamlanmış sayılır. Gönderilmemiş düzenlemeler varken sayfadan çıkış tarayıcı uyarısı verir.

## Etkileşimli alanlar ve renkler

Editör, yerel `button[role=tab][aria-controls]` sekmelerini ve açıkça `data-ms-editor-nav` ile işaretlenen düğmeleri çalıştırabilir. Başlık metni alan listesinden ayrıca düzenlenir. Gizli bir paneldeki alan seçildiğinde sayfanın gerçek sekme işleyicisi çalışır; `hidden`, `aria-selected` ve ileri/geri durumu birlikte güncellenir. Kaydedilmemiş düzenleme varsa tıklama ve klavye geçişi aynı taslak uyarısını kullanır. Diğer bağlantılar ve gönderim düğmeleri düzenleme modunda çalıştırılmaz.

`data-ms-color` altı haneli HEX değeri bulunan düz renk alanıdır. `data-ms-color-group` renk kutusunu, örneğin Wash ve Thread grubunu, konum bilgisinde ayırır. Renk seçici ve HEX girişi aynı taslağı düzenler. Önce/sonra renkleri, alanın kalıcı kimliği ve notu gözden geçirme, onay ve sonuç ekranlarında korunur. Geçersiz renk kaydedilmez. Geri alma özgün stil niteliğini geri yükler. Sayfa `ms:editor-color-preview` olayını dinleyerek çizimini güncelleyebilir; Rufcut bunu denim ve dikiş renkleri için kullanır.

`data-ms-choice` desen veya otomatik renk için açıklama alanıdır. Düz renkmiş gibi HEX seçici açmaz, düğmenin içine metin yazmaz ve mevcut çizimi değiştirmez. Renk/desen talepleri insan tasarım incelemesine gider; taslak kaydetmek canlı yayına çıkarmak değildir. `data-ms-runtime` içindeki canlı özetler ve seçim değerleri düzenlenebilir metin listesine alınmaz; çizimin kullandığı alt öğeler korunur.

`tests/editor-controls.browser.mjs` sekmeler, gizli alanlar, düz renk/desen ayrımı, çizim, doğru gönderim kimliği, taslak geri yükleme, iptal/geri alma, hatalı HEX, mobil/tema ve klavye kontrollerini gerçek Chrome ile sahte API üzerinde doğrular. Gerçek müşteri kaydı oluşturmaz.

## Fotoğraf işlemleri

Rufcut açılış ve atölye fotoğrafları `openingPhoto` ve `workshopPhoto` kimliklerine sahiptir. İkisi de dosya seçme, link, önce/sonra önizlemesi ve geri alma destekler. Fotoğraf değiştirilince eski `srcset` kaldırılır; geri alırken özgün `src`, `srcset`, `sizes` geri gelir. Sayfanın mevcut CSS fotoğraf filtreleri korunur. Yapay zekâ ile fotoğraf üretilmez.

Mevcut `ms-builder` Edge Function dosya yükler. `key` sitenin kendi anahtarıdır; `edit` yalnızca ilgili gönderimin sitesini sunucuda çözer, site anahtarını tarayıcıya geri vermez. Eski `trial` yüklemeleri korunur. JPG, PNG, WebP ve GIF, 5 MB sınırı ve saatte 80 yükleme sayacı korunur. `ms-media` mevcut herkese açık medya deposudur; yeni tablo/politika yoktur. Kullanıcı bağlantısının dışarı sızmasını önlemek için editör ve iframe referrer göndermez. Revizyonla yükleme için bu PR'daki `supabase/functions/ms-builder/index.ts` yayınlanmalıdır; `verify_jwt=false` mevcut özel anahtar kontrolü nedeniyle korunur.

## Doğrulama

`node tests/request-upload.mjs` Node 24 ile gerçek Edge Function kodunu bağımsız veritabanı/depo taklitleri üzerinde çalıştırır: site/revizyon/deneme kapsamı, geçersiz anahtar, dosya sınırı, hız sınırı ve depo hatası.

`tests/request-editor.browser.mjs` ve `tests/platform.browser.mjs` mevcut Playwright ortamını kullanır. Yeni bağımlılık eklenmez. `MS_PLAYWRIGHT_MODULE`, `MS_CHROME_PATH`, `MS_PREVIEW_ORIGIN` ayarlanır; platform testi ayrıca `MS_SUPABASE_UMD` ister. Tüm canlı API çağrıları engellenir. Fotoğraflar gerçek Rufcut dosyasından alınan test verisidir; hiçbir gerçek talep veya yükleme gönderilmez.

Yeni tarayıcı kontrolleri beş dil, mobil/masaüstü, açık/koyu tema, iki fotoğraf, konum bilgisi, önce/sonra karşılaştırması, gönderim onayı, hata sonrası tekrar deneme, yenilemeden sonra taslak ve revizyon bağlantısını kapsar.

## Tek motor, farklı tasarımlar

- `/request/editor.js`, `editor.css`, `editor-copy.js`: bütün müşterilerin ortak görsel editörü. Müşteri klasörüne kopyalanmaz.
- `assets/ms-editor-schema.js`: v1 veri sözleşmesi, çok dilli alan adları, kalıcı alan seçicisi ve tekil eşleşme kontrolü.
- `/edit/`: ortak site seçici; `ms_my_sites` sunucuda rol ve site yetkisini sınırlar. İzleyiciye düzenleme anahtarı verilmez. Müşteri anahtarları site seçicinin HTML bağlantılarına veya yeni bir yerel depoya yazılmaz.
- `/request/?preview=mrspace` ve `?preview=rufcut`: aynı editörü kayıt göndermeden denetleyen açık örnekler. Dosya yükleme ve gönderim hem arayüzde hem işlevde kapalıdır; örnek taslakları depolanmaz. Gerçek site linkleri mevcut yetki/onay akışını korur.
- `assets/ms-render.js`: kurucu, tasarım kütüphanesi ve ücretsiz taslak üreticisi için yedi bölüm türünde kimlikleri otomatik üretir. Müşteriye ait ayrı editör kodu gerekmez. Sunucudaki ücretsiz taslak üreticisinin yeni renderer’ı alması için `ms-site-control` aynı sürümle yeniden yayınlanır.

Yeni statik tasarım sözleşmesi:

```html
<section data-ms-section="opening">
  <h1 data-ms-field="opening.title">Your headline</h1>
  <img data-ms-field="opening.photo" src="real-photo.webp" alt="Workshop">
</section>
<script type="application/json" id="ms-editor-config">
{"version":1,"page":{"en":"Home","tr":"Ana sayfa","es":"Inicio","de":"Startseite","fr":"Accueil"},"sections":{"opening":{"en":"Opening","tr":"Açılış","es":"Presentación","de":"Einstieg","fr":"Présentation"}},"fields":{"opening.photo":{"en":"Opening photo","tr":"Açılış fotoğrafı","es":"Foto de presentación","de":"Einstiegsfoto","fr":"Photo de présentation"}}}
</script>
```

`data-ms-field` en fazla 100 ASCII harf, sayı, nokta, alt çizgi, iki nokta veya kısa tiredir; sayfada tekil olmalıdır. Yinelenmiş/geçersiz kimlikli alan düzenlemeye açılmaz. `data-ms-skip` kontrolleri, yasal alanları ve platform atfını korur. Alan adı tanımlanmazsa içerikten ve alan türünden anlaşılır etiket üretilir. JSON yalnızca veridir; çalıştırılmaz. Metinlerde `<` JSON için `\u003c` olarak kaçırılır.

Yeni talepler `sayfa::[data-ms-field="kalici.kimlik"]` yolunu saklar. Eski ID/CSS yolları desteklenir; birden fazla eşleşme varsa başka alana uygulanmaz. Eski kilitli talepler yeni kimlikler eklendikten sonra da kilitli kalır. Bölüm sırasını değiştirmek alan kimliğini değiştirmez. Üretilen içerikte aynı türden birden çok bölüm varsa kalıcı `section.id` ver; kimliksiz eski içerik tür + tekrar sırası ile uyumludur.

Harici alan adlarındaki sitelerde tarayıcının aynı kaynak kısıtı sürer; ortak not/talep akışı kullanılabilir. Bu sürüm dış siteler için görsel önizleme proxy’si veya yetkisiz sayfa erişimi açmaz.

`tests/shared-editor.browser.mjs`: Mr. Space, Rufcut ve üretilmiş farklı sektör sitelerinin tek motoru kullanması; kalıcı alan yolu, bölüm sırası, eski/kilitli yol uyumu, yinelenen kimlik, beş dil, mobil tema, site seçici yetkisi ve örneklerde sıfır yazma doğrulaması.
