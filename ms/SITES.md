# Müşteri siteleri: site.json ile standart yayın

Her müşteri sitesi tek bir ayar dosyasıyla tanımlanır: `sites/<slug>/site.json`. Kaynak tasarım bu repoda kalır (ör. `rufcut/`, `iwona-ash/`), müşterinin alan adı ayrı bir GitHub reposundan (Pages) yayınlanır.

## Alanlar
- `source`: bu repodaki site klasörü.
- `skip_prefixes`, `exclude`: yayına girmeyecek dosyalar (iç notlar, eski yedekler).
- `domain`: müşteri alan adı. Boşsa site sadece önizlemedir (CNAME/robots/sitemap yazılmaz).
- `cname_newline`: mevcut CNAME biçimini korumak için (false = satır sonu yok).
- `repo`: yayın reposu (`org/repo`). Boşsa otomatik yayın yapılmaz.
- `shared`: sitenin kullandığı ortak Mr. Space dosyaları (`assets/` altından), dil sözlükleri.
- `cache_version` + `versioned`: index.html içindeki `?v=` etiketleri.
- `rewrites`: önizleme metinlerini canlı metne çeviren birebir değişiklikler. Metin bulunamazsa build durur (kaynak değişmiş demektir).
- `pages`, `redirects`: sitemap ve `_redirects`.

## Komutlar
```sh
node tools/build-site.mjs rufcut /tmp/rufcut-out      # yerel build
```
`tools/build-rufcut-release.mjs` eski yoldur; aynı çıktıyı üretir (iç notlar hariç), yeni işlerde `build-site.mjs` kullanılır.

## Otomatik yayın
`.github/workflows/publish-sites.yml`: main'e `sites/`, `assets/`, site klasörleri veya builder değişince çalışır. Her site için build alır, müşteri reposuna kopyalar, sadece değişiklik varsa commit atar. Müşteri reposunda dosya silmez.
- `SITES_DEPLOY_TOKEN` secret'ı yoksa: kuru çalışma, sadece neyin değişeceğini listeler.
- Secret: GitHub fine-grained token, sadece müşteri repoları, Contents: Read and write. Repo Settings > Secrets and variables > Actions.
- Elle çalıştırma: Actions > Publish client sites > Run workflow (slug opsiyonel).

## Yeni müşteri
1. Tasarımı `<slug>/` klasörüne koy (ortak editör kuralları: `ms/REQUEST-EDITOR.md`).
2. `sites/<slug>/site.json` oluştur (rufcut örneğini kopyala), önce `domain` ve `repo` boş.
3. Hazır olunca org'da boş repo aç, Pages'i main/root yap, `repo` ve `domain` doldur. Merge sonrası workflow yayınlar.
4. DNS: alan adı A kayıtları 185.199.108-111.153, www için CNAME `mrspace-online-studio.github.io`.

Supabase fonksiyonları: `.github/workflows/supabase-deploy.yml` (secret `SUPABASE_ACCESS_TOKEN`).
