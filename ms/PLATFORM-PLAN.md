# Mr. Space ortak hizmet platformu

Tarih: 7 Ekim 2026. Çalışma dalı: `feat/platform-foundation-2026-10-07`.
Bu çalışma bir inceleme taslağıdır. Canlı site, müşteri hesabı veya veritabanı kullanıcı onayı olmadan değiştirilmez.

## Ürün kararı

Mr. Space, site teslim eden bir stüdyonun yanında siteleri işleten ortak hizmet platformudur. Aynı yönetim, talep ve taslak altyapısı kendi ürünlerimize ve müşterilere hizmet eder. Marka sahipliği ile hizmet paketi farklı alanlardır: Heron kendi işimiz olarak kalır ama Paket 3 sisteminin örneğidir; bu temsil sahte ödeme/abonelik oluşturmaz. Laloo, Mr. Space ürünüdür. Rufcut müşteri çalışma alanıdır; özel bilgiler tanıtımda kullanılmaz.

| Alan | Rol | Hizmet | Yerel panel |
| --- | --- | --- | --- |
| mrspace.online | Ana yönetim | Platform | Süper admin |
| Heron CA | Kendi işimiz, portföy örneği | Paket 3 | Heron stok, teklif, yayın, fiş |
| Laloo | Mr. Space ürünü | Paket 3 | Laloo yer, şehir, moderasyon, üyelik |
| Rufcut | Müşteri | Mevcut ilk müşteri sözleşmesi | Square, stok, etiket, tamir |
| markan.mrspace.online | Paket 1 müşteri sitesi | Yönetilen site | İçerik, taslak, talep |

## Mevcut durum ve kanıt

Ana dalın incelenen sürümü: `34e081f`. Statik HTML/CSS/JS, bağımlılıksız Node işçisi ve Supabase. Yeni frontend framework eklenmez.

- Ortak Supabase projesinde 4 site, 17 değişiklik talebi ve 2 site taslağı var. Bunlar gerçek kayıtlar; tanıtım datası değildir.
- Heron ayrı Supabase projesinde. Ürünlerini merkezi veritabanına taşımak bu geçişin gereği değildir. Dar kapsamlı sunucu köprüsü yerel paneli korur.
- Laloo ve Mr. Space aynı projede fakat ayrı tablo kümelerinde. Laloo yönetici listesi ile Mr. Space yöneticileri aynı kabul edilmemeli; her sınırda izin doğrulanmalı.
- `ms_worker_settings`, `ms_worker_admin_snapshot`, `ms_worker_runtime_config` ve diğer işçi ayar RPC'leri canlıda yok. Kaynak SQL var ama uygulanmamış. İşçi çalışıyor diye sunulamaz.
- Müşteri editöründe her metinden adım üretme, iframe üzerinde seçim ve uzun form yükü var. Kolay editör önce niyet ve tek açıklama ister; detaylı yerinde düzenleme isteğe bağlıdır.
- Başvuru sayfasında e-posta uygulaması üzerinden teslim akışı var; otomatik iş kuyruğuna giren gerçek başvuru uç noktası ayrı aşamadır.
- Mevcut test dosyası Playwright'ın örnek sitesini test ediyor; ürün akışlarına ilişkin kanıt oluşturmuyor.
- API çağrısının kabul edilmesi, e-postanın teslimi veya sitenin yayınlanması ile aynı değildir. UI bu durumları ayrı göstermeli.

## Yönetim ve yetkiler

1. Süper admin: tüm çalışma alanları, paket tanımı, bağlantı teşhisi, talepler, maliyet, kütüphane, inceleme.
2. Müşteri üyesi: yalnızca `ms_site_users` üyeliği olan sitenin özeti ve talepleri. JWT e-postası sunucudan alınır; kullanıcı düzenleyebildiği metadata yetki kaynağı değildir.
3. İzleyici: tanıtım için yalnızca yayınlanmış Heron/Laloo işlevleri ve kişisel veri içermeyen portföy anlatımı. Mevcut ham talep ve aktivite kayıtları paylaşım için güvenli kabul edilmez.
4. İşçi: yalnızca sunucudaki service role. Anahtarlar Vault'ta; tarayıcıya sadece yapılandırma durumu gelir.

