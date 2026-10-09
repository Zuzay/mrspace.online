# Mr. Space e-posta sistemi

İnceleme dalında hazırlanmıştır. SQL, Edge Functions ve yeni ekranlar henüz canlıya kurulmadı. Resend hesabına `mrspace.online` eklendi; DNS doğrulaması, sunucu anahtarı ve webhook kurulumu tamamlanmadan posta çalışmaz.

## Adresler ve dil

- Genel: `Mr. Space <hello@mrspace.online>`.
- Rufcut: `Rufcut <rufcut@mrspace.online>`; kendi alan adı bağlanana kadar bu adres kullanılır.
- Rufcut mağazası, tamir formu, müşteri paneli, editörü ve otomatik e-postaları İngilizcedir. Mr. Space Türkçe tercihi Rufcut’a aktarılmaz. Genel panel beş dilde çalışır. İnsan tarafından yazılan serbest mesajlar otomatik çevrilmez.
- `rufcut@mrspace.online` aynı zamanda bir panel kullanıcı adı olabilir. Bu kullanıcı adı gerçek müşterinin kişisel posta adresi sayılmaz. Müşteriye davet/hazır mesajı için site kaydına gerçek iletişim e-postası girilir.

## Gerçek işlemler

`/admin/mail/` sadece süper yöneticiye açılır. Gerçek kuyruk, teslimat durumları ve gelen mesajları gösterir. Örnek veri veya başarılıymış gibi görünen yedek ekran yoktur.

Yeni üyelik hoş geldin mesajı üretir; mevcut üyeliklere toplu mesaj atılmaz. Gerçek oturum açılışı tek bildirim üretir, token yenilemesi tekrar göndermez. “Siten hazır” mesajını yönetici önizleyip kuyruğa alır; alıcı veya içerik değişirse eski önizleme kabul edilmez. Linkler gerçek panel, ortak editör ve Rufcut PDF kılavuzuna gider.

Rufcut iş emirleri ve durum değişiklikleri veritabanındaki kayıtla aynı işlemde kuyruğa yazılır. Personel bildirimleri tercihe ve mevcut yetkiye bağlıdır; gönderim anında yetki yeniden kontrol edilir. Editör gönderim/revizyon teyidi de aynı kuyruğu kullanır, özel geri dönüş bağlantısını içerir. Ekran artık teslimat doğrulanmadan “e-postalandı” demez.

Resend Receiving webhook’u `hello@mrspace.online` ve `rufcut@mrspace.online` mesajlarını yönetim ekranına alır. HTML yalnızca etkisiz düz metin olarak gösterilir. Yanıt, sunucudaki gerçek Reply-To adresine gider; Message-ID uygunsa konu zinciri korunur. Ekler otomatik indirilmez, Resend’den incelenir. Bu yapı IMAP/Outlook posta kutusu kurmaz.

## Güvenilirlik ve sınırlar

Gönderim varsayılan kapalı, günlük ilk gönderim sınırı 50’dir. Kapalıyken kayıtlar kaybolmaz. Açmadan önce bekleyen mesajlar incelenmeli; henüz denenmemiş kayıtlar iptal edilebilir. Günde 50 sınırı bu kuyruk içindir; aynı Resend hesabını kullanan diğer sistemler ayrıca hesaba katılır.

İlk denemede gövde dondurulur. Aynı mesaj UUID’si Resend idempotency anahtarı olur; belirsiz yanıt aynı içerikle tekrar denenir. En fazla beş deneme, 23 saatlik tekrar penceresi vardır. “Accepted” sağlayıcının kabulüdür, teslim edildi demek değildir. “Delivered”, bounce ve complaint yalnızca imzası doğrulanan webhook’tan gelir. Belirsiz/hatalı kayıt elle yeniden gönderilmeden önce sağlayıcı tarafında incelenir.

