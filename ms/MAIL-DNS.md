# mrspace.online / Resend DNS

GoDaddy: mrspace.online → DNS → Kayıt ekle. Resend domain kimliği: `804c48cd-b3af-451d-91a0-5ab5913a6383`. Bölge: us-east-1. TTL varsayılan olabilir. A/CNAME web kayıtlarına dokunulmaz. DNS alanı sona alan adını kendisi ekliyorsa adları aşağıdaki kısa biçimde gir.

| Tür | Ad | Değer | Öncelik |
| --- | --- | --- | --- |
| TXT | `resend._domainkey` | aşağıdaki DKIM değeri | |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | |
| CNAME | `rsend` | `send.forge.rmta.net` | |
| MX | `@` | `inbound-smtp.us-east-1.amazonaws.com` | 10 |

DKIM TXT değeri (tamamı tek kayıt):

```text
p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCyOUGok5P1y4Z+dw1GUo/xNnf6wBb0L4hiqD4q1YWeq6+XD59OBvgPjjf2DtnuUYtuXYSV1OBukpNGcEkBg9eU2u0v/y4i15T54dRJXJ4DuRnzow67LR+OvW2MPBCrzuBQJ+QV8EBD52rnZUuZ5Tsi2hJmUuY1tqiDX+7IxTQhLQIDAQAB
```

Bu herkese açık DNS anahtarıdır, API sırrı değildir. Kayıtlar eklendikten sonra Resend’de domain sayfasından doğrula. Sağlayıcının güncel domain ekranındaki değerler esas alınır. SPF aynı ad altında ikinci bağımsız kayıt olarak eklenmez. Başka posta hizmeti sonradan kurulursa kök MX ve gelen posta rotası birlikte yeniden düzenlenir.

Hazırlama sırasında kök MX ve DKIM sorguları boştu. Domain eklenmiş olması gönderim/gelen posta hazır demek değildir. Sunucu API anahtarı, imzalı webhook, SQL ve Edge Function adımları için [MAIL.md](MAIL.md).