Yeni tablolar RLS ile korunur. Sunucu fonksiyonlarına varsayılan PUBLIC/anon erişimi kapatılır. Müşteri talebi mevcut UUID site anahtarı veya doğrulanmış site üyeliği ile yapılır. Bir sitenin anahtarı başka sitenin verisini açamaz.

## Ortak veri modeli

Mevcut `ms_sites` temel kimlik; `kind` sahiplik, `plan` ticari sözleşme olarak korunur. Yeni profil, görünen hizmet paketini (`package_1/2/3/platform`) ve sektörü taşır. Bağlantılar siteye bağlıdır; `setup/connected/error` durumları son kontrol zamanı ve hassas olmayan hata koduyla gösterilir. Eski veya hiç kontrol edilmemiş kayıtlar çalışan bağlantı sayılmaz.

Talepler mevcut `ms_changes` kuyruğunda kalır. Yeni talep için idempotency anahtarı aynı gönderimin tekrarını önler. Çalışma alanı özeti müşteri iletişimlerini, anahtarları, ödemeleri veya başka sitenin notlarını döndürmez. Maliyet ve ticari sözleşme süper adminde kalır.

Kütüphane önce sürümlenmiş, gerçekten açılan ve çalışan tasarım/araç kaynaklarından oluşur. Sektöre göre eşleşme yerelde ve ücretsiz yapılabilir. "Hazır", "deneysel", "fikir" ayrımı vardır. Çalışmayan bir fikir hazır araç gibi önerilmez.

## Talep yaşam döngüsü

`Alındı → Hazırlanıyor → İnsan incelemesi → Revizyon veya onay → Yayın → Tamamlandı`

Otomasyonun taslak hazırlaması ile yayına geçme ayrı kapılardır. Müşterinin "gönder" işlemi yayın onayı değildir. Küçük değişiklik kotası yalnızca insan kararında mevcut sözleşme kurallarıyla hesaplanır. Büyük veya belirsiz işler otomatik insana ayrılır. Hata başarısızlık olarak saklanır; başarılı kayıt mesajıyla gizlenmez.

## Kolay editör

Üç adım: (1) ne değişecek, (2) yeni içerik/not, (3) özet ve gönder. Saat, iletişim, metin, fotoğraf, tasarım ve genel not seçenekleri; tek talep için tek hedef. Taslak yalnızca cihazda kaydedilir; kayıt durumu açıkça belirtilir. Ağ hatasında taslak korunur. Başarılı kayıtta talep numarası verilir; e-posta teslim edilmiş gibi gösterilmez. Detaylı yerinde editör ek seçenek olarak kalır.

Paket 1 yapıcısı: kimlik/içerik/görünüm adımları, iyi seçilmiş varsayılanlar, masaüstü ve telefon önizlemesi, geniş ekranda düzenleme ile önizleme yan yana. Yazı tipi ve CSS ayrıntıları gelişmiş bölümde; müşteri işini seçer, kod terimleri öğrenmez. Taslak kaydı başarısızsa incelemeye gönderme durur.

## Premium Paket 1

Premium hissi paket fiyatından önce sonuç kalitesiyle kanıtlanır. Aynı renk değiştiren şablonlar yerine sektörle eşleşen başlangıçlar ve farklı tipografi/kompozisyonlar. Sahte referans, ürün fotoğrafı veya müşteri yorumu yok. İlk ekranda işletme adı, yaptığı iş ve bir açık eylem; sonra hizmet/fiyat, hikâye ve iletişim. Beş dil ve erişilebilirlik aynı ürünün parçasıdır.

