# Aura arka plan kaldırma servisi

Kıyafet fotoğraflarının arka planını [BiRefNet lite](https://huggingface.co/onnx-community/BiRefNet_lite-ONNX) (MIT) modeliyle kaldırır, askı/kulp gibi kopuk parçaları temizler ve parçaya kırpılmış PNG döndürür.

Model tek görsel için ~7 GB bellek kullandığı için Vercel'de değil, ayrı bir sunucuda (Oracle Cloud Always Free, 2 ARM çekirdek / 12 GB) çalışır. Görsel başına ~20 sn sürer; işler sırayla yürür.

```
Tarayıcı → Vercel POST /api/wardrobe/:id/cutout → bu servis POST /cutout → PNG → Vercel Cloudinary'ye yükler
```

## API

- `POST /cutout` — `Authorization: Bearer <CUTOUT_SERVICE_TOKEN>`, gövde `{"imageUrl": "https://res.cloudinary.com/<bulut>/image/upload/..."}`.
  Yanıt `image/png`. Hatalar: 401 yetkisiz, 400 geçersiz adres, 422 parça bulunamadı, 503 meşgul (1 çalışan + 1 bekleyen dolu) veya model yükleniyor.
- `GET /health` — `{ ok, modelReady, inFlight }`.

Yalnızca `CLOUDINARY_CLOUD_NAME` hesabındaki görseller indirilir.

## Sunucu ortam dosyası (`/etc/aura-cutout.env`, repoya girmez)

```
CUTOUT_SERVICE_TOKEN=<en az 32 karakter; Vercel'deki CUTOUT_SERVICE_TOKEN ile aynı>
CLOUDINARY_CLOUD_NAME=<bulut adı>
PORT=8080
MODEL_THREADS=2
```

## Kurulum / güncelleme

Yerelde (zhl2/cutout-service):

```bash
npm run build   # ana projenin esbuild'i: npx esbuild ... (package.json'daki komut)
scp -r dist package.json deploy ubuntu@SUNUCU:/tmp/aura-cutout/
```

Sunucuda:

```bash
sudo mkdir -p /opt/aura-cutout && sudo cp -r /tmp/aura-cutout/dist /tmp/aura-cutout/package.json /opt/aura-cutout/
sudo CUTOUT_HOST=130-110-13-57.sslip.io bash /tmp/aura-cutout/deploy/setup.sh
```

Oracle Console'da subnet güvenlik listesinde 80 ve 443 TCP girişine izin verilmiş olmalı.

## İşletim

- Loglar: `journalctl -u aura-cutout -f` (her istek tek satır JSON), Caddy: `/var/log/caddy/cutout.log`
- Yeniden başlatma: `sudo systemctl restart aura-cutout` (model yüklenip ısınana kadar ~15 sn 503 döner)
- Bellek: işlem sırasında ~6.8 GB, boştayken ~1.5 GB. ONNX bellek havuzu bilerek kapalı; açıkken havuz büyüyüp
  sunucuyu swap'e düşürüyor ve istek 20 sn'den 60 sn'ye çıkıyordu.
- Oracle, 7 gün boyunca işlemci, ağ ve bellek kullanımının üçü de %20'nin altında kalan Always Free sunucuları geri alabilir.
  Uzun süre kullanılmayacaksa sunucunun durumunu Oracle Console'dan ara ara kontrol et.
