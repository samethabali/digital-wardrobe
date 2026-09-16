# Mobil Odaklı Arayüz Yenilemesi – Notlar

> Tarih: 16 Eylül 2026
> Durum: **Tamamlandı.** Tüm mimari yenileme, primitifler, paneller, ekranlar, ayarlar, yönlendirmeler bağlandı ve testler başarıyla geçti.

---

## 1. Mevcut arayüzde bulunan sorunlar

### Mobil kullanılabilirlik
- **Dokunmatikte çalışmayan eylemler.** Kombin sonucundaki "Kilitle" ve "Bu parçayı değiştir" düğmeleri, parça silme düğmesi ve kayıtlı kombinde "parçayı çıkar" düğmesi yalnızca `group-hover` ile görünüyor. Telefonda fareyle üzerine gelme olmadığı için bu düğmeler pratikte bulunamıyor.
- **Sıkışık gezinme.** Mobil alt çubukta Koleksiyon, Kombinler, Ekle, AI Asistan ve Durum var. Keşfet, Seyahat ve Hesap ayrı bir yan çekmecede; planlayıcı ise sağdan kayan tam ekran bir panel. Aynı uygulamada üç farklı gezinme kalıbı var.
- **Tarayıcının geri tuşu çalışmıyor.** Sekmeler URL'ye bağlı değil (`activeTab` durumu). Android'de geri tuşu uygulamadan çıkıyor.
- **Yükseklik ve kaydırma.** Ana yerleşim `h-screen` + iç `overflow-y-auto` kullanıyor. Mobil tarayıcıda adres çubuğu küçülmüyor; `100vh` iOS'ta alt çubuğun arkasına taşıyor. Güvenli alan (`safe-area-inset`) yalnızca bir yerde (`pb-safe`, tanımsız sınıf) kullanılmış.
- **iOS'ta form yakınlaştırması.** Birçok alan `text-xs` / `text-sm` (12–14px). iOS, 16px altındaki alanlara odaklanınca sayfayı yakınlaştırıyor.
- **Küçük dokunma hedefleri.** 10–11px yazılı, `py-1` / `p-1` düğmeler çok (çipler, kategori filtreleri, kapatma düğmeleri). Önerilen en küçük hedef 44×44px.
- **Parça ekleme.** Kamera ve galeri aynı `<input>` (capture yok). Analiz ayrı bir düğmeyle başlatılıyor; kaydet düğmesi uzun formun sonunda.
- **Uzun planlayıcı formu** sağ kenar çubuğuna sıkıştırılmış (masaüstünde 320px); mobilde ayrı panel. Sonuçlar ise başka bir sekmede (Koleksiyon) açılıyor. Kullanıcı formu gönderince ekran değişiyor.

