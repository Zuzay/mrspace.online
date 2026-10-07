# Üretici Hat (işçi)

Müşteri talebi gelir, ucuz modeller hazırlar, pull request açar. Uzay panelden onaylar, otomatik yayına girer. Claude aboneliğine (haftalık limit) dokunmaz; API faturaları ayrı.

## Akış
1. Müşteri talep gönderir, `ms_changes` tablosuna düşer.
2. Supabase GitHub'a sinyal yollar, `ms-worker` iş akışı çalışır.
3. Ayırıcı talebi üçe ayırır: **content** (metin, fiyat, saat), **code** (küçük tasarım), **big** (Uzay'a kalır).
4. Düzenleyici değişikliği yazar, `ms/req-ID` dalında PR açar. Panelde talep `ready` olur, PR linki görünür.
5. Panelde **Onayla**: PR birleşir, talep `done`. **Reddet**: PR kapanır.

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
- İşçi sadece sitenin kendi klasöründeki dosyalara dokunur, en fazla 4 dosya.
- Hiçbir şey onaysız yayına girmez.
- Aylık veya talep başı bütçe dolunca yeni model çağrısı yapmaz, talepler "Uzay'a" düşer.
- Her iş `ms_activity`'ye yazılır (model, maliyet, PR linki).

## Fiyatlar
Model fiyatları değişebilir. Güncellemek için secret/var: `GEMINI_PRICE=0.3,2.5` gibi (1M token başına girdi, çıktı USD). Sadece maliyet hesabı içindir.
