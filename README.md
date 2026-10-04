# mrspace.online (v2)

Mr. Space web stüdyosu sitesi. Ekim 2026 planına göre yeniden yazıldı.

## Sayfalar
- `index.html` : Ana sayfa. Giriş + kontrol paneli, ne yapıyoruz (site / sistem / bakım), "Made to measure" (her şey sana özel yazılır), işler (3 kodlanmış demo), süreç, paketler özeti, iletişim.
- `packages/` : Paket 1-2-3, ilk müşteri indirimi, karşılaştırma tablosu, ekler, saatlik ücret, Custom çıkış bedeli, değişiklik kotası, kurallar, SSS.
- `first-clients/` : İlk müşteri (launch offer) sayfası. Normal fiyatların üstü çizili, $300 kurulum, $50/ay, eklentiler dahil, değişiklik kotası iki katı. Ana sayfa ve paketler sayfasındaki siyah şerit buraya gider.
- `start/` : Dallanan başvuru formu (8 adım). POS, scanner, printer, etiket, mevcut site, sosyal medya, örnek siteler. Sunucu yok: "Send by email" mail uygulamasını hazır metinle açar, "Copy answers" panoya kopyalar. Taslak sadece ziyaretçinin cihazında saklanır.
- `rufcut/` : Eski Rufcut konsept demosu, dokunulmadı.
- `404.html`, `sitemap.xml`, `robots.txt`, `CNAME`, `og.png`

## Ortak dosyalar
- `assets/site.css` : Renkler, yazılar, cetvel, butonlar, etiket kartları. Açık ve koyu tema.
- `assets/demos.css` + `assets/demos.js` : Demo oynatıcı. Her demo bir dakikanın altında, sessiz, döngüde. Ekrandan çıkınca durur, adıma tıklayınca oraya atlar, "hareketi azalt" ayarında duraklatılmış başlar.
- `assets/laloo-logo.png`

## Demoları değiştirmek
`assets/demos.js` içinde üç tanım var: `HERON`, `RUFCUT`, `LALOO`. Her birinde `chapters` (adım adları), `html` (ekranın içeriği) ve `run` (senaryo) var. Senaryo komutları: `a.scene()`, `a.url()`, `a.go()`, `a.tap()`, `a.type()`, `a.toast()`, `a.wait()`.

## Yapılacaklar
- hello@mrspace.online çalışıyor mu kontrol et.
- Form için ileride: Supabase'e kayıt + otomatik mail (şu an mail uygulaması üzerinden).
- Rufcut kabul ederse etiketi "Client" olarak kalır; etmezse `index.html` içinde "Concept" yap.
