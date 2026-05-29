export interface FashionRule {
  id: string;
  category: 'color' | 'proportion' | 'layering' | 'occasion';
  tags: string[];
  rule: string;
}

export const FASHION_RULES: FashionRule[] = [
  // ─── RENK UYUMU (COLOR HARMONY) ──────────────────────────────────────────
  {
    id: 'color_60_30_10',
    category: 'color',
    tags: ['always', 'color'],
    rule: '60-30-10 Kuralı: Kombinde mükemmel görsel denge için; bir ana baskın renk (%60 - örn. takım elbise, ceket veya dış giyim), bir ikincil renk (%30 - örn. gömlek veya alt giyim) ve bir vurgu/aksent rengi (%10 - örn. ayakkabı, çanta, aksesuar veya makyaj) kullanarak kontrastı sınırla.'
  },
  {
    id: 'neutral_balance',
    category: 'color',
    tags: ['always', 'color'],
    rule: 'Nötr Dengeleme: Kombinde parlak veya iddialı bir canlı renk (kırmızı, fuşya, elektrik mavisi, saks, parlak yeşil vb.) kullanıldığında, geri kalan tüm parçaları mutlaka nötr tonlarda (siyah, beyaz, ekru, bej, gri, lacivert) tutarak göz yormayan bir şıklık oluştur.'
  },
  {
    id: 'ton_sur_ton',
    category: 'color',
    tags: ['casual', 'elegant', 'formal', 'smart-casual', 'iş', 'ofis', 'görüşme'],
    rule: 'Ton-Sür-Ton (Monokromatik): Aynı rengin farklı tonlarını bir arada kullanarak (örneğin koyu kahve pantolon, sütlü kahve triko ve bej kaban) son derece lüks, rafine, uzun ve ince gösteren dikey bir görsel illüzyon yarat.'
  },
  {
    id: 'complementary_contrast',
    category: 'color',
    tags: ['creative', 'streetwear', 'casual', 'bohemian', 'parti', 'party'],
    rule: 'Tamamlayıcı Kontrast: Zıt renklerin uyumundan faydalan. Lacivert/mavi tonlarını taba/camel/krem tonlarıyla; haki/yeşil tonlarını kahve/kiremit tonlarıyla eşleştirerek derinlik ve sıcaklık elde et.'
  },

  // ─── SİLÜET VE ORANLAR (SILHOUETTE & PROPORTION) ──────────────────────────
  {
    id: 'silhouette_volume',
    category: 'proportion',
    tags: ['always', 'proportion'],
    rule: 'Hacim Dengesi (Volume Balance): Alt ve üst giyimin hacimlerini dengele. Üst parça bol/oversize ise alt parçayı dar (slim/skinny) veya düz (straight) kesim seç. Alt parça geniş/bol (wide-leg, cargo) ise üstü daha oturan (slim-fit, crop) seçerek vücut formunun kaybolmasını engelle.'
  },
  {
    id: 'rule_of_thirds',
    category: 'proportion',
    tags: ['always', 'proportion'],
    rule: 'Üçte Bir Kuralı (1/3 - 2/3 Alt-Üst Oranı): Vücudu tam ortadan ikiye bölmek yerine, üst giyimi kısa (1/3) ve alt giyimi uzun (2/3) göster. Yüksek bel alt giyimin içine üstü hafifçe tıkıştırarak (tucked-in) veya crop üstler kullanarak bacak boyunu görsel olarak uzat.'
  },

  // ─── KATMANLAMA VE MEVSİM (LAYERING & WEATHER) ───────────────────────────
  {
    id: 'layering_sandwich',
    category: 'layering',
    tags: ['cold', 'rainy', 'snowy', 'cloudy', 'serin', 'soğuk', 'yağmurlu', 'karlı', 'bulutlu', 'rüzgarlı'],
    rule: 'Sandviç Katmanlama Tekniği: En içe hafif bir t-shirt/bluz, üzerine açık bir gömlek veya hırka, en dışa ise yapılandırılmış bir dış giyim (kaban, trençkot, ceket) ekleyerek hem hava değişimlerine hazırlıklı ol hem de kombine derinlik ve zengin bir boyut kat.'
  },
  {
    id: 'weather_textures',
    category: 'layering',
    tags: ['cold', 'snowy', 'soğuk', 'karlı', 'kış'],
    rule: 'Kış Dokuları: Soğuk havalarda yün, süet, deri, kadife ve kalın örgü (knitwear) dokuları bir araya getirerek hem üstün bir sıcaklık koruması sağla hem de kombine lüks bir dokusal zenginlik kazandır.'
  },
  {
    id: 'summer_breeze',
    category: 'layering',
    tags: ['hot', 'sunny', 'sıcak', 'güneşli', 'yaz'],
    rule: 'Yaz Esintisi: Sıcak havalarda keten, pamuklu ve ipek gibi nefes alan, terletmeyen ve dökümlü kumaşları bir araya getir. Açık renk tonları (beyaz, krem, pastel) tercih ederek ferah bir görünüm oluştur.'
  },

  // ─── ETKİNLİKLER VE ŞIK DENİM KURALI (OCCASIONS & DENIM BIAS FIX) ──────────
  {
    id: 'elegant_denim_styling',
    category: 'occasion',
    tags: ['iş', 'görüşme', 'mülakat', 'formal', 'business', 'office', 'ofis', 'meeting', 'toplantı', 'şık', 'ciddi', 'resmi', 'dinner', 'davet'],
    rule: 'Şık Denim Kullanımı: Jean pantolonlar (özellikle koyu lacivert/siyah, düz kesim, desensiz ve yüksek belli olanlar); şık bir blazer ceket, kaliteli bir gömlek/bluz ve deri loafer/topuklu ayakkabı ile birleştiğinde son derece prestijli, ciddi ve modern bir resmiyet sunar. Şık/ciddi etkinliklerde gardıroptaki bu şık jean parçalarını önyargıyla eleme, kurallara uygun olarak şık kombinlerde cesurca kullan.'
  },
  {
    id: 'occasion_formal',
    category: 'occasion',
    tags: ['iş', 'görüşme', 'mülakat', 'formal', 'business', 'office', 'ofis', 'meeting', 'toplantı', 'ciddi', 'resmi'],
    rule: 'Kurumsal Güç (Business Formal): Ciddi bir duruş için yapılandırılmış blazer ceketler, kumaş pantolonlar, ütülü temiz gömlekler ve oxford/loafer tipi kapalı ayakkabıları uyumlu tonlarda birleştirerek profesyonelliği yansıt.'
  },
  {
    id: 'occasion_smart_casual',
    category: 'occasion',
    tags: ['gündelik', 'casual', 'smart', 'dışarı', 'dinner', 'yemek', 'buluşma', 'date', 'şık'],
    rule: 'Çabasız Şıklık (Smart Casual): Klasik ve spor parçaları harmanla. Örneğin, kaliteli bir denim veya keten pantolon üzerine düz basic t-shirt ve blazer ceket giyip altına minimalist deri spor ayakkabılar ekleyerek hem rahat hem son derece özenli görün.'
  },
  {
    id: 'occasion_sporty',
    category: 'occasion',
    tags: ['sport', 'active', 'spor', 'yürüyüş', 'gym', 'travel', 'seyahat', 'rahat', 'koşu'],
    rule: 'Dinamik Konfor (Sporty/Active): Rahat kesim tulumlar, jogger pantolonlar veya taytları, oversize sweatshirtler veya bomber ceketler ile eşleştir. Spor ayakkabı seçimiyle hareketi destekle.'
  },
  {
    id: 'occasion_party',
    category: 'occasion',
    tags: ['party', 'night', 'parti', 'eğlence', 'gece', 'düğün', 'wedding', 'davet', 'cocktail', 'kokteyl', 'etkinlik'],
    rule: 'Gece Cazibesi (Glam/Night Out): Saten, kadife, deri veya ışıltılı dokular tercih et. Derinlik katan kontrast aksesuarlar ve özenli detaylarla kombini parlat.'
  }
];

