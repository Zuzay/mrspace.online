# AGENTS.md: bu repoda çalışan her AI için kurallar

Bu repo mrspace.online: Mr. Space web stüdyosunun sitesi, süper admin paneli ve müşteri sistemi. Sahibi Uzay (kullanıcı adı `mr.space`). Bu repoda Claude ve ChatGPT/Codex sırayla çalışır. Kurallar ikisi için de aynı.

## Önce oku
- `README.md`: sayfalar, merkezi sistem, diller, panel girişi
- `ms/WORKER.md`: Üretici Hat (müşteri taleplerini ucuz modellerle hazırlayan işçi)
- `ms/PANEL-PLAN.md`: sıradaki iş

## Yapı
- Statik site (HTML/CSS/JS), derleme adımı yok, framework yok. Yeni kütüphane ekleme.
- Veritabanı: Supabase (laloo projesi). Tablolar ve fonksiyonlar `ms_` ile başlar. SQL dosyaları `ms/` altında ve **tekrar çalıştırılabilir** olmalı (`if not exists`, `create or replace`).
- Süper panel: `admin/`. Müşteri talep sayfası: `request/`. İşçi: `ms/worker/worker.mjs` (Node 20, bağımlılıksız).
- Yayın: GitHub Pages (ileride Cloudflare).

## Kurallar
1. **Her iş ayrı dalda, ayrı PR.** Ana dala doğrudan yazma. PR açıklaması Türkçe ve kısa: ne değişti, nasıl test edilir.
2. **Aynı anda tek AI.** Açık bir PR'ın dosyalarına başka iş için dokunma.
3. **5 dil.** Panelde ve sitede yeni metin eklersen sözlüklere de ekle: site `assets/lang/{es,de,fr,tr}.json` (kaynak İngilizce), panel `assets/lang/admin-{en,es,de,fr}.json` (kaynak Türkçe). Aynı sayfada karışık dil olmasın.
4. **Güvenlik.**
   - Gizli anahtar asla koda, repoya veya istemciye (tarayıcı) girmez. Sunucu tarafı anahtarlar GitHub Secrets veya Supabase vault'ta.
   - Her yeni tabloda RLS açık; yönetici politikası `ms_is_admin()`.
   - Müşterinin yapabildiği her şey `security definer` fonksiyon üzerinden ve `site_key` ile.
   - İzleyici (viewer) rolü hiçbir şeyi değiştiremez, ödemeleri, anahtarları ve müşteri iletişimini göremez.
5. **Onaysız yayın yok.** İşçinin hazırladığı her değişiklik Uzay'ın panel onayından geçer.
6. **Müşteri klasörü sınırı.** İşçi bir müşterinin sadece kendi `repo_path` klasörüne dokunur.
7. **Mevcut tasarımı koru.** `assets/site.css` değişkenlerini kullan, açık/koyu tema ikisi de çalışsın, mobil genişlikte taşma olmasın.
8. **Yazı kuralı.** Kullanıcıya görünen Türkçe metinlerde uzun tire (—) kullanma.
9. **Silme yok.** Dosya veya tablo silmen gerekiyorsa PR açıklamasında sor, kendin silme.
