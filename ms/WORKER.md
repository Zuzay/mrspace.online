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
1. **Anahtarlar**: Google AI Studio (Gemini), platform.deepseek.com, console.anthropic.com. Hepsi şart değil, en az biri yeter.
2. **GitHub > repo > Settings > Secrets and variables > Actions > New secret**:
   - `SUPABASE_URL` = https://tizfdnsjhhepxnqqrzuk.supabase.co
   - `SUPABASE_SERVICE_KEY` = Supabase > Project Settings > API > service_role
   - `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`
   - `GH_PAT` sadece site başka bir repodaysa gerekir
   - Variables sekmesinde `MONTHLY_BUDGET_USD` (varsayılan 10)
3. **Supabase SQL Editor**: `ms/mrspace-worker.sql` çalıştır.
4. Anında tetik için GitHub'da fine-grained token aç (sadece bu repo, Contents: read/write), sonra SQL Editor'da:
   `select vault.create_secret('github_pat_XXXX', 'ms_github_token');`
   Yapmazsan işçi saatte bir kendisi bakar.
5. Rufcut'u bağla: `update ms_sites set repo_path = 'KLASOR/' where slug = 'rufcut';`
6. GitHub > Actions > "Mr. Space işçi" > Run workflow ile ilk denemeyi yap.

## Güvenlik
- İşçi sadece sitenin kendi klasöründeki dosyalara dokunur, en fazla 4 dosya.
- Hiçbir şey onaysız yayına girmez.
- Aylık bütçe dolunca durur, talepler "Uzay'a" düşer.
- Her iş `ms_activity`'ye yazılır (model, maliyet, PR linki).

## Fiyatlar
Model fiyatları değişebilir. Güncellemek için secret/var: `GEMINI_PRICE=0.3,2.5` gibi (1M token başına girdi, çıktı USD). Sadece maliyet hesabı içindir.