/**
 * Kullanıcı istek parametrelerine ve hava durumuna göre en alakalı moda kurallarını dinamik olarak seçer.
 * @param request Kullanıcının kombin isteği
 * @param resolvedWeather Çözümlenmiş canlı hava durumu metni (örn: "Ankara, TR: 14°C, Çoğunlukla Açık")
 */
export function getRelevantFashionRules(request: any, resolvedWeather: string): string[] {
  const matchedRules: string[] = [];

  // 1. Her kombin için geçerli temel kuralları ekle (Renk Dengesi & Proporsiyon Hacmi)
  const alwaysRules = FASHION_RULES.filter(r => r.tags.includes('always'));
  alwaysRules.forEach(r => matchedRules.push(r.rule));

  // 2. Arama dizesi oluştur (Etkinlik, stil etiketleri ve kişisel stil kimliği)
  const eventText = (request.event || '').toLowerCase();
  const styleTags = (request.styleTags || []).map((t: string) => t.toLowerCase());
  const personalContext = (request.personalContext || '').toLowerCase();
  const searchString = `${eventText} ${styleTags.join(' ')} ${personalContext}`;

  // 3. Etkinlik (Occasion) kurallarını eşleştir
  const occasionRules = FASHION_RULES.filter(r => r.category === 'occasion');
  for (const rule of occasionRules) {
    const hasMatch = rule.tags.some(tag => searchString.includes(tag));
    if (hasMatch) {
      matchedRules.push(rule.rule);
    }
  }

  // 4. Hava durumuna göre kuralları eşleştir (ignoreWeather değilse)
  if (!request.ignoreWeather) {
    const weatherText = `${resolvedWeather} ${eventText}`.toLowerCase();
    
    // Karlı / Soğuk kontrolü
    const isCold = weatherText.includes('soğuk') || 
                   weatherText.includes('kar') || 
                   weatherText.includes('kış') || 
                   weatherText.includes('snow') || 
                   weatherText.includes('cold') || 
                   (resolvedWeather && parseFloat(resolvedWeather.match(/-?\d+(\.\d+)?/)?.[0] || '20') < 12);
    
    // Yağmurlu / Kapalı kontrolü
    const isRainy = weatherText.includes('yağmur') || 
                    weatherText.includes('kapalı') || 
                    weatherText.includes('bulut') || 
                    weatherText.includes('rain') || 
                    weatherText.includes('cloud');

    // Sıcak kontrolü
    const isHot = weatherText.includes('sıcak') || 
                  weatherText.includes('yaz') || 
                  weatherText.includes('hot') || 
                  weatherText.includes('sunny') || 
                  (resolvedWeather && parseFloat(resolvedWeather.match(/-?\d+(\.\d+)?/)?.[0] || '20') > 24);

    if (isCold || isRainy) {
      const coldRules = FASHION_RULES.filter(r => r.tags.includes('cold') || r.tags.includes('soğuk') || r.tags.includes('yağmurlu'));
      coldRules.forEach(r => matchedRules.push(r.rule));
    }
    if (isHot) {
      const hotRules = FASHION_RULES.filter(r => r.tags.includes('hot') || r.tags.includes('sıcak') || r.tags.includes('yaz'));
      hotRules.forEach(r => matchedRules.push(r.rule));
    }
  }

  // Kopya kuralları engelle ve Gemini'yi kurallara boğmamak için en fazla 6 kural döndür
  return Array.from(new Set(matchedRules)).slice(0, 6);
}