Tüm yeni tablolarda RLS var; tarayıcı kuyruk gövdesine veya sırlara doğrudan erişemez. Müşteri ve viewer gelen kutusunu/iletişim listesini göremez. Webhook ham gövde HMAC imzası ve zaman aralığıyla doğrulanır. Kişisel içerik aktivite loguna veya test çıktısına yazılmaz.

## Bir defalık kurulum ve yayın sırası

1. [DNS kayıtlarını](MAIL-DNS.md) GoDaddy’ye ekle, Resend’de domain doğrulamasını tamamla. Başka mevcut MX varsa değiştirmeden önce posta hizmetini kontrol et.
2. Onaylanan yayın sırasında mevcut sistem, access, üyelik, requests-v2, repair ve work-orders/notification SQL kurulumlarından sonra `mrspace-mail.sql` çalıştır. Bu dosya eski `ms_mail_link` doğrudan gönderimini değiştirir; requests-v2 sonradan tekrar kurulursa mail SQL’i yeniden çalıştır.
3. Resend’de bu sunucu için API key oluştur. Receiving ve domain kontrolü için full access gerekir. Anahtarı yalnızca Supabase Function secret `RESEND_API_KEY` veya Vault `resend_key` olarak sakla. Webhook imza sırrı `RESEND_WEBHOOK_SECRET` veya Vault `resend_webhook_secret` olur. Repoya/tarayıcıya koyma.
4. `ms-mail` fonksiyonunu ortak `tizfdnsjhhepxnqqrzuk` projesine `verify_jwt=false` ile deploy et. Fonksiyon kendi yönetici JWT, cron sırrı ve webhook HMAC kontrollerini yapar. `_shared/mail-core.ts` ve `mail-handler.ts` dahil edilmelidir.
5. Resend webhook URL: `https://tizfdnsjhhepxnqqrzuk.supabase.co/functions/v1/ms-mail/webhook`. Olaylar: `email.received`, `email.delivered`, `email.bounced`, `email.complained`. İmza sırrını önce sunucuya kaydet.
6. Kuyruk SQL’i kurulduktan sonra `ms-repair` ve `ms-notifications` yeni kaynaklarını deploy et; eski doğrudan gönderim tekrar etmesin. Web Push korunur.
7. Mevcut `ms_settings.cron_secret` en az 20 karakter olmalı. `mrspace-mail-schedule.sql` her beş dakikada bir yalnızca açık ve işi bulunan kuyruğu çağırır.
8. Statik ekranları yayınla. Admin e-posta ekranında kurulum doğrula; anahtar/domain/webhook durumlarını kontrol et. Gerçek müşteri adreslerini kaydet, bekleyen kuyruğu incele. Kullanıcının seçtiği deneme adresinde gönderim + teslimat + gelen mesaj + yanıtı doğruladıktan sonra otomatik gönderimi aç.

Supabase Auth’un parola sıfırlama/onay e-postaları ayrı SMTP ayarı kullanır; bu işlevler bu kuyruk kurulumuyla otomatik bağlanmaz. Giriş bildirimi parola veya oturum anahtarı taşımaz.

## Yerel kontroller

- `tests/mail.sql.mjs`: izole PGlite, tekrar kurulum, RLS/roller, limit/kilit/lease, dedup, teslimat yarışları, üyelik/oturum/iş emri/editör olayları ve iptal sınırı.
- `tests/mail.edge.mjs`: bağımlılıksız sahte transport, HMAC, aynı gövdeyle tekrar deneme, gerçek alıcı önizleme özeti, Reply-To ve İngilizce Rufcut mesajları.
- `tests/mail.browser.mjs`: tüm HTTP istekleri kesilir; gerçek Chrome’da beş dil, mobil/tema, inceleme-kuyruk akışı, gelen HTML güvenliği, Rufcut dil izolasyonu ve Heron ortak editör köprüsü.

Bu testler canlı teslimatı veya DNS doğrulamasını kanıtlamaz; gerçek müşteri e-postası göndermez.
