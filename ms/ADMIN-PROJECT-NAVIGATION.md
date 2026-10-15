# Proje odaklı yönetim sistemi

Kullanıcı ana admin dosyasına dokunmadan ayrı giriş istedi. Kalıcı giriş `/admin/projects.html`; `admin/index.html` ve açık #45 dosyaları bu PR'da değiştirilmez. Bu sayfa varsayılan olarak gerçek `ms_admin` oturumunu ve mevcut API'leri kullanır. `?preview=1` yalnızca açıkça seçilen örnek moddur; örnek moddaki servis işlemleri sunucuya gönderilmez.

## Kullanım

1. Yönetici hesabıyla giriş yap, proje seç. Ana listeye bütün projelerin kayıtları dökülmez.
2. Rufcut'ta İş emirleri: müşteri bilgileri, ölçüler, notlar, durum ve yazdırılabilir fiş. Yeni müşteri işi mevcut Rufcut onarım formundan alınır. Durum kaydı mevcut bildirim mekanizmasını çalıştırabileceği için açık onay gösterilir.
3. Müşteri projelerinde Ürünler ve stok: Square bağlantısı, ürün/varyasyon oluşturma, fotoğraf yükleme, site yerleşimi ve satın alma bağlantıları, yayın anahtarı, stok adedi. Yeni ürünler inceleme alanında oluşturulur. Desteklenmeyen arşiv API'si için düğme gösterilmez.
4. Satış ve kargo: teslimat bölgeleri, ücretler, ürün hazırlığı, kurulum engelleri ve mevcut fiyat hesaplama. Bu ekranın mevcut altyapısı hazırlık aşamasındadır; yeni ödeme/çekim motoru oluşturulmaz ve eksik izinler hazır gösterilmez.
5. Ayarlar: proje bilgileri, mevcut müşteri hesabını projeye bağlama, talep bağlantısı, hizmet paketi ve yalnız bu projenin servis bağlantıları. Yeni Auth hesabı mevcut kimlik sisteminden oluşturulur; projeye bağlamak hesap oluşturmaz.
6. Heron/Laloo mevcut yetkili yönetim köprülerini kullanır. Genel başvuru, hazırlama, inceleme ve erişim araçları sistem bölümündedir. Proje geçmişi, sürümler, kullanım ve faturalama proje yönetimi bölümündedir.

## Sınırlar ve korumalar

- Mevcut sunucu yetkileri korunur. Viewer operasyonlara, müşteri iletişimine, ödemelere ve yazma işlemlerine erişemez.
- İşlem sırasında düğmeler ve proje geçişi kilitlenir. Hatalı kayıtta form/not korunur. Kaydedilmemiş düzenleme için çıkış onayı vardır; otomatik yenileme bu düzenlemeleri silmez.
- API isteği açıldığı projenin slug ve kayıt ID'sini taşır. Geciken yanıt başka projenin ekranını değiştiremez.
- Üretim verisi, gerçek e-posta ve ödeme üzerinde test yapılmaz. Square/OAuth, iş emri ve kimlik altyapısının mevcut kurulumu gerekir. Bağlantı veya kurulum hataları görünür; başarısız sorgu boş/başarılı sonuç gibi sunulmaz.
- Beş dil, açık/koyu tema, mobil/tablet kullanım korunur. Framework, yeni bağımlılık, şema veya Edge Function değişikliği yoktur.
- Yerel checkout ana daldan eski olduğu için test/gösterim sunucusu mevcut ana dal bağımlılıklarını `/tmp/ms-admin-console-base` içinden okur (`MS_ADMIN_BASE`). Ortak sözlükler ve kaynak dosyaları değiştirilmez; uzak PR bunları değiştirmez.

## Doğrulama

`tests/admin-projects.browser.mjs`: proje araması, proje kapsamı, geçmiş/kullanım indisleri/sürümler, URL yenileme, viewer sınırı, geçersiz proje, mobil/tablet, beş dil ve koyu tema.

`tests/admin-console.browser.mjs`: gerçek oturum sözleşmesiyle sahte API; iş emri başarısızlığı/tekrar kaydı, çift gönderim ve gezinme kilidi, stok/yerleşim/fotoğraf/yayın işlemleri, satış ayarı hatasında koruma, yeni müşteri ve hizmet paketi kaydı, gerçek viewer snapshot, geciken yanıt ve servis hata/yeniden deneme. Bütün uzak istekler engellenir veya sahte yanıtlanır.

Uzak dal güncel main `5d7633593d9517fbc76b6fb8c2f61d77462fc7a8` üzerine yalnız bu işin dosyalarıyla kurulmalıdır; eski yerel dal komple gönderilmemelidir. Yeni değişiklikler için merge/yayın yapılmadı.
