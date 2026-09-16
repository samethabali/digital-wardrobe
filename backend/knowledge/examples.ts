import type { TempBand } from '../../shared/api.js';
import type { EventKey } from '../../shared/wardrobe.js';

/**
 * Elle hazırlanmış örnek kombinler. Parçalar kullanıcının gardırobuna değil özelliklere göre tarif edilir;
 * LLM'e "bu bağlamda iyi bir kombin neye benzer" örneği olarak verilir (few-shot).
 */
export interface ExampleOutfit {
  id: string;
  events: EventKey[];
  tempBands: TempBand[];
  precipitation?: Array<'rain' | 'snow'>;
  formality: [number, number];
  styleTags?: string[];
  outfit: string;
  why: string;
}

export const EXAMPLE_OUTFITS: ExampleOutfit[] = [
  { id: 'ex_office_cool', events: ['Ofis'], tempBands: ['cool', 'mild'], formality: [3, 4], styleTags: ['Business Casual', 'Klasik'],
    outfit: 'Lacivert blazer + beyaz gömlek + gri kumaş pantolon + kahverengi deri loafer + kahverengi kemer',
    why: 'Lacivert-gri-beyaz sakin bir iş paleti; kahverengi deri ayakkabı ve kemer sıcaklık katıyor ve birbirini tekrar ediyor.' },
  { id: 'ex_office_warm', events: ['Ofis'], tempBands: ['warm', 'hot'], formality: [3, 3], styleTags: ['Business Casual'],
    outfit: 'Açık mavi pamuklu gömlek (kolları kıvrılmış) + bej keten karışım pantolon + beyaz deri sneaker veya açık kahve loafer',
    why: 'Nefes alan kumaşlar ve açık renkler sıcakta rahat; düzgün kesim ofis ciddiyetini koruyor.' },
  { id: 'ex_office_freezing', events: ['Ofis'], tempBands: ['cold', 'freezing'], formality: [3, 4], styleTags: ['Klasik'],
    outfit: 'Antrasit yün kumaş pantolon + krem balıkçı yaka triko + kahverengi blazer + deve tüyü yün kaban + koyu kahve deri bot',
    why: 'İçeride blazer ve triko şık kalırken dışarıda yün kaban ve bot sıcak tutuyor; kahve ve krem tonları uyumlu.' },
  { id: 'ex_interview_cold', events: ['İş Görüşmesi'], tempBands: ['cool', 'cold', 'freezing'], formality: [4, 5], styleTags: ['Klasik'],
    outfit: 'Koyu gri blazer + krem ince triko veya beyaz gömlek + koyu gri kumaş pantolon + siyah derby/topuklu + uzun lacivert kaban',
    why: 'Sade ve yapılandırılmış siluet güven veriyor; dikkat dağıtmayan renkler; kaban içeride çıkarıldığında kombin yine tam.' },
  { id: 'ex_interview_mild', events: ['İş Görüşmesi'], tempBands: ['mild', 'warm'], formality: [4, 4], styleTags: ['Minimalist'],
    outfit: 'Bej blazer + beyaz bluz veya gömlek + siyah kumaş pantolon + siyah deri loafer',
    why: 'Bir tık şık ama boğucu değil; bej-siyah-beyaz kontrastı temiz ve profesyonel.' },
  { id: 'ex_casual_mild', events: ['Gündelik', 'Okul'], tempBands: ['mild', 'warm'], formality: [2, 2], styleTags: ['Minimalist'],
    outfit: 'Beyaz basic tişört + koyu mavi düz paça jean + beyaz sneaker (+ serinse kot veya ince deri ceket)',
    why: 'Zamansız gündelik formül; tek renk üst ve koyu jean temiz bir kontrast kuruyor.' },
  { id: 'ex_casual_hot', events: ['Gündelik', 'Seyahat'], tempBands: ['hot'], formality: [1, 2],
    outfit: 'Bol kesim beyaz keten gömlek + bej keten şort veya pantolon + espadril + güneş gözlüğü',
    why: 'Tek kat, nefes alan kumaş ve açık renkler çok sıcakta serin tutuyor.' },
  { id: 'ex_casual_cold', events: ['Gündelik', 'Okul'], tempBands: ['cold'], formality: [2, 2],
    outfit: 'Gri örgü kazak + koyu jean + kahverengi chelsea bot + haki parka',
    why: 'Katmanlı ve sıcak; gri-haki-kahve toprak tonları doğal bir uyum kuruyor.' },
  { id: 'ex_casual_rain', events: ['Gündelik', 'Ofis'], tempBands: ['cool', 'cold'], precipitation: ['rain'], formality: [2, 3],
    outfit: 'Bej trençkot + lacivert triko + koyu jean veya chino + suya dayanıklı deri bot',
    why: 'Trençkot yağmuru karşılarken kombini şık tutuyor; koyu alt ve deri bot ıslaklıktan etkilenmiyor.' },
  { id: 'ex_casual_snow', events: ['Gündelik'], tempBands: ['freezing'], precipitation: ['snow'], formality: [1, 2],
    outfit: 'Termal içlik + kalın balıkçı kazak + kalın kumaş pantolon + şişme mont + kaymaz tabanlı su geçirmez bot + atkı ve bere',
    why: 'Katman katman sıcak tutuyor; bot karda kaymayı ve ıslanmayı önlüyor.' },
  { id: 'ex_date_cool', events: ['Randevu'], tempBands: ['cool', 'cold'], formality: [3, 3], styleTags: ['Romantic', 'Kontrast'],
    outfit: 'Bordo saten bluz veya ince bordo triko + siyah dar pantolon + siyah deri ceket + siyah bilek bot',
    why: 'Siyah zemin üzerinde tek derin renk vurgusu; saten/triko dokusu özenli ama abartısız.' },
  { id: 'ex_date_warm', events: ['Randevu'], tempBands: ['mild', 'warm'], formality: [2, 3], styleTags: ['Pastel', 'Romantic'],
    outfit: 'Pastel midi elbise + ince krem hırka + bej babet veya sandalet',
    why: 'Akışkan elbise ve pastel ton romantik; hırka akşam serinliğine karşı.' },
  { id: 'ex_date_minimal', events: ['Randevu', 'Gündelik'], tempBands: ['mild', 'cool'], formality: [2, 3], styleTags: ['Monokromatik', 'Minimalist'],
    outfit: 'Bej triko + bej geniş paça pantolon + kahverengi loafer',
    why: 'Ton-sür-ton bej kombin boyu uzun gösteriyor; kahverengi ayakkabı derinlik katıyor.' },
  { id: 'ex_party_night', events: ['Parti'], tempBands: ['mild', 'cool', 'warm'], formality: [3, 4],
    outfit: 'Siyah pantolon veya siyah midi etek + parlak saten üst + ince metalik takı + blok topuk veya şık deri bot',
    why: 'Koyu zemin üzerinde tek parlak parça; blok topuk uzun gece için rahat.' },
  { id: 'ex_party_maximalist', events: ['Parti'], tempBands: ['mild', 'warm'], formality: [2, 3], styleTags: ['Maximalist'],
    outfit: 'Desenli gömlek + düz siyah pantolon + gömlekteki renklerden birinde ayakkabı',
    why: 'Tek desen odak; ayakkabı desendeki rengi tekrar ederek bütünlük sağlıyor.' },
  { id: 'ex_wedding_day', events: ['Düğün/Davet'], tempBands: ['mild', 'warm', 'hot'], formality: [4, 5],
    outfit: 'Pastel veya açık renk midi elbise ya da açık gri takım + zarif sandalet veya deri loafer + küçük çanta',
    why: 'Gündüz davetine uygun açık tonlar; beyazdan kaçınılmış; şık ama havaya uygun.' },
  { id: 'ex_wedding_evening', events: ['Düğün/Davet'], tempBands: ['cool', 'cold', 'freezing'], formality: [5, 5],
    outfit: 'Koyu lacivert takım elbise veya zümrüt uzun elbise + oxford veya topuklu + yün kaban',
    why: 'Akşam davetine uygun derin tonlar ve resmi ayakkabı; kaban dışarıdaki soğuk için.' },
  { id: 'ex_sport_cool', events: ['Spor'], tempBands: ['cool', 'cold'], formality: [1, 1], styleTags: ['Sporty'],
    outfit: 'Ter atan uzun kollu teknik üst + tayt veya eşofman altı + rüzgarlık + koşu ayakkabısı',
    why: 'Katmanlar ısındıkça çıkarılabiliyor; teknik kumaş teri tutmuyor.' },
  { id: 'ex_sport_hot', events: ['Spor'], tempBands: ['warm', 'hot'], formality: [1, 1], styleTags: ['Sporty'],
    outfit: 'Nefes alan atlet veya tişört + spor şort + koşu ayakkabısı + şapka',
    why: 'Tek kat ve hafif; şapka güneşten koruyor.' },
  { id: 'ex_travel', events: ['Seyahat'], tempBands: ['mild', 'cool'], formality: [1, 2], styleTags: ['Minimalist'],
    outfit: 'Siyah rahat jogger veya esnek pantolon + beyaz tişört + gri hırka + rahat sneaker',
    why: 'Uzun yolculukta rahat ve buruşmayan parçalar; nötr renkler varış yerinde başka parçalarla da eşleşiyor.' },
  { id: 'ex_school_street', events: ['Okul', 'Gündelik'], tempBands: ['cool', 'mild'], formality: [1, 2], styleTags: ['Streetwear', 'Oversize'],
    outfit: 'Oversize grafik sweatshirt + dar veya düz paça jean + kalın tabanlı sneaker + bomber ceket',
    why: 'Oversize üst dar altla dengeleniyor; tek grafik odak, gerisi sade.' },
];
