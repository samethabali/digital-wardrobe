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
    Projenin ana dizininde `.env` isimli bir dosya oluşturun ve gerekli API anahtarlarını girin:
    ```env
    GEMINI_API_KEY=sizin_gemini_anahtariniz
    MONGODB_URI=mongodb+srv://...
    CLOUDINARY_CLOUD_NAME=xxx
    CLOUDINARY_API_KEY=xxx
    CLOUDINARY_API_SECRET=xxx
    ```

4.  **Sunucuyu Başlatın**
    ```bash
    npm run dev
    ```
    Tarayıcınızda `http://localhost:3000` adresine giderek uygulamayı kullanmaya başlayabilirsiniz.

## 📱 Yayına Alma (Deployment)

Proje Vercel için tam uyumludur (Serverless). 
Sadece GitHub deponuzu Vercel'e bağlayıp Environment Variables kısmına `.env` dosyasındaki verileri ekleyerek **Sıfır Konfigürasyon** ile tek tıkla canlıya alabilirsiniz.

---
*Geliştirici: [Samet Habalı](https://github.com/samethabali)*