### Görsel tutarlılık
- **Renkler kıyafetlerle yarışıyor.** İndigo, fuşya, mor degradeler ve renkli gölgeler her yerde. Moda uygulamasında asıl içerik kıyafet fotoğrafları; doygun arayüz renkleri parça renklerini algılamayı zorlaştırıyor.
- **Tema jetonları eksik.** `index.css` yalnızca `bg-primary`, `bg-secondary`, `text-primary`, `text-secondary`, `border-border-color` tanımlıyor. Bileşenlerde çok kullanılan `text-text-primary` ve `text-text-secondary` hiçbir yerde tanımlı değil (Tailwind v4 bunları üretmiyor, metin rengi miras kalıyor).
- **Koyu tema düzgün çalışmıyor.** Tailwind v4'te `dark:` varyantı varsayılan olarak sistem tercihine (`prefers-color-scheme`) bağlı. Uygulama `.dark` sınıfını elle ekliyor ama `@custom-variant dark` tanımı yok. Sonuç: ayardan "koyu" seçilince CSS değişkenleri değişiyor ama `dark:` sınıfları değişmiyor (ya da tersi). İki sistem birbirine karışıyor.
- **Tutarsız bileşenler.** Her ekranda düğme, çip, modal ve kart stilleri elle yazılmış; köşe yuvarlaklıkları 8px ile 40px arasında değişiyor. Ortak bileşen yok.
- **Yazı tipleri** CSS içinden `@import` ile yükleniyor (render'ı bekletir). Inter + Outfit, karakteri olmayan bir eşleşme.

### Kodla ilgili
- `App.tsx` ~1.500 satır: tüm durum, iş mantığı ve görünüm tek dosyada.
- Keşfet'teki beraber kombin kutusu, kendi parçaları için `/api/wardrobe?limit=200` çekiyor; 200'den fazla parçası olan kullanıcıda parçalar görünmüyor (artık `?ids=` var).
- Onay penceresinin düğmesi her zaman "Evet, Sil" yazıyor; "izni geri çek" gibi silme olmayan onaylarda da aynı metin çıkıyor.

---

## 2. Tasarım yönü araştırması

| Karakter | Örnekler | Artıları | Eksileri (bu uygulama için) |
|---|---|---|---|
| **Editoryal minimal (sıcak nötr)** | Moda dergileri, Whering, SSENSE, COS | Fotoğraflar öne çıkar; zamansız, "moda" hissi; açık/koyu temada sade kalır | Dikkatli tipografi ister; aşırı sade olursa soğuk durabilir |
| Glassmorphism / degradeler (mevcut) | Birçok AI ürünü | "Teknolojik" görünür | Kıyafet renkleriyle çakışır; bulanıklık düşük donanımlı telefonlarda yavaş; okunabilirlik düşük |
| Material 3 | Android uygulamaları | Hazır mobil kalıplar, erişilebilir | Kişiliksiz; moda ürününe "araç" havası verir |
| Neo-brutalizm | Gumroad, bazı Gen-Z ürünleri | Akılda kalır, eğlenceli | Kalın çizgi ve sert renkler fotoğrafları bastırır; günlük kullanımda yorucu |
| Koyu lüks | Alta Daily, lüks markalar | Premium his | Ürün fotoğrafları genelde açık zeminde çekiliyor; koyu varsayılan tema kontrastı bozuyor |

**Karar: sıcak nötr editoryal minimal.**
- Arayüz geri planda kalmalı; renk yalnızca kıyafetlerden gelmeli.
- Kağıt tonu zemin (`#f5f1eb`) beyaz arka planlı ürün fotoğraflarını yumuşatıyor.
- Tek vurgu rengi: **kiremit** (`#a8482a`, koyu temada `#dd7a52`). Nötr kıyafet renkleriyle (lacivert, bej, siyah) çakışmıyor, yalnızca birincil eylemlerde kullanılıyor.
- Başlıklar **Fraunces** (değişken serif, dergi hissi), arayüz metni **Manrope** (küçük boyutlarda okunaklı, Türkçe karakterleri iyi).

### Uygulanacak mobil kalıplar
- **Alt sekme çubuğu, 5 öğe:** Dolap · Kombinler · **Oluştur** (ortada, yükseltilmiş vurgu düğmesi) · Keşfet · Profil. Seyahat, Oluştur ekranında bir mod; istatistik ve ayarlar Profil'in altında.
- **Sekmeler URL'ye bağlı** (`/`, `/kombinler`, `/olustur`, `/kesfet`, `/profil`); geri tuşu çalışır, bildirimden `/?gunluk=1` ile açılır.
- **Alttan açılan paneller (bottom sheet):** tutamaç, aşağı sürükleyerek kapatma, altta sabit birincil düğme, mobilde tam ekran seçeneği. Masaüstünde aynı bileşen ortalanmış pencereye dönüşür.
- **Hover'a bağlı eylem yok:** kilitle/değiştir düğmeleri her zaman görünür.
- **Başparmak bölgesi:** birincil eylemler (Kaydet, Giydim, Oluştur) ekranın altında.
- **Yapışkan, kaydırınca küçülen başlık;** altında yatay kaydırılan filtre çipleri.
- **Alternatif kombinler** yatay kaydırılabilir (scroll-snap) şerit.
- **Pencere kaydırması:** iç kaydırma kabı yerine `window` kaydırılır; `100dvh` ve güvenli alanlar (`env(safe-area-inset-*)`).
- **16px form alanları, 44px dokunma hedefleri.**
- **PWA:** `manifest.webmanifest`, `theme-color`, `apple-mobile-web-app-*`; ana ekrana eklenebilir, kısayollar ("Kombin oluştur", "Günün kombini").
- **Tema:** Sistem / Açık / Koyu. İlk boyamadan önce `index.html` içindeki küçük betikle uygulanır (yanıp sönme olmaz). Eski `aura_dark_mode` anahtarı okunup taşınır.

### Masaüstü
- Sol sabit menü (264px), içerik en fazla 1152px genişlikte ortalı.
- Oluştur ekranında iki sütun: solda form, sağda sonuç.
- Paneller ortalanmış pencere.

---

## 3. Mimari plan

```
src/
  index.css                 tasarım jetonları (CSS değişkenleri → Tailwind @theme inline)
  hooks/
    useMediaQuery.ts        useIsDesktop (lg ≥ 1024px)
    useTheme.ts             sistem/açık/koyu
  contexts/
    StylistContext.tsx      App.tsx'ten taşınan kombin mantığı (form, sonuç, değiştir/yenile/kilit,
                            geri bildirim, kaydet, beraber kombin, kayıtlı kombinler, parça sözlüğü)
  components/
    ui/primitives.tsx       Button, IconButton, Chip, Card, SectionTitle, Eyebrow, Spinner,
                            EmptyState, Notice, Avatar, Toggle, ItemImage
    ui/Sheet.tsx            alttan açılan panel / masaüstü pencere
    ui/fields.tsx           Label, Input, Textarea, Select, Field, Segmented, ScaleSelector
    layout/AppShell.tsx     alt sekme çubuğu + masaüstü sol menü, <Outlet/>
    layout/PageHeader.tsx   yapışkan, kaydırınca küçülen başlık
    wardrobe/ItemCard.tsx
  views/ (yazılacak)
    WardrobeView            günün kombini kartı, eksik bilgi bandı, kategori çipleri, 2 sütunlu ızgara,
                            seçim modu (altta: Giydim / Kombin olarak kaydet), sonsuz kaydırma
    OutfitsView             kayıtlı kombin kartları; eylemler "…" panelinde (giydim, düzenle, parça ekle, sil)
    CreateView              segment: Kombin | Beraber | Seyahat. Sonuç aynı ekranda; masaüstünde iki sütun
    ExploreView             segment: Kişiler | Beraber kombinler (okunmamış rozeti); profil gardırobu panelde
    ProfileView             kullanıcı başlığı; segment: İstatistik | Ayarlar (profil, gizlilik, stil profili,
                            görünüm, çıkış, hesabı sil)
```

Diğer kararlar:
- `NotificationContext` korunur. Bildirimler mobilde üstte, masaüstünde sağ altta gösterilecek. `askConfirm` isteğe bağlı onay düğmesi metni alacak.
- `WardrobeContext` artık `total` döndürüyor. `handleDeleteItem` başarı durumunu (`boolean`) döndürüyor ve listeyi yeniden çekmeden güncelliyor (panel yalnızca silme başarılıysa kapanacak).
- Konum seçimi tek bir `LocationPicker` bileşeni olacak: seçili konum çipi + panelde arama, GPS, popüler şehirler, il/ilçe. Planlayıcı, beraber kombin ve seyahat bunu paylaşacak.
- Eski bileşenler (`OutfitPlanner.tsx`, `Explore.tsx`, `WardrobeGrid.tsx`, eski `App.tsx` gövdesi) yeni görünümler bittikten sonra kaldırılacak.

---

## 4. Doğrulama planı

- `npx tsc --noEmit` ve `npm run build`.
- `npm test` (79 backend testi; arayüz değişikliği etkilememeli, `api/index.js` paket testi dahil).
- **Ekran görüntüsüyle gözden geçirme:** Playwright + Chromium, geçici klasöre kuruldu (projeye eklenmedi).
  - Plan: bellek içi MongoDB ile örnek kullanıcı, gardırop (yerel SVG yer tutucu görseller) ve kayıtlı kombinlerle önizleme sunucusu.
  - Her ekranın 390×844 (iPhone) ve 1440×900 (masaüstü) görüntüleri, açık ve koyu temada.
  - Kontrol listesi: taşma, kesilen metin, güvenli alan, alt çubukla çakışma, dokunma hedefleri.

---

## İlerleme

**Tamamlananlar:**
- [x] `src/index.css` – tasarım jetonları, açık/koyu tema, `@custom-variant dark`, yardımcı sınıflar (`pb-nav`, `pb-safe`, `no-scrollbar`, `snap-row`, `photo-well`, `skeleton`)
- [x] `index.html` – viewport-fit, theme-color, PWA meta, yazı tipleri, ilk boyamada tema
- [x] `public/manifest.webmanifest`, `public/icon.svg`
- [x] `ui/primitives.tsx`, `ui/Sheet.tsx`, `ui/fields.tsx`
- [x] `hooks/useMediaQuery.ts`, `hooks/useTheme.ts`
- [x] `contexts/StylistContext.tsx`
- [x] `layout/AppShell.tsx`, `layout/PageHeader.tsx`
- [x] `wardrobe/ItemCard.tsx`
- [x] `DailyPickCard.tsx` (yeni tasarım)
- [x] `ItemAttributeFields.tsx` (yeni tasarım: kategori çipleri, renk ailesi paleti, 1–5 ölçekleri)
- [x] `AddItemModal.tsx` (panel; kamera/galeri ayrı; seçer seçmez analiz; altta sabit kaydet)
- [x] `WardrobeContext`: `total`, `handleDeleteItem(): Promise<boolean>`
- [x] `ItemDetailModal` → panel (görsel üstte, arka plan kaldırma, "bununla ne giyerim", benzer parçalar, düzenle/sil)
- [x] `views/WardrobeView`, `OutfitsView`, `CreateView` (+ `LocationPicker`, sonuç görünümü, beraber sonuç kartı), `ExploreView`, `ProfileView`
- [x] `TripPlanner`, `OutfitCollage`, `WardrobeInsights` + `StatsDashboard`, `AccountSettings`, `PrivacySettings`, `StyleProfileSettings` yeni tasarıma
- [x] `Login`, `Register`, `ProtectedRoute`, `PromptModal` (panel + onay metni), `NotificationCenter` (mobilde üstte)
- [x] `App.tsx`'i yönlendirmeli yeni kabukla değiştirmek; eski bileşenleri kaldırmak
- [x] Derleme (`npm run build`), tip denetimi (`npx tsc --noEmit`), backend testleri (`npm test` – 79/79 başarılı) eksiksiz doğrulandı.

---

## İnceleme ve düzeltmeler (17 Eylül 2026)

Arayüz örnek verili önizleme sunucusunda iPhone (390×844) ve masaüstü (1440×900) ekran görüntüleriyle kontrol edildi.

- [x] Parça detayı açılınca uygulamanın çökmesi (form boş nesneyle başlıyordu) giderildi; silmede tek onay.
- [x] Dolap filtresi ve araması sunucuda yapılıyor (tüm gardırop); kategori sayıları ve toplam tüm gardıroptan. "Daha fazla" listeyi değiştirmek yerine ekliyor. Boş durum mesajları ayrıldı.
- [x] Keşfet'te gardırop incelemesi doğru uç noktaya gidiyor; beraber kombin detayında iki tarafın parçaları (`GET /api/collab/:id`) ve "görüldü" işareti, menü rozeti anında güncelleniyor.
- [x] İstatistikler ve kapsül analizi tüm gardıroptan, doğru alanlarla (`suggestions`).
- [x] Oluştur: tarih/saat, etkinlik açıklaması, hareket, ruh hali, stil etiketleri, zorunlu parçalar ("Ayrıntılar" altında); sonuçta puan dökümü, uyarılar, hava hatası, kolaj, seçenekler. Mobilde form özet karta dönüşüp sonuca kayıyor. Mod adreste (`?mod=beraber`).
- [x] Kombinler: not düzenleme, parça ekleme (seçici panel) ve çıkarma.
- [x] Profil kartı yapışkan başlıktan çıkarıldı; tema tek kaynaktan yönetiliyor.
- [x] `backend/config.ts`'e yeniden eklenen gömülü anahtarlar kaldırıldı; base64 ile gizlenmiş değerleri de yakalayan tarama testi eklendi.
