# Müşteri site editörü

`/request/?k=SITE_KEY` sitenin üzerinde talep hazırlar. Gönderilen paketin `/request/?e=EDIT_KEY` bağlantısı aynı alanları revize eder. `/edit/` içindeki görsel editör kartı bu akışa gider; elle tarif edilen taleplerde de sayfa ve alan adı gerekir.

Sol panel bölüm listesi, arama, seçilen alanın düzenleyicisi veya değişiklik listesini gösterir. Üst konum satırı seçilen sayfa, bölüm ve alanı belirtir. Kaydetme alanı taslağa ekler; aynı alan açık kalır. Yeşil çerçeve ve alandaki konum etiketi kaydedilen talebi gösterir. Sarı çerçeve seçili alandır. Alan değiştirmeden önce kaydedilmemiş içerik için saklama, bırakma veya devam etme seçimi gösterilir.

Gözden geçirme, gönderim onayı ve gönderim sonucu aynı konumları ve önce/sonra içeriklerini gösterir. Bunlar talep akışıdır; doğrudan canlı yayın yapmaz. Mevcut `ms_submit` ve `ms_revise` sözleşmeleri korunur. `target` alanı 60 karakterlik bölüm/alan özeti, `anchor` tam sayfa ve CSS yolu, `original` önceki içerik, `request` öneri ve nottur. İnceleme başlamış talepler değiştirilemez.

İçerik taslağı localStorage'da SHA-256 ile türetilmiş bir anahtarla tutulur; ham site/revizyon anahtarı, oturum veya iletişim bilgisi taslağa yazılmaz. En fazla 40 alan, 7 gün, alan başına 2.000 karakter API sınırı korunur. Sunucuda yeni revizyon varsa cihaz taslağı veya sunucu sürümü seçilir. Depolama hatası açıkça belirtilir. Gönderim ancak API başarı yanıtını doğrulayınca tamamlanmış sayılır. Gönderilmemiş düzenlemeler varken sayfadan çıkış tarayıcı uyarısı verir.

## Fotoğraflar

Rufcut açılış ve atölye fotoğrafları `openingPhoto` ve `workshopPhoto` kimliklerine sahiptir. İkisi de dosya seçme, link, önce/sonra önizlemesi ve geri alma destekler. Fotoğraf değiştirilince eski `srcset` kaldırılır; geri alırken özgün `src`, `srcset`, `sizes` geri gelir. Sayfanın mevcut CSS fotoğraf filtreleri korunur. Yapay zekâ ile fotoğraf üretilmez.

Mevcut `ms-builder` Edge Function dosya yükler. `key` sitenin kendi anahtarıdır; `edit` yalnızca ilgili gönderimin sitesini sunucuda çözer, site anahtarını tarayıcıya geri vermez. Eski `trial` yüklemeleri korunur. JPG, PNG, WebP ve GIF, 5 MB sınırı ve saatte 80 yükleme sayacı korunur. `ms-media` mevcut herkese açık medya deposudur; yeni tablo/politika yoktur. Kullanıcı bağlantısının dışarı sızmasını önlemek için editör ve iframe referrer göndermez. Revizyonla yükleme için bu PR'daki `supabase/functions/ms-builder/index.ts` yayınlanmalıdır; `verify_jwt=false` mevcut özel anahtar kontrolü nedeniyle korunur.

## Doğrulama

`node tests/request-upload.mjs` Node 24 ile gerçek Edge Function kodunu bağımsız veritabanı/depo taklitleri üzerinde çalıştırır: site/revizyon/deneme kapsamı, geçersiz anahtar, dosya sınırı, hız sınırı ve depo hatası.

`tests/request-editor.browser.mjs` ve `tests/platform.browser.mjs` mevcut Playwright ortamını kullanır. Yeni bağımlılık eklenmez. `MS_PLAYWRIGHT_MODULE`, `MS_CHROME_PATH`, `MS_PREVIEW_ORIGIN` ayarlanır; platform testi ayrıca `MS_SUPABASE_UMD` ister. Tüm canlı API çağrıları engellenir. Fotoğraflar gerçek Rufcut dosyasından alınan test verisidir; hiçbir gerçek talep veya yükleme gönderilmez.

Yeni tarayıcı kontrolleri beş dil, mobil/masaüstü, açık/koyu tema, iki fotoğraf, konum bilgisi, önce/sonra karşılaştırması, gönderim onayı, hata sonrası tekrar deneme, yenilemeden sonra taslak ve revizyon bağlantısını kapsar.
