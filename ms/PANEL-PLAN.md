# İşçi paneli planı (limit yenilenince yapılacak)

Hedef: her şey süper panelden yönetilsin, güvenli çalışsın, patlamasın. GitHub/Supabase'e sadece ilk kurulumda bir kez girilir.

## Panelde "İşçi" bölümü
- Aç/kapa anahtarı (tüm otomasyonu durdurur)
- API anahtarları: Gemini, DeepSeek, Claude. Supabase vault'ta şifreli; panelde sadece son 4 hane. İşçi anahtarları DB'den okur (GitHub secret'ta sadece SUPABASE_URL ve SERVICE_KEY kalır)
- Model sırası: iş türüne göre (classify / content / code) panelden seçilir
- Bütçe: aylık tavan, talep başına tavan, bu ayki harcama göstergesi
- Site ayarları: repo ve repo_path panelden (SQL yok)
- Talep kartı: önce/sonra farkı, önizleme linki, maliyet, model; Onayla / Reddet / Tekrar dene / Geri al
- "Şimdi çalıştır" butonu (repository_dispatch)

## Patlamama önlemleri
1. Takılan iş: 15 dk'dan uzun "working" olan iş failed olur, 1 kez otomatik tekrar
2. Yayın öncesi kontrol: HTML bozuk mu, yeni script/dış domain var mı, değişiklik boyutu sınırı. Geçemeyen onaya gelmez
3. Geri alma: yayındaki değişikliği panelden revert PR + birleştirme
4. Hata bildirimi: panelde kırmızı uyarı + mail
5. Mevcut: sadece site klasörü, en fazla 4 dosya, onaysız yayın yok

## Teknik notlar
- Yeni tablo: ms_worker_settings (enabled, routes jsonb, budget_month, budget_per_request)
- Admin RPC: ms_set_ai_key(provider, key) vault'a yazar; ms_ai_keys_masked() son 4 haneyi döner; işçi service key ile ms_ai_keys() okur
- Önizleme: Cloudflare Pages geçişinden sonra dal başına önizleme URL'si; o zamana kadar PR diff
- Önce admin/ kodu okunacak, yeni bölüm mevcut tasarım ve 5 dil sözlüğüne uygun eklenecek (admin-{en,es,de,fr}.json)
