// KVKK aydınlatma metni ve açık rıza türleri (web arayüzü ve backend ortak kullanır).
export const NOTICE_VERSION = '2026-09-16';

export const CONSENT_KEYS = ['personalization', 'personalColor', 'push'] as const;
export type ConsentKey = typeof CONSENT_KEYS[number];

export interface ConsentDescription {
  key: ConsentKey;
  title: string;
  description: string;
  /** Rıza geri çekildiğinde silinen veriler */
  deletedOnWithdraw: string;
}

export const CONSENT_DESCRIPTIONS: ConsentDescription[] = [
  {
    key: 'personalization',
    title: 'Kişiselleştirilmiş öneriler',
    description: 'Gösterilen, kaydedilen, değiştirilen, giyilen ve beğenilmeyen kombinlerin kaydedilmesi; bu kayıtlardan renk, stil, kesim ve desen eğilimlerinin çıkarılması ve önerilerde kullanılması.',
    deletedOnWithdraw: 'Geri bildirim geçmişi, tercih profili ve günlük öneri önbelleği',
  },
  {
    key: 'personalColor',
    title: 'Kişisel renk analizi',
    description: 'Yüklediğin yüz fotoğrafından cilt alt tonu ve kontrast düzeyinin yapay zekayla (Google Gemini) analiz edilmesi. Fotoğraf saklanmaz; yalnızca analiz sonucu (renk paleti) profilinde tutulur.',
    deletedOnWithdraw: 'Kişisel renk analizi sonucu',
  },
  {
    key: 'push',
    title: 'Günlük kombin bildirimi',
    description: 'Her sabah o günün hava durumuna göre hazırlanan kombinin tarayıcı bildirimi olarak gönderilmesi. Bunun için tarayıcının bildirim aboneliği ve son kullandığın konum saklanır.',
    deletedOnWithdraw: 'Bildirim abonelikleri',
  },
];

export const PRIVACY_NOTICE_SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Veri sorumlusu',
    body: 'Aura Akıllı Gardırop uygulaması, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu sıfatıyla kişisel verilerini aşağıda açıklanan şekilde işler.',
  },
  {
    title: 'İşlenen veriler',
    body: 'Hesap bilgileri (ad, kullanıcı adı, e-posta, şifrenin özeti); gardırop fotoğrafları ve parça özellikleri; kaydedilen kombinler; giyim günlüğü; kombin isteklerinde seçtiğin konum ve etkinlik bilgisi. Açık rıza vermen halinde ayrıca: kombin geri bildirimleri ve bunlardan çıkarılan tercih profili, kişisel renk analizi sonucu, bildirim aboneliği.',
  },
  {
    title: 'İşleme amaçları ve hukuki sebepler',
    body: 'Hesabının ve gardırobunun yönetimi ile kombin önerisi hizmetinin sunulması sözleşmenin ifası (KVKK m.5/2-c) kapsamındadır. Geri bildirimlerden öğrenme, kişisel renk analizi ve bildirimler yalnızca açık rızana (KVKK m.5/1) dayanır; rıza vermemen temel hizmeti kullanmana engel değildir.',
  },
  {
    title: 'Aktarım',
    body: 'Görseller Cloudinary, veriler MongoDB Atlas üzerinde saklanır. Fotoğrafların etiketlenmesi, kombin açıklamaları ve kişisel renk analizi için ilgili içerik Google Gemini API\'ye gönderilir; hava durumu için yalnızca konum koordinatı Open-Meteo\'ya iletilir. Bu hizmet sağlayıcıların sunucuları yurt dışında bulunabilir; yurt dışına aktarım açık rızana ve KVKK m.9 hükümlerine tabidir.',
  },
  {
    title: 'Saklama süresi',
    body: 'Geri bildirim kayıtları en fazla 1 yıl, günlük öneri önbelleği 7 gün saklanır. Diğer veriler hesabın silinene kadar tutulur. Bir rızayı geri çektiğinde ona bağlı veriler hemen silinir; hesabını sildiğinde görseller dahil tüm verilerin silinir.',
  },
  {
    title: 'Hakların',
    body: 'KVKK m.11 uyarınca verilerinin işlenip işlenmediğini öğrenme, düzeltilmesini veya silinmesini isteme, işlemenin amacını öğrenme ve itiraz etme haklarına sahipsin. Rızalarını Hesap Ayarları\'ndan istediğin zaman değiştirebilir, hesabını aynı sayfadan silebilirsin.',
  },
];
