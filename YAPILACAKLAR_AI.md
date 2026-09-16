# Aura – Yapay Zeka Yol Haritası ve Yapılacaklar

> Son güncelleme: 16 Eylül 2026
> Kapsam: `zhl2` (Express backend + React web). Mobil uygulama aynı backend'i kullandığı için buradaki backend işlerinden otomatik olarak faydalanır.
> Kullanım: Her madde bir iş. Bitince `[ ]` → `[x]` yap. Fazlar sırayla ilerlemek için tasarlandı; 0. ve 1. faz, 2. fazdaki mimari değişiklikten önce yapılmalı.

---

## İçindekiler

1. [Tamamlananlar](#tamamlananlar)
2. [Mevcut durum özeti](#mevcut-durum-özeti)
3. [Piyasa ve araştırma karşılaştırması](#piyasa-ve-araştırma-karşılaştırması)
4. [Hedef mimari](#hedef-mimari)
5. [AI API kontrolü](#ai-api-kontrolü)
6. [Faz 0 – API ve ölçüm altyapısı](#faz-0--api-ve-ölçüm-altyapısı)
7. [Faz 1 – Hata düzeltmeleri](#faz-1--hata-düzeltmeleri)
8. [Faz 2 – Hibrit öneri motoru](#faz-2--hibrit-öneri-motoru)
9. [Faz 3 – Kişiselleştirme ve öğrenme](#faz-3--kişiselleştirme-ve-öğrenme)
10. [Faz 4 – Görselleştirme ve ileri seviye](#faz-4--görselleştirme-ve-ileri-seviye)
11. [Kaynaklar](#kaynaklar)

---

## Tamamlananlar

- [x] JWT anahtarı zorunlu hale getirildi, koddaki sabit anahtar kaldırıldı.
- [x] Sabit şifreli admin hesabı oluşturma kaldırıldı.
- [x] `PUT /api/wardrobe/:id` ve `PUT /api/outfits/:id` beyaz listeye alındı; Cloudinary silme sahiplik kontrolüne bağlandı; görsel indirme yalnızca kendi Cloudinary hesabımızla sınırlandı.
- [x] MongoDB tabanlı istek sınırlama eklendi; 400 hatalarında gereksiz model denemesi kaldırıldı; `gemini-2.5-pro` yedek listesinden çıkarıldı; `/api/debug-models` canlıda kapatıldı.
- [ ] **Bekleyen:** Vercel ortam değişkenlerine `JWT_SECRET`, `MONGODB_URI`, `GEMINI_API_KEY`, `CLOUDINARY_*` ekle. Kodda artık yedek değer yok; eksik değişkende ilgili uç noktalar 503 döner.
- [ ] **Bekleyen:** `samet@aura.com` canlıda varsa şifresini değiştir.
- [ ] **Bekleyen (kullanıcı kararı):** Herkese açık depoya gönderilen MongoDB şifresi, Cloudinary secret, Gemini anahtarı ve eski JWT yedek anahtarı hâlâ geçerli. Anahtarlar yenilenmedikçe git geçmişini temizlemek bu değerleri korumaz.

### İnceleme sonrası düzeltmeler (16 Eylül 2026)

- [x] Koda gömülen gizli değer yedekleri kaldırıldı (`backend/config.ts`); JWT anahtarı yine zorunlu. Test: yayınlanmış eski yedek anahtarla üretilen token reddediliyor.
- [x] `api/index.js` gizli değerler olmadan yeniden üretildi; paketin kaynakla uyumunu `tests/bundle.test.ts` denetliyor.
- [x] `OutfitPlanner.tsx` tip hataları (`LocationSearchResult.name`) giderildi; `tsc` temiz.
- [x] `/api/feedback`: doğrulama, istek sınırı, kişiselleştirme rızası ve `recordFeedback` bağlantısı; giyim tarihi Türkiye saatine göre.
- [x] Rıza uç noktası üç rızayı da yönetiyor; geri çekilen rızanın verisi aynı istekte siliniyor; rıza vermek için güncel aydınlatma metni sürümü gerekiyor.
- [x] Hesap silme: giyim günlüğü, beraber kombinler (iki taraf), bildirim abonelikleri ve arka planı kaldırılmış görseller dahil; görseller 100'lük gruplarla siliniyor.
- [x] Yerel il/ilçe veritabanı testte de kullanılıyor; koordinatı yaklaşık ilçeler Open-Meteo ile netleştiriliyor.
- [x] Beraber kombinde arkadaşın kombini de aynı hava durumuna göre kuruluyor; arkadaşın kişisel verisi kullanılmıyor.
- [x] Kombin isteği sırasında bilgi tabanı embedding'i hesaplanmıyor (önbellek betik ve günlük görevle dolduruluyor).
- [x] `server.ts` test edilebilir modüllere ayrıldı (`backend/app.ts`, `backend/routes/*`); bellek içi MongoDB ile 79 test.
- [x] Parça güncelleme ve yükleme artık yeni alanları (resmiyet, sıcak tutma, renk ailesi, mevsim, fiyat…) kaydediyor; önceden yalnızca eski alanlar saklanıyordu.
- [x] Sonuç ekranındaki puan dökümü gerçek bileşenlerle gösteriliyor (önceden olmayan alanlar okunuyordu); Değiştir/Yenile/Kilit akışı formdaki isteği değiştirmiyor.

---

## Mevcut durum özeti

Kombin önerisi bugün şöyle çalışıyor:

```
İstemci: konum metni "İl, İlçe" + etkinlik + ruh hali + stil etiketleri
  → Sunucu: kullanıcının TÜM gardırobunu DB'den çeker
  → Open-Meteo: metni arar, anlık hava durumunu alır
  → fashionRules.ts: kelime parçası eşleştirmesiyle en fazla 6 kural seçer
  → Rastgele "yaratıcı açı" ekler, listeyi karıştırır
  → Gemini 2.5 Flash (temperature 0.85): tek kombin + açıklama + puan
  → Yanıt KONTROL EDİLMEDEN istemciye gider
  → İstemci ID'leri yalnızca yüklü 30 parça içinde arar
```

Doğrulanmış temel sorunlar:

| Sorun | Kanıt |
|---|---|
| Varsayılan akışta hava durumu hiç alınamıyor | `"İstanbul, Kadıköy"` → Open-Meteo sonuç yok. Doğru sıra `"Kadıköy, İstanbul"` → doğru konum. |
| Kural seçimi yanlış kurallar getiriyor | Ankara 30°C → kış kuralı; -3°C karlı Spor + "ofiste çalışıyorum" stil kimliği → soğuk hava kuralları düşüyor, "Şık Denim" geliyor. |
| Model çıktısı doğrulanmıyor | Uydurma/yasaklı ID, eksik kategori doğrudan kullanıcıya gidiyor. |
| Yedek model listesinin 2 modeli kapatılmış | `gemini-2.0-flash` ve `gemini-2.0-flash-lite` API anahtarında yok (1 Haziran 2026'da kapatıldı). |
| Değiştir/Yenile/Kilit akışı bozuk | Bir değiştirmeden sonra Yenile yalnızca tek parça değiştirebiliyor; kilit isteğe eklenmiyor. |

---

## Piyasa ve araştırma karşılaştırması

### Piyasadaki uygulamalar

| Uygulama | Gardırobu dijitalleştirme | Kombin nasıl üretiliyor | Kullanılan bağlam | Öğrenme / takip | Görselleştirme |
|---|---|---|---|---|---|
| **Whering** | Fotoğraf yükleme | **W-Pick:** önceki stil tercihleri + hava durumuna göre AI seçimi. **Dress Me:** gardırobu karıştırıp elle eşleştirme | Hava durumu, planlayıcı | Önceki stil tercihleri | Lookbook, bavul listesi |
| **Alta Daily** | Meta **SAM 3** ile arka plan kaldırma (20M+ görsel) | Doğal dil isteği → gardıroptan kombin; ünlü bir stilistin katkısıyla eğitilmiş | Hava, takvim, yaşam tarzı, bütçe | Günlük giyim takibi, tekrar önleme | **Kişisel avatar üzerinde deneme** |
| **Acloset** | Görüntü işleme ile tür/renk/kumaş/stil etiketleme | Hava, takvim ve önceki seçimlere göre günlük öneri; sıcaklık, yağış ve **resmiyet** hesaba katılıyor | Hava, takvim, ruh hali | **Kabul/ret geri bildirimiyle** öneriler ayarlanıyor; giyim takibi, giyim başı maliyet | Kişisel renk ve kesim analizi |
| **Stitch Fix** | Kendi envanteri | Stilistlerin yaptığı **milyonlarca kombinle eğitilmiş** Outfit Creation Model; AI adayları daraltır, insan stilist tamamlar | Müşteri tercihleri, geçmiş alımlar | Büyük ölçekli geri bildirim verisi | Vision: üretken AI ile kişiye özel kombin görseli |
| **Aura (bugün)** | Gemini ile etiketleme; enum yok, arka plan kaldırma yok | Tüm gardırop tek LLM çağrısı; doğrulama yok | Anlık hava (varsayılan akışta çalışmıyor), etkinlik, ruh hali | **Yok** (son 3 kombin tarayıcıda) | Parça fotoğrafları |

**Piyasanın ortak noktaları (Aura'da eksik olanlar):**
1. **Yapılandırılmış parça verisi:** tür, renk, kumaş, resmiyet gibi alanlar sabit değerlerle tutuluyor.
2. **Zengin bağlam:** yalnızca anlık hava değil, takvim/etkinlik saati ve yağış da kullanılıyor.
3. **Geri bildirim döngüsü:** kabul/ret ve giyim takibi önerileri zamanla kişiselleştiriyor. Bu, en iyi uygulamaları sıradan olanlardan ayıran özellik.
4. **Görselleştirme:** temiz arka planlı parça görselleri, kolaj ya da avatar üzerinde deneme.
5. **Büyük oyuncular yalnızca LLM'e güvenmiyor:** Stitch Fix'te bir model adayları daraltıyor, son kararı başka bir katman (orada insan stilist) veriyor.

### Araştırmadaki yaklaşımlar

| Yaklaşım | Ne yapıyor | Aura için anlamı |
|---|---|---|
| **OutfitTransformer** (CVPR 2022 / WACV 2023) | Kombinin tamamını tek temsil olarak öğrenip uyum tahmini ve "eksik parçayı bul" görevlerini çözüyor (Polyvore verisi) | Uzun vadede kendi uyum modelimiz için hedef. Önce veri toplamak gerekir (Faz 3). |
| **Pinterest Complete the Look** (CVPR 2019) | Sahne görselinden tamamlayıcı ürün öneriyor | "Bu parçayla ne giyerim?" özelliğinin temel fikri. |
| **Marqo-FashionCLIP / FashionSigLIP** | Moda alanına özel görsel+metin embedding modelleri | Parça benzerliği ve uyum sinyali için; alternatif olarak `gemini-embedding-2` kullanılabilir. |
| **Loom** (arXiv, Mayıs 2026, ön baskı) | FashionCLIP embedding'leriyle slot bazlı aday getirme + renk uyumu, resmiyet tutarlılığı, etkinlik uyumu, stil yönü ve çeşitlilik sinyallerinden oluşan çok amaçlı puanlama; LLM yok | Faz 2'deki "kodla aday üret, kodla puanla" tasarımının neredeyse aynısı. Rastgele seçime göre ihlal oranını %16'dan %9,3'e düşürmüş. |
| **LLM + RAG** (FLLM, Ocak 2025; Agentic Fashion Rec., Ağustos 2025) | LLM'e çıkarım anında alan bilgisi ve kullanıcı tercihleri getiriliyor; yalnızca getirmeye dayalı sistemlerin kompozisyonel isteklerde zorlandığı belirtiliyor | LLM'i seçim motoru değil, **son seçim + açıklama + doğal dil anlama** katmanı olarak kullanmak. |

### Sonuç: Aura için doğru yön

- **Yalnızca LLM (bugünkü yapı) yetmez:** kısıtlar garanti edilemiyor, puan anlamsız, maliyet gardıropla birlikte büyüyor.
- **Yalnızca eğitilmiş model şimdilik gerçekçi değil:** etiketli kombin verimiz yok.
- **Hibrit yapı** en iyisi: kısıtları ve puanlamayı **kod** yapar, estetik son seçimi ve açıklamayı **LLM** yapar, **RAG** stil bilgisini ve kişisel örnekleri getirir, **geri bildirim** zamanla puanlamayı kişiselleştirir. Toplanan veri ileride kendi uyum modelimizi eğitmeye yeter.

**RAG hakkında dürüst not:** Tek bir kullanıcının gardırobu (genelde 200 parçanın altında) prompt'a sığar; RAG'in buradaki değeri parça getirmek **değil**. Değer şu üç yerde:
1. Stil bilgi tabanından o bağlama uygun kuralları getirmek (bugünkü hatalı kelime eşleştirmesinin yerine),
2. Kullanıcının beğendiği/kaydettiği kombinleri örnek olarak getirmek,
3. Kişisel tercih hafızasını getirmek.

---

## Hedef mimari

```
İstek: etkinlik, tarih/saat, konum (koordinat), ruh hali, serbest metin istek
   │
   ▼
[1] Bağlam çözümleyici (kod)
    hava tahmini (saatlik) → hedef sıcak tutma + yağış ihtiyacı
    etkinlik → hedef resmiyet aralığı
   │
   ▼
[2] Aday üretici (kod)
    sert filtreler: kategori, hava, resmiyet, yasaklılar, son giyilenler
    slot başına en iyi K parça (üst, alt, tek parça, ayakkabı, dış giyim, aksesuar)
   │
   ▼
[3] Kombin kurucu + puanlayıcı (kod)
    şablonlar: üst+alt+ayakkabı(+dış) | tek parça+ayakkabı(+dış)
    puan = hava + resmiyet + renk uyumu + silüet dengesi + tercih − tekrar cezası
    en iyi ~10 kombin                      ◄── [6] tercih profili, giyim geçmişi
   │
   ▼
[4] LLM stilist (Gemini)
    ~10 aday kombin + bağlam → en iyi 3'ü seçer, açıklar
    ID'ler şemada enum ile aday listesine kilitli
                                           ◄── RAG: stil bilgi tabanı + örnek kombinler
   │
   ▼
[5] Doğrulayıcı (kod) → ihlal varsa hatayı bildirip bir kez daha iste
   │
   ▼
Yanıt: 3 kombin + tam parça bilgisi + kullanılan hava + puan dökümü + model adı
   │
   ▼
[6] Geri bildirim olayları: gösterildi / kaydedildi / değiştirildi / giyildi / beğenilmedi
```

**Beklenen kazanımlar:**
- Geçersiz kombin oranı kod doğrulamasıyla sıfıra yakın olur.
- Prompt'a tüm gardırop yerine ~10 kombin gider; token maliyeti gardırop büyüklüğünden bağımsız hale gelir.
- Uyum puanı açıklanabilir ve tutarlı olur (kodla hesaplanır).
- Kullanıcı 3 alternatif görür; Yenile/Değiştir daha az model çağrısı gerektirir.

---

## AI API kontrolü

16 Eylül 2026 itibarıyla, resmi dokümantasyon ve projedeki API anahtarıyla yapılan model listesi kontrolüne göre:

### Gemini modelleri

| Kod içinde | Durum | Öneri |
|---|---|---|
| `gemini-2.5-flash` (ana model) | Erişilebilir. Gemini API'de kapanış tarihi yok; ancak Vertex tarafında "en erken 16 Ekim 2026" bildirilip sonra dokümandan kaldırıldığı raporlandı → **belirsiz**. İki nesil geride. | Gemini 3.x'e geç (Faz 0.2). |
| `gemini-2.0-flash` | **Kapatıldı** (1 Haziran 2026). Anahtarda yok. | Listeden çıkar. |
| `gemini-2.0-flash-lite` | **Kapatıldı** (1 Haziran 2026). Anahtarda yok. | Listeden çıkar. |
| `gemini-3.1-flash-lite` | Stabil. En erken kapanış 7 Mayıs 2027, yerine `gemini-3.5-flash-lite`. | Görsel etiketleme yedeği olabilir. |
| `gemini-3-flash-preview` | Önizleme. | Canlıda kullanma; stabil 3.x Flash tercih et. |
| `gemini-flash-latest`, `gemini-flash-lite-latest` | Takma ad; işaret ettiği model habersiz değişir. | Yalnızca son çare yedeği; ana model olarak kullanma. |

**Aday güncel modeller** (resmi fiyat sayfası, 1M token başına, ücretli katman; kesinleştirmeden önce sayfadan tekrar kontrol et):

| Model | Önerilen kullanım | Girdi | Çıktı |
|---|---|---|---|
| `gemini-3.8-flash` | Kombin seçimi (en yetenekli Flash) | $0.75* | $3.75* |
| `gemini-3.6-flash` | Kombin seçimi (hız/çok kipli denge) | $0.75* | $3.75* |
| `gemini-3.5-flash-lite` | Görsel etiketleme (hızlı, ucuz) | $0.30 | $2.50 |
| `gemini-3.1-flash-lite` | Görsel etiketleme yedeği | $0.25 | $1.50 |
| `gemini-2.5-flash` (bugünkü) | Karşılaştırma için | $0.30 | $2.50 |
| `gemini-embedding-2` | Parça ve bilgi tabanı embedding'i (metin + görsel) | $0.20 (metin) | – |
| `gemini-3.1-flash-image` | Sanal deneme / kombin görseli (Faz 4) | $0.50 | $60 (görsel) |

\* 31 Aralık 2026'ya kadar; sonrasında $1.50 / $7.50. Batch API %50 indirimli.

> Not: 3.x Flash modelleri 2.5 Flash'tan pahalı. Hibrit mimaride prompt'a tüm gardırop yerine yalnızca aday kombinler gideceği için toplam maliyetin düşmesi beklenir; bunu Faz 0.3'teki ölçümle doğrula.

### Gemini 3.x ile değişen kullanım kuralları

- **Temperature'ı düşürme.** Google'ın Gemini 3 kılavuzu varsayılan 1.0'da bırakılmasını "kuvvetle" öneriyor; düşürmek döngüye girme veya kalite kaybına yol açabilir. → Bugünkü `0.85 / 0.8 / 0.7` ayarları geçişte kaldırılmalı. *(Önceki analizdeki "görsel analizde 0.2 kullan" önerisi bu nedenle geçersiz.)*
- **`thinkingLevel` kullan** (`MINIMAL`, `LOW`, `MEDIUM`, `HIGH`). Bazı Flash modellerinde varsayılan `HIGH`, bu da gecikmeyi artırır. Aynı istekte `thinkingBudget` ile birlikte kullanılamaz.
  - Görsel etiketleme → `MINIMAL` veya `LOW`
  - Kombin seçimi → `LOW` veya `MEDIUM` (ölçerek karar ver)
  - Kapsül analizi → `MEDIUM`
- **`mediaResolution`**: SDK açıklamasına göre `LOW` = 64 token, `MEDIUM` = 256 token. Kumaş/desen ayrıntısı için hangisinin yeterli olduğunu ölç.
- **Yapılandırılmış çıktı:** `enum`, `minItems`/`maxItems`, `minimum`/`maximum`, `anyOf` destekleniyor. Google da "çıktı sözdizimsel olarak doğru olsa bile değerleri uygulamada doğrula" diyor. Çok büyük şemalar reddedilebilir; ID enum'u yalnızca küçük aday listesiyle kullanılmalı.

### SDK ve yardımcı servisler

| Konu | Durum | Öneri |
|---|---|---|
| `@google/genai` | Kurulu **1.51.0**, npm'de **2.22.0**. 2.x'teki kırıcı değişiklikler yalnızca Interactions API'yi etkiliyor (projede kullanılmıyor). 3.0 ile Node 22+ zorunlu olacak. | 2.x'e yükselt, testleri çalıştır. Vercel Node sürümünü 22+ yap. |
| `config.abortSignal` | 1.51.0'da mevcut, kullanılmıyor. | Sunucu tarafı zaman aşımı için kullan. |
| `list_models_check.ts` | Yeni SDK'da **hiçbir şey yazdırmıyor** (sayfalı sonuç `for await` ile gezilmiyor). | Düzelt. |
| Open-Meteo `current_weather` | Eski parametre; yerine `current` + `hourly` + `daily` var. | Faz 1.1'de güncelle. |
| Open-Meteo geocoding | `name` biçimi `"yer, ülke veya il"`; `countryCode` filtresi var. | Faz 1.1. |
| Open-Meteo ticari kullanım | API anahtarı yalnızca ticari kullanımda gerekli. | Uygulama gelir getirmeye başlarsa abonelik al. |
| `turkiyeapi.dev`, `bigdatacloud` | İstemciden çağrılan üçüncü taraf servisler; hata durumunda sessizce başarısız. | Faz 1.1'de GPS koordinatı doğrudan kullanılınca bigdatacloud yalnızca görüntü amaçlı kalır. |

---

## Faz 0 – API ve ölçüm altyapısı

Amaç: Diğer tüm değişikliklerin etkisini **ölçebilmek** ve kapanan modellerden kurtulmak.

- [x] **0.1 Görev bazlı model yapılandırması**
  - Tek `FALLBACK_MODELS` listesi yerine görev bazlı listeler: `VISION_MODELS`, `STYLIST_MODELS`, `CAPSULE_MODELS`.
  - Kapatılmış `gemini-2.0-flash` ve `gemini-2.0-flash-lite`'ı hemen çıkar.
  - `-latest` takma adlarını yalnızca listenin sonunda tut.
  - Model adlarını ortam değişkeninden okunabilir yap (yeniden deploy gerekmeden değiştirmek için).
  - **Kabul:** Yedek listede anahtarda bulunmayan model kalmaz.

- [ ] **0.2 Gemini 3.x'e geçiş (0.3'ten sonra, ölçerek)** — *Model listeleri 3.x'e geçirildi; `npm run eval -- --llm` ile 2.5 Flash karşılaştırması henüz çalıştırılmadı (kota harcar).*
  - Kombin: `gemini-3.6-flash` ve `gemini-3.8-flash` adaylarını değerlendirme setinde karşılaştır.
  - Görsel etiketleme: `gemini-3.5-flash-lite`, yedek `gemini-3.1-flash-lite`.
  - Tüm `temperature` ayarlarını kaldır, her görev için `thinkingLevel` ekle.
  - **Kabul:** Değerlendirme setinde kısıt ihlali ve gecikme, 2.5 Flash'a göre kötüleşmiyor.

- [x] **0.3 Mini değerlendirme seti ve ölçüm betiği**
  - 3 örnek gardırop (küçük ~20 / orta ~60 / büyük ~150 parça) × 10 senaryo (sıcak/soğuk/yağışlı × gündelik/iş/düğün/spor/randevu).
  - Otomatik metrikler: geçersiz ID, eksik zorunlu kategori, yasaklı parça, zorunlu parça eksikliği, hava uyumsuzluğu (ör. 5°C'de dış giyim yok), aynı istekte tekrar oranı, süre, token.
  - Sonuçları bir tabloya yazan `scripts/eval-outfits.ts`; her model/prompt değişikliğinde çalıştır.
  - **Kabul:** Tek komutla çalışıyor, önceki çalıştırmayla karşılaştırma tablosu üretiyor.
  - *Durum:* `npm run eval` (kural motoru) ve `npm run eval -- --llm [--no-examples] [--limit N]`. Sonuçlar `scripts/eval/results/`; kötüye gidişte çıkış kodu 1. İlk ölçüm: 30 durum, 90 kombin, geçersiz oranı 0, ortalama puan 93.4.

- [x] **0.4 Zaman aşımı ve gözlemlenebilirlik**
  - Her Gemini çağrısına `config.abortSignal` ile zaman aşımı (ör. 20 sn); tüm yedek zinciri için toplam süre bütçesi (Vercel fonksiyon sınırının altında).
  - Her çağrı için yanıt veren model, süre ve `usageMetadata` (girdi/çıktı/düşünme token'ı) kaydı.
  - Yanıtta kullanılan model adını döndür (hata ayıklama için).
  - **Kabul:** İstemci vazgeçtiğinde sunucu da çağrıyı iptal ediyor; loglarda model/süre/token görünüyor.

- [x] **0.5 SDK yükseltmesi**
  - `@google/genai` 1.51.0 → 2.x; Vercel'de Node 22+.
  - `list_models_check.ts`'i `for await` ile düzelt (`scripts/list-models.ts`). *Yapıldı; koddaki model listelerini de kontrol ediyor.*
  - **Kabul:** `tsc` ve değerlendirme seti geçiyor.

---

## Faz 1 – Hata düzeltmeleri

Amaç: Bugünkü akışı doğru çalışır hale getirmek. Faz 2'deki mimari değişiklik bu işlerin bir kısmını değiştirecek; ama bugünkü kullanıcı deneyimi için gerekli.

- [x] **1.1 Hava durumunu doğru al**
  - GPS ile konum alınınca **enlem/boylamı doğrudan sunucuya gönder**; metin araması yapma.
  - İl/ilçe seçiminde arama metnini **`"İlçe, İl"`** sırasıyla oluştur ve `countryCode=TR` ekle *(doğrulandı: `"Kadıköy, İstanbul"` → İstanbul Kadıköy)*. `OutfitPlanner.tsx` içindeki konum birleştirme satırları.
  - `current_weather` yerine `current` + `hourly` (`apparent_temperature`, `precipitation_probability`, `weather_code`, `wind_speed_10m`) + `daily` (`temperature_2m_max/min`, `apparent_temperature_max/min`, `precipitation_probability_max`), `timezone=auto`.
  - Hava kodu tablosunu tamamla: 56, 57, 66, 67, 77, 80, 81, 82, 85, 86.
  - Hava bilgisini metin olarak değil yapılandırılmış nesne olarak üret (`{ tempNow, feelsLike, min, max, precipProb, condition }`).
  - Kullanılan hava durumunu yanıtta döndür ve arayüzde göster; alınamadıysa kullanıcıya söyle.
  - **Kabul:** Hızlı Mod ve il+ilçe seçimi için hava durumu geliyor; sağanak yağış "Bilinmiyor" olmuyor.

- [x] **1.2 Model çıktısını sunucuda doğrula**
  - Kontroller: ID gardıropta mı, yasaklı parça yok mu, zorunlu parçalar var mı, yapı geçerli mi (üst+alt+ayakkabı veya tek parça+ayakkabı), aynı kategoriden fazla parça yok mu.
  - İhlal varsa ihlal listesini modele bildirip **bir kez** daha iste; yine olmazsa anlamlı hata dön.
  - `finishReason` kontrolü (güvenlik filtresi, `MAX_TOKENS`); `JSON.parse` hatasını yakala.
  - Gardıropta gerekli kategoriler yoksa (ör. ayakkabı yok) modeli hiç çağırmadan kullanıcıya söyle.
  - **Kabul:** Değerlendirme setinde geçersiz ID ve eksik kategori oranı %0.

- [x] **1.3 Değiştir / Yenile / Kilit akışını düzelt**
  - Üç ayrı liste: `userRequired` (formdan), `locked` (kilit butonu), `sessionExcluded` (değiştirilen parçalar).
  - "Değiştir": `locked ∪ userRequired ∪ (kalan parçalar)` zorunlu, değiştirilen parça yasaklı; **saklanan istek değişmesin**.
  - "Yenile": yalnızca `userRequired ∪ locked` zorunlu.
  - Bir parça hem zorunlu hem yasaklı olamasın.
  - **Kabul:** Değiştir'den sonra Yenile tamamen yeni kombin üretebiliyor; kilitli parça Yenile'de korunuyor.

- [x] **1.4 Kural seçimini düzelt (Faz 2.6'daki RAG'e kadar geçici çözüm)**
  - Etkinlik değerini doğrudan kural kimliklerine eşle (`EVENT_RULES: { 'İş Görüşmesi': ['occasion_formal'], ... }`).
  - Hava kurallarını sıcaklık aralığı ve yağış olasılığına göre seç (metin araması yok).
  - `toLowerCase()` yerine `toLocaleLowerCase('tr-TR')`.
  - Stil Kimliği metnini kural seçiminden çıkar.
  - "Şık Denim" kuralından `davet`/`düğün` ve iş görüşmesi etiketlerini kaldır.
  - Ölü kuralları (`ton_sur_ton`, `complementary_contrast`) stil etiketlerine bağla; ruh halini kullan.
  - 6 kural sınırını kategori kotasına çevir (ör. 2 temel + 1 etkinlik + 2 hava + 1 stil).
  - **Kabul:** Doğrulanan senaryolar (Ankara 30°C, İş Görüşmesi 2°C karlı, Spor -3°C + ofis stil kimliği, Randevu) doğru kuralları alıyor; bunlar birim testi olarak eklenmiş.

- [x] **1.5 Görsel analizini sıkılaştır**
  - Şemada `enum`: `category`, `style`, `weatherMatch`, `pattern`, `fit`.
  - "Belirsiz" değeri tanımla; `material`, `pattern`, `fit` zorunlu olsun ama "belirsiz" olabilsin.
  - `isClothing: boolean` alanı; kıyafet değilse kullanıcıya söyle.
  - Prompt dilini tutarlı yap: sabit alanlar İngilizce kod, `name`/`subCategory` Türkçe.
  - Gemini 3.x'e geçince temperature değiştirme, `thinkingLevel: MINIMAL/LOW`.
  - **Kabul:** Etiketleme sonucu her zaman izinli değerlerden oluşuyor.

- [x] **1.6 AI ile Tamamla döngüsünü kır**
  - Her parçaya `enrichAttemptedAt`; son denemeden sonra değişmeyen parçaları tekrar gönderme.
  - "Belirsiz" değerini eksik sayma.
  - Kullanıcının seçtiği `top` kategorisini ezme.
  - Uzun gardıroplar için parça parça (istemci sayfalı çağırır) ya da Batch API ile arka planda işle.
  - **Kabul:** İkinci çalıştırmada aynı parçalar için model çağrılmıyor.

- [x] **1.7 Sonuç ekranı tam parça verisiyle çalışsın**
  - Sunucu seçilen parçaların tam nesnelerini (görsel adresi dahil) döndürsün; istemci sayfalamaya bağımlı olmasın.
  - Kaydedilmiş kombinler ve beraber kombin için de aynı.
  - **Kabul:** 30'dan fazla parçası olan kullanıcıda kombinin tüm parçaları görünüyor.

- [x] **1.8 Prompt çelişkilerini gider**
  - "Yaratıcı açı"yı etkinliğe uygun listeden seç ya da kaldır; "KESİNLİKLE" yerine "uygunsa" de.
  - "Efor" alanını ikiye ayır: **özen/şıklık düzeyi** ve **fiziksel hareket**.
  - Puan örneklerini (85, 92, 98) prompt'tan kaldır.

- [x] **1.9 Kapsül analizi ve beraber kombin için hızlı düzeltmeler**
  - `category` sorgu parametresini izinli değerlerle doğrula; `makeup` etiketini ekle.
  - Beraber kombinde iki gardırobu prompt'ta ayrı listeler olarak ver; dönen ID'lerin sahibini doğrula.
  - "En az 3 parça" yerine kategori bazlı kontrol (her iki kişide üst, alt/tek parça, ayakkabı).

---

## Faz 2 – Hibrit öneri motoru

Amaç: [Hedef mimari](#hedef-mimari)'yi hayata geçirmek. Her adımın etkisini Faz 0.3'teki değerlendirme setiyle ölç.

- [x] **2.1 Veri modelini zenginleştir**
  - Yeni alanlar:
    - `warmth` (1–5): sıcak tutma
    - `formality` (1–5): resmiyet
    - `waterResistant` (boolean)
    - `layerRole` (`base` / `mid` / `outer`)
    - `colorFamily` (enum: siyah, beyaz, gri, lacivert, mavi, kahve, bej, yeşil, kırmızı, pembe, mor, sarı, turuncu, çok renkli), `colorHex`, `secondaryColors`
    - `seasons` (enum listesi)
  - Tek parça giysi için `category: 'onepiece'` (elbise, tulum).
  - `weatherMatch` alanını yeni alanlarla değiştir (geçiş sürecinde ikisini birlikte tut).
  - Mevcut parçaları **Batch API** ile yeniden etiketle (%50 ucuz, gerçek zamanlı değil).
  - **Kabul:** Tüm parçalarda yeni alanlar dolu; ekleme ekranı yeni alanları gösteriyor ve düzenlenebiliyor.

- [x] **2.2 Bağlam çözümleyici (kod)**
  - Hava → hedef `warmth` aralığı, dış giyim gerekli mi, su geçirmezlik gerekli mi.
  - Etkinlik → hedef `formality` aralığı; serbest metin etkinlik için tek ucuz LLM çağrısıyla yapılandırılmış bağlama çevir.
  - Tarih/saat seçilebilsin; o saatin tahmini kullanılsın (Open-Meteo 16 güne kadar veriyor).
  - **Kabul:** Birim testleri: 3°C yağışlı iş görüşmesi → `warmth ≥ 4`, dış giyim ve su geçirmezlik gerekli, `formality 4–5`.

- [x] **2.3 Aday üretici (kod)**
  - Sert filtreler: resmiyet aralığı, sıcak tutma uyumu, yasaklılar, son N günde giyilenler (Faz 3.2 sonrası).
  - Slot başına en iyi K parça (K ≈ 8–10).
  - **Kabul:** Büyük gardıropta aday listesi slot başına K'yı geçmiyor; zorunlu parçalar her zaman aday.

- [x] **2.4 Kombin kurucu ve puanlayıcı (kod)**
  - Şablonlar: `top+bottom+shoes(+outer)(+accessory)` | `onepiece+shoes(+outer)(+accessory)`.
  - Işın araması (beam search) ile ~10 en iyi kombin.
  - Puan bileşenleri, ağırlıklar yapılandırmada:
    - **Hava uyumu:** hedef sıcak tutma ve yağış ihtiyacına uzaklık
    - **Resmiyet tutarlılığı:** parçaların resmiyet sapması
    - **Renk uyumu:** renk ailesi kuralları (nötr + 1 vurgu, ton-sür-ton, tamamlayıcı eşleşmeler) ve hex tabanlı kontrast
    - **Silüet dengesi:** bol-dar dengesi (`fit`)
    - **Kişisel tercih:** Faz 3.3 profili
    - **Tekrar cezası:** son kombinler ve son giyilenler
  - Kullanıcıya gösterilen uyum puanı bu hesaptan gelsin; dökümü ("hava 95, renk 80…") yanıtta dönsün.
  - **Kabul:** Aynı girdiyle aynı puan; değerlendirme setinde hava/resmiyet ihlali %0.

- [x] **2.5 LLM stilistin rolünü değiştir**
  - Girdi: ~10 aday kombin (parça özellikleri + kod puanı) + bağlam + RAG sonuçları (2.6, 2.7).
  - Görev: en iyi 3 kombini seç ve sırala, her biri için kısa açıklama yaz; istenirse aday parçalar içinde tek parça değiştirebilir.
  - Şema: parça ID'leri `enum` ile yalnızca aday parçalara kilitli; `maxItems` ile kombin boyutu sınırlı.
  - Çıktı yine 1.2'deki doğrulayıcıdan geçer.
  - **Kabul:** Prompt token sayısı gardırop büyüklüğünden bağımsız; değerlendirme setinde LLM seçiminin kullanıcı tercihine (Faz 3 verisi gelince) etkisi ölçülüyor.

- [x] **2.6 RAG: stil bilgi tabanı**
  - `fashionRules.ts` içindeki 15 kuralı 100–300 kısa kural/ipucundan oluşan bir bilgi tabanına genişlet. Her kaydın meta verisi olsun: etkinlik, sıcaklık bandı, yağış, stil etiketi, renk ailesi.
  - MongoDB'de sakla. Getirme iki aşamalı:
    1. Yapılandırılmış bağlamla meta veri filtresi,
    2. Serbest metin (stil kimliği, serbest etkinlik) için `gemini-embedding-2` benzerliği.
  - Getirilen 5–8 kural prompt'a girsin; hangi kuralların kullanıldığı loglansın.
  - **Kabul:** Kelime parçası eşleştirmesi tamamen kalkmış; 1.4'teki senaryo testleri geçiyor.

- [x] **2.7 RAG: örnek kombinler (few-shot)** — *Kişisel ve küratörlü örnekler prompt'a giriyor; karşılaştırma için `npm run eval -- --llm --no-examples` hazır, ölçüm henüz çalıştırılmadı.*
  - **Kişisel örnekler:** kullanıcının kaydettiği, giydiği ve beğendiği kombinlerden bağlama en benzer 2–3 tanesi prompt'a örnek olarak girsin.
  - **Küratörlü örnekler (opsiyonel):** stil kurallarına uygun, elle hazırlanmış örnek kombin kütüphanesi. Hazır veri seti kullanılacaksa (Polyvore, Pinterest vb.) lisansını kontrol et.
  - **Kabul:** Değerlendirme setinde örnekli ve örneksiz sürüm karşılaştırılmış.

- [x] **2.8 Parça embedding'leri ve vektör arama** — *Yüklemede görsel+metin embedding'i, benzer parça uyarısı, "Bu parçayla ne giyerim?", stil kümeleri ve eksikleri tamamlama uç noktası. Tek kullanıcının gardırobu küçük olduğu için Atlas Vector Search yerine bellek içi kosinüs benzerliği kullanılıyor.*
  - Her parça için `gemini-embedding-2` ile görsel + metin embedding'i (768 boyut yeterli olabilir; ölç).
  - MongoDB Atlas Vector Search indeksi.
  - Kullanımlar:
    - Aynı parçayı ikinci kez ekleme uyarısı
    - "Bu parçayla ne giyerim?" (gardırop içinde tamamlayıcı parça getirme)
    - Stil kümeleri (istatistik ekranı)
    - Puanlayıcıda ek uyum sinyali
  - Alternatif: Marqo-FashionSigLIP gibi moda alanına özel açık model (ayrı çıkarım sunucusu gerekir).
  - **Kabul:** Yeni parça eklenince embedding oluşuyor; benzer parça uyarısı çalışıyor.

- [x] **2.9 Kapsül analizini kodla hesapla**
  - Mevcut kombin sayısı: 2.4'teki kurucu ile geçerli kombinleri **say**.
  - LLM yalnızca eksik parça adaylarını (yapılandırılmış özelliklerle) önersin.
  - Her aday için sanal parça ekleyip kombin sayısını **yeniden hesapla**; en çok artışı sağlayanı göster.
  - **Kabul:** Gösterilen sayılar uydurma değil; aynı gardırop için tekrar hesaplanınca aynı çıkıyor.

- [x] **2.10 Beraber kombini aynı motora taşı**
  - Her kişi için aday kombinler (2.3–2.4), ardından çiftler arası uyum puanı (renk ilişkisi, resmiyet dengesi).
  - LLM en iyi çiftleri seçip açıklasın; sahiplik doğrulaması zorunlu.

---

## Faz 3 – Kişiselleştirme ve öğrenme

Amaç: Piyasadaki en iyi uygulamaları farklılaştıran geri bildirim döngüsünü kurmak.

- [x] **3.1 Geri bildirim olayları**
  - `FeedbackEvent` koleksiyonu: `shown`, `saved`, `replaced(itemId)`, `rerolled`, `worn`, `disliked(reason)`; bağlam anlık görüntüsüyle birlikte.
  - Arayüze "Bunu giydim" ve "Beğenmedim (neden?)" butonları.
  - Son kombin geçmişini tarayıcıdan sunucuya taşı (bugünkü `recentOutfits`).
  - **Kabul:** Her kombin gösterimi ve etkileşimi kaydediliyor; veri silme hesap silmeyle birlikte çalışıyor.

- [x] **3.2 Giyim takibi ve takvim**
  - Günlük "ne giydim" kaydı (öneriden ya da elle).
  - Tekrar cezası ve parça rotasyonu puanlayıcıya bağlansın.
  - İstatistiklere: en çok/en az giyilen parçalar, hiç giyilmeyenler, giyim başı maliyet (fiyat girilirse).

- [x] **3.3 Tercih profili** — *Geri bildirim uç noktasına bağlandı; kabul testi `tests/units.test.ts` (reddedilen rengin öneri oranı düşüyor).*
  - Olaylardan özellik bazlı eğilim puanları: renk ailesi, stil, kesim, resmiyet (ör. basit sayım veya üstel azalan ağırlıklı ortalama).
  - Profil puanlayıcıya "kişisel tercih" bileşeni olarak girsin.
  - Periyodik olarak LLM ile 2–3 cümlelik tercih özeti üret; prompt'a bu özet girsin.
  - **Kabul:** Belirli bir rengi sürekli reddeden kullanıcıda o rengin öneri oranı ölçülebilir şekilde düşüyor.

- [x] **3.4 Günlük öneri ve planlama** — *Günün kombini kartı (`/api/daily-pick`), web push + Vercel Cron (`/api/cron/daily`, 08:00 TSİ), tarih/saatli kombin planlama ve seyahat bavulu (`/api/trips/plan`). E-posta eklenmedi.*
  - Sabah saatinde o günün tahminine göre hazır kombin (Whering W-Pick / Acloset benzeri); web push veya e-posta.
  - İleri tarihli etkinlik planlama (ör. hafta sonu düğün) ve seyahat için bavul listesi.

- [x] **3.5 Veri gizliliği (KVKK)** — *Aydınlatma metni (`shared/privacy.ts`) ve rıza anahtarları Hesap Ayarları'nda; hukuki metin bir uzmana kontrol ettirilmeli.*
  - Geri bildirim, giyim geçmişi ve tercih profili için açık rıza metni ve aydınlatma.
  - Hesap silmede tüm bu verilerin de silinmesi.

---

## Faz 4 – Görselleştirme ve ileri seviye

- [x] **4.1 Arka plan kaldırma ve kombin kolajı** — *Gemini 2.5 Flash segmentasyonu (`POST /api/wardrobe/:id/cutout`), parça detayında düğme, sonuç ekranında kolaj görünümü.*
  - Yüklenen parça görsellerinde arka planı kaldır. Seçenekler: Cloudinary'nin arka plan kaldırma eklentisi (ek maliyet) ya da bir segmentasyon modeli (Alta, SAM 3 kullanıyor). Gemini kılavuzuna göre görüntü segmentasyonu Gemini 3 Pro/Flash'ta desteklenmiyor, 2.5 Flash'ta var.
  - Kombin sonucu için temiz "flat-lay" kolaj (istemcide kodla, ucuz).

- [ ] **4.2 Sanal deneme (opsiyonel, premium)** — *Yapılmadı: görsel üreten modeller ücretsiz katmanda yok.*
  - `gemini-3.1-flash-image` (Nano Banana 2) ile kullanıcı fotoğrafı + kombin parçaları → deneme görseli.
  - Görsel başına maliyet yüksek; yalnızca istek üzerine, sınırlı kotayla.
  - Kullanıcı fotoğrafı için açık rıza ve saklama politikası (KVKK).

- [ ] **4.3 Kendi uyum modeli (uzun vade)** — *İlk adım hazır: `scripts/train-reranker.ts` geri bildirimlerden lojistik regresyon eğitiyor; en az 200 etiketli kombin ve doğrulama AUC ≥ 0.6 olmadan model kaydedilmiyor. Embedding tabanlı model için veri bekleniyor.*
  - Faz 3 verisi yeterli hale gelince (binlerce kaydedilen/giyilen/reddedilen kombin): önce embedding'ler üzerinde hafif bir sınıflandırıcı, sonra OutfitTransformer benzeri bir model.
  - Puanlayıcıda ek sinyal olarak başla; değerlendirme setiyle karşılaştır.

- [x] **4.4 Kişisel renk ve kesim analizi (opsiyonel)** — *Kişisel renk analizi (açık rıza, fotoğraf saklanmıyor) ve stil profili (sevilen/kaçınılan kesimler, sevilmeyen renkler). Vücut tipi analizi bilinçli olarak eklenmedi.*
  - Acloset'teki gibi kişisel renk paleti ve vücut tipine uygun kesim önerileri; yalnızca açık rızayla ve hassas dille.

---

## Kaynaklar

**Gemini API**
- [Gemini modelleri](https://ai.google.dev/gemini-api/docs/models)
- [Model kapanış takvimi](https://ai.google.dev/gemini-api/docs/deprecations)
- [Gemini 3 geliştirici kılavuzu (temperature, thinking_level)](https://ai.google.dev/gemini-api/docs/gemini-3)
- [Fiyatlandırma](https://ai.google.dev/gemini-api/docs/pricing)
- [Yapılandırılmış çıktı](https://ai.google.dev/gemini-api/docs/structured-output)
- [Embedding'ler (gemini-embedding-2)](https://ai.google.dev/gemini-api/docs/embeddings)
- [Görsel üretimi (Nano Banana)](https://ai.google.dev/gemini-api/docs/image-generation)
- [Sürüm notları](https://ai.google.dev/gemini-api/docs/changelog)
- [Gemini 2.5 kapanış tarihinin dokümandan kaldırılması (DEV Community)](https://dev.to/ai_changewatch/the-same-claude-model-gives-you-60-days-notice-on-one-platform-and-184-on-another-347p)
- [Google model emeklilikleri (Vorp Labs)](https://vorplabs.com/models/google-model-retirements)
- [js-genai SDK](https://github.com/googleapis/js-genai) · [LibreChat SDK 2.x yükseltme PR'ı](https://github.com/danny-avila/LibreChat/pull/13625)

**Hava durumu**
- [Open-Meteo Forecast API](https://open-meteo.com/en/docs)
- [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api)

**Piyasa**
- [Whering – outfit maker uygulamaları](https://whering.co.uk/outfit-maker-apps) · [Google Play](https://play.google.com/store/apps/details?id=com.whering.app&hl=en_US)
- [Alta Daily](https://www.altadaily.com/) · [Meta: Alta ve Segment Anything](https://ai.meta.com/blog/alta-daily-fashion-app-segment-anything/)
- [Acloset – Google Play](https://play.google.com/store/apps/details?id=com.looko.acloset) · [The Gliss: Acloset nasıl çalışıyor](https://www.thegliss.com/ai-fashion-assistant-how-acloset-transforms-you-get-dressed/)
- [Stitch Fix: Üretken AI ve stil geliştirmeleri](https://newsroom.stitchfix.com/blog/stitch-fix-announces-latest-generative-ai-and-styling-enhancements/) · [Stitch Fix Vision](https://www.stitchfix.com/women/blog/inside-stitchfix/introducing-vision-stitch-fixs-new-style-visualization-tool/) · [US Chamber: Stitch Fix'te AI ve stilistler](https://www.uschamber.com/co/good-company/the-leap/stitch-fix-optimizing-with-ai)
- [Google Shopping sanal deneme](https://blog.google/products-and-platforms/products/shopping/studio-quality-digital-try-on/)

**Araştırma**
- [OutfitTransformer (CVPR 2022 Workshop)](https://openaccess.thecvf.com/content/CVPR2022W/CVFAD/papers/Sarkar_OutfitTransformer_Outfit_Representations_for_Fashion_Recommendation_CVPRW_2022_paper.pdf) · [WACV 2023](https://openaccess.thecvf.com/content/WACV2023/papers/Sarkar_OutfitTransformer_Learning_Outfit_Representations_for_Fashion_Recommendation_WACV_2023_paper.pdf)
- [Complete the Look (CVPR 2019)](https://arxiv.org/pdf/1812.01748) · [Pinterest Engineering blog](https://medium.com/pinterest-engineering/introducing-complete-the-look-a-scene-based-complementary-recommendation-system-eb891c3fe88)
- [Marqo-FashionCLIP / FashionSigLIP](https://github.com/marqo-ai/marqo-FashionCLIP)
- [Loom: Hybrid Retrieval-Scoring Outfit Recommendation (arXiv 2605.09830)](https://arxiv.org/abs/2605.09830)
- [Integrating Domain Knowledge into LLMs for Fashion Recommendations (arXiv 2502.15696)](https://arxiv.org/abs/2502.15696)
- [Agentic Personalized Fashion Recommendation (arXiv 2508.02342)](https://arxiv.org/html/2508.02342v1)
- [CFALR: Collaborative Filtering-Augmented LLM for Outfit Recommendation (arXiv 2606.13001)](https://arxiv.org/pdf/2606.13001)
