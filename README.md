# Aura | Akıllı Gardırop ✨

Aura, dolabınızdaki kıyafetleri dijital bir ortama taşımanızı ve gelişmiş yapay zeka özellikleriyle günlük kombinler oluşturmanızı sağlayan **kişisel stil asistanınızdır**. 

Yüklediğiniz kıyafetlerin fotoğraflarını **Gemini Vision AI** ile otomatik analiz eder (renk, kumaş, stil, desen vb.) ve günlük hava durumu verilerini de göz önüne alarak, katılacağınız etkinliğe veya ruh halinize en uygun kombinasyonları saniyeler içinde sizin için derler.

## 🚀 Özellikler

- **Yapay Zeka Destekli Analiz:** Fotoğrafını çektiğiniz bir kıyafetin kategorisini, alt kategorisini, rengini, tarzını ve hangi hava durumunda giyileceğini otomatik olarak tespit eder.
- **Akıllı Karar Motoru (Stilist):** Dışarı çıkmadan önce konumunuzu, gideceğiniz yeri (Örn: Ofis, Parti, Spor) ve yorgunluk seviyenizi girin; Aura size gardırobunuzdan en uygun 3-4 parçalık kombini tavsiye etsin.
- **Canlı Hava Durumu Entegrasyonu:** Kombinler oluşturulurken sistem o anki şehrinizin sıcaklık ve hava durumunu (Açık, Yağmurlu, Karlı vb.) anlık çeker. Böylece 10 derecelik havada tişört önermez.
- **Bulut Tabanlı Depolama:** Kıyafet görselleriniz Cloudinary üzerinden buluta yüklenir, hiçbir veriniz kaybolmaz.
- **Tamamen Mobil Uyumlu:** Telefon ekranlarından da bir tıkla yeni kıyafet ekleyebilir, Karar Motoru'nu sağ menüden çekerek hızlıca kombin önerisi alabilirsiniz.
- **Kombinlerim:** Yapay zekanın oluşturduğu kombinasyonları çok sevdiyseniz, onlara bir isim vererek "Kombinlerim" sekmesine kaydedebilirsiniz.

## 🛠️ Kullanılan Teknolojiler

Aura, modern web standartlarında hız ve estetiği birleştiren güçlü bir "MERN/Vite" stack altyapısına sahiptir.

*   **Frontend:** React (Vite), Tailwind CSS, Framer Motion, Lucide Icons
*   **Backend:** Node.js, Express.js
*   **Veritabanı:** MongoDB Atlas
*   **Depolama (Medya):** Cloudinary API
*   **Yapay Zeka:** Google Gemini 2.5 Flash
*   **Harici API'ler:** Open-Meteo (Konum ve Hava Durumu)

## 💻 Kurulum ve Geliştirme (Local)

Eğer projeyi kendi bilgisayarınızda çalıştırmak isterseniz aşağıdaki adımları izleyebilirsiniz.

1.  **Projeyi Klonlayın**
    ```bash
    git clone https://github.com/samethabali/digital-wardrobe.git
    cd digital-wardrobe
    ```

2.  **Bağımlılıkları Yükleyin**
    ```bash
    npm install
    ```

3.  **Çevre Değişkenlerini (Environment Variables) Ayarlayın**
    `.env.example` dosyasını `.env` olarak kopyalayıp doldurun. `MONGODB_URI`, `JWT_SECRET` (en az 32 karakter), `GEMINI_API_KEY` ve `CLOUDINARY_*` zorunludur; kodda bunların yedek değeri yoktur. Güçlü bir `JWT_SECRET` üretmek için:
    ```bash
    node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
    ```
    Günlük kombin bildirimi için `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (`npx web-push generate-vapid-keys`) ve `CRON_SECRET` isteğe bağlıdır.

4.  **Sunucuyu Başlatın**
    ```bash
    npm run dev
    ```
    Tarayıcınızda `http://localhost:3000` adresine giderek uygulamayı kullanmaya başlayabilirsiniz.

## 🧪 Test ve Ölçüm

| Komut | Ne yapar |
|---|---|
| `npm test` | Birim ve uç nokta testleri (bellek içi MongoDB; ağ ve API anahtarı gerekmez) |
| `npm run lint` | TypeScript tip kontrolü |
| `npm run eval` | Öneri motoru değerlendirmesi (3 gardırop × 10 senaryo); `-- --llm` ile AI stilist dahil |
| `npx tsx scripts/list-models.ts` | API anahtarının erişebildiği Gemini modelleri ve koddaki listelerin kontrolü |
| `npx tsx scripts/embed-knowledge.ts` | Stil bilgi tabanı embedding'lerini önbelleğe yazar (kural/model değişince) |
| `npx tsx scripts/train-reranker.ts` | Geri bildirimlerden uyum yeniden sıralayıcısını eğitir (yeterli veri varsa) |

## 📱 Yayına Alma (Deployment)

Proje Vercel'de çalışır. Vercel, depodaki derlenmiş `api/index.js` sunucu paketini kullanır: sunucu kodunu değiştirdiğinizde `npm run build` çalıştırıp paketi de commit edin (`npm test` paketin güncel olmadığını yakalar).

Vercel Environment Variables kısmına `.env.example`'daki değişkenleri ekleyin. `vercel.json` içindeki zamanlanmış görev her sabah 08:00'de (TSİ) `/api/cron/daily` uç noktasını çağırır; `CRON_SECRET` tanımlı olmalıdır.

---
*Geliştirici: [Samet Habalı](https://github.com/samethabali)*
