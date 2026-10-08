# Üretici Hat (işçi)

Müşteri talebi gelir, ucuz modeller hazırlar, pull request açar. Uzay hazırlanan kodu inceler ve ayrıca yayın izni verir. Merge ve canlı deployment ayrı doğrulanır. Claude aboneliğine (haftalık limit) dokunmaz; API faturaları ayrı.

## Akış
1. Müşteri talep gönderir, `ms_changes` tablosuna düşer.
2. Supabase GitHub'a sinyal yollar, `ms-worker` iş akışı çalışır.
3. Ayırıcı talebi üçe ayırır: **content** (metin, fiyat, saat), **code** (küçük tasarım), **big** (Uzay'a kalır).
4. Düzenleyici değişikliği yazar, `ms/req-ID` dalında PR açar. Panelde talep `ready` olur, PR linki görünür.
5. Kırmızı içerik önizlemesi ve hazırlanan PR kodu incelenir. İnceleme onayı yayın değildir. Ayrı yayın izni ve eşleşen tam SHA gerekir. İşçi `ms_claim_release` ile kararı atomik alır; GitHub `--match-head-commit` kontrolüyle merge eder. Merge kaydı otomatik `done` veya “canlıya çıktı” yazmaz. **Reddet**: PR kapanır.

## Model sırası (anahtarı olmayan atlanır)
- Ayırıcı ve içerik: Gemini, DeepSeek, Haiku
- Kod: DeepSeek, Haiku, Gemini

Biri hata yaparsa (ör. yanlış yer bulursa) sıradaki dener. Hepsi başarısız olursa talep `failed` olur, sen Claude ile yaparsın.

## Kurulum (bir kez)
1. GitHub Actions secrets içine yalnızca `SUPABASE_URL` ve `SUPABASE_SERVICE_KEY` koy. AI anahtarlarını GitHub'a ekleme.
2. Supabase SQL Editor'da önce `ms/mrspace-system.sql`, sonra `ms/mrspace-worker-panel.sql` çalıştır. Bu migration varsayılan olarak kapalı işçi ayarı oluşturur.
3. Mr. Space admin panelinde **İşçi** bölümünü aç. Google AI Studio, DeepSeek veya Anthropic API anahtarını ve GitHub fine-grained token'ını ekle. En az bir AI anahtarı ve GitHub token gerekir.
4. GitHub token'ını yalnızca bu repo ile sınırla; Contents ve Pull requests için yazma izni ver. Token Supabase Vault'ta saklanır; panel sadece son dört haneyi gösterir.
5. Her site için repo ve repo köküne göre klasör yolunu gir. Boş klasör yolu işçinin o siteye dokunmasını engeller.
6. Aylık ve talep başı bütçeyi belirle. Modelleri iş türüne göre sırala. Hazır olunca işçiyi panelden aç ve **Şimdi çalıştır** ile dene.

## Güvenlik
- İşçi sadece sitenin kendi klasöründeki dosyalara dokunur, en fazla 4 dosya. Geçici worktree kullanır; symlink, üst klasör, admin/secret dosyası, çalıştırılabilir blok ve yeni origin müdahalesi insana kalır. Force push yoktur.
- Hiçbir şey onaysız yayına girmez.
- Aylık veya talep başı bütçe dolunca yeni model çağrısı yapmaz, talepler "Uzay'a" düşer.
- Her iş `ms_activity`'ye yazılır (model, maliyet, PR linki).

## Fiyatlar
Güncel model fiyatları operatör tarafından `GEMINI_PRICE`, `DEEPSEEK_PRICE`, `ANTHROPIC_PRICE` GitHub vars alanlarına `girdi,çıktı` biçiminde USD/1M token olarak girilir. Fiyatı tanımlı olmayan sağlayıcı çağrılmaz. Ücretli API yanıtı/usage belirsizse kalan talep bütçesi ihtiyatla maliyet kaydına girer ve yeni deneme durur. Sağlayıcı hesabında harcama limiti de gerekir; bu fatura garantisi değildir.

## Taslak atölyesi

`draft-worker.mjs` ücretli modellerden bağımsızdır. `MS_DRAFT_ENABLED` varsayılan kapalıdır. İki işi atomik alır, mevcut renderer ile özel HTML hazırlayıp insan incelemesine bırakır. Yeni/belirsiz araç insan geliştirmesi gerektirir. İnceleme kabulü müşteri yayını veya PR merge değildir. Sonraki kurulum ve doğrulama: [PLATFORM-DELIVERY.md](PLATFORM-DELIVERY.md).