Alt alan adı yayını için `host` kayıtları tek başına yeterli değildir: wildcard DNS, TLS ve host yönlendirme sunucusu doğrulanmalı. GitHub Pages'te her yeni alt alan adı otomatik provision edilmiş gibi gösterilmez. Bu altyapı son onay ve ayrı hosting geçişi gerektirir.

## Taslak fabrikası ve maliyet

Fikir → kısa ihtiyaç tanımı → sektör/özellik eşleşmesi → izole taslak → güvenlik ve kalite kontrolü → insan incelemesi → kütüphane.

Bu çalışma döneminde ücretli model API çağrısı yapılmaz. Gelecek işçide aylık, iş başı, model denemesi ve dosya sınırı; süre aşımı; tek çalışma kilidi; durdur anahtarı; kök/üst klasöre ve sembolik bağlantıya çıkış engeli olmalı. Başarısız cevapların maliyeti de hesaba katılır. İnsan onayı gelmeden merge/yayın yok.

İlk işlevsel araç: denim/tamir ölçü notu ve paça kısaltma hesabı. Bu araç kesim kalıbı üretmez; atölye görüşmesi için ölçüleri toplar. Ürün önerisinde kapsamı ve deneysel durumu açıkça belirtilir.

## Altı saatlik uygulama sırası

| Süre | İş | Çıkış kriteri |
| --- | --- | --- |
| 0–1 | İnceleme, mimari, izole dal | Bu belge ve gerçek bağlantı envanteri |
| 1–2 | Çalışma alanı profilleri, yetkili RPC, admin görünümü | Sahiplik/paket ayrımı; başka siteye erişim yok |
| 2–3 | Talep kuyruğu, kolay editör, bağlantı durumları | Gönderme, tekrar gönderme, ağ hatası testleri |
| 3–4 | Yapıcı rehberi ve premium renderer | Masaüstü/telefon önizleme; kaydetme hatası yayınlamaz |
| 4–5 | Kütüphane ve işçi güvenliği | Gerçek açılan tasarımlar/araç; dosya sınırı testleri |
| 5–6 | Test, görsel kontrol, sunum ve PR | İnceleme ekranı, test raporu, yayın listesi |

Saatler çalışma sırasını belirtir; eksik dış servis anahtarı veya yayın onayı uydurularak tamamlandı sayılmaz. Tek AI çalışır; kullanıcı kotası izlenir. Ücretli servis veya yeni proje oluşturulmaz.

## Yayın sırası ve geri dönüş

1. Kullanıcı önizlemeyi onaylar.
2. Mevcut veritabanı yedeği ve migration geçmişi doğrulanır. Kaynak kontrollü yeni SQL önce izole test veritabanında iki kez çalıştırılır.
3. Merkezi ek tablolar/RPC kurulur; mevcut site/talep kayıtları ve ödemeler korunur. İşçi kapalı kalır.
4. Bağlantı teşhis Edge Function'ı ve Heron sırrı hazırlanır; dört rol ve çapraz site testleri yapılır.
5. Statik değişiklikler yayınlanır. Heron/Laloo'nun yerel paneli çalışır durumda korunur.
6. Tek bir test talebi uçtan uca doğrulanır. Sonra bütçe/anahtar sahibi tarafından girilir ve işçi ayrıca açılır.

Geri dönüş: önce işçi kapatılır; statik commit geri alınır; yeni tablolar silinmez. Eski panel ve müşteri linkleri çalışmaya devam eder. Ücretli abonelik, otomatik ödeme, DNS ve wildcard yayın bu PR'ın tamamlanmış özellikleri değildir.

## Resmi teknik kaynak

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [RPC execute yetkileri](https://supabase.com/docs/guides/database/functions)
- [Supabase değişiklik notları](https://supabase.com/changelog)

Canlı kurulum gerektirenler ve test sonuçları `PLATFORM-DELIVERY.md` belgesinde çalışma sonunda ayrı raporlanır.
