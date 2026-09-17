import { ItemModel, OutfitModel, UserModel } from './db.js';
import { CATEGORIES, FITS, PATTERNS, UNKNOWN } from '../shared/wardrobe.js';
import { inferCategory } from './engine/items.js';

// Eski analiz sürümlerinin ürettiği liste dışı değerler (ör. desen "yırtık", kesim "düz").
// Doku/yıkama bilgileri desen değildir: parça görsel olarak düz sayılır.
const LEGACY_PATTERNS: Record<string, string> = { taşlamalı: 'düz', yırtık: 'düz', fitilli: 'düz', 'düz renk': 'düz', ekose: 'kareli', puantiyeli: 'noktalı' };
const LEGACY_FITS: Record<string, string> = { düz: 'normal', regular: 'normal', slim: 'dar', 'slim fit': 'dar', loose: 'bol' };

/** Liste dışı kategori, desen ve kesim değerlerini en yakın geçerli değere çeker; değişen parça sayısını döndürür. */
export async function normalizeLegacyItemValues(): Promise<number> {
  const items: any[] = await ItemModel.find({
    $or: [
      { category: { $nin: [...CATEGORIES] } },
      { pattern: { $nin: [...PATTERNS, '', null] } },
      { fit: { $nin: [...FITS, '', null] } },
    ],
  } as any).select('id category subCategory pattern fit').lean();

  let changed = 0;
  for (const item of items) {
    const set: Record<string, string> = {};
    if (!(CATEGORIES as readonly string[]).includes(item.category)) set.category = inferCategory(undefined, `${item.category || ''} ${item.subCategory || ''}`);
    if (item.pattern && !(PATTERNS as readonly string[]).includes(item.pattern)) set.pattern = LEGACY_PATTERNS[item.pattern.toLocaleLowerCase('tr-TR')] || UNKNOWN;
    if (item.fit && !(FITS as readonly string[]).includes(item.fit)) set.fit = LEGACY_FITS[item.fit.toLocaleLowerCase('tr-TR')] || UNKNOWN;
    if (Object.keys(set).length === 0) continue;
    await ItemModel.updateOne({ id: item.id } as any, { $set: set });
    changed++;
  }
  return changed;
}

// Çok kullanıcılı yapıya geçişten önce kalan sahipsiz kayıtların bağlanacağı hesap.
const LEGACY_OWNER_EMAIL = 'samet@aura.com';

/** Eski kayıtları güncel şemaya taşır. İlk veritabanı bağlantısında arka planda bir kez çalışır. */
export async function runMigration() {
  try {
    const usersWithoutUsername = await UserModel.find({ username: { $exists: false } } as any);
    for (const u of usersWithoutUsername as any[]) {
      const emailPrefix = u.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const uniqueSuffix = Math.random().toString(36).slice(2, 6);
      u.username = `${emailPrefix}_${uniqueSuffix}`;
      await u.save();
      console.log(`[Migration] ${u.email} kullanıcısına varsayılan kullanıcı adı (${u.username}) tanımlandı.`);
    }

    const privacy = await UserModel.updateMany({ isPrivate: { $exists: false } } as any, { $set: { isPrivate: false } });
    if (privacy.modifiedCount > 0) console.log(`[Migration] ${privacy.modifiedCount} kullanıcının gizlilik ayarı varsayılan (false) yapıldı.`);

    const legacy = await normalizeLegacyItemValues();
    if (legacy > 0) console.log(`[Migration] ${legacy} parçadaki liste dışı kategori/desen/kesim değeri düzeltildi.`);

    const [itemsWithoutUser, outfitsWithoutUser] = await Promise.all([
      ItemModel.countDocuments({ userId: { $exists: false } } as any),
      OutfitModel.countDocuments({ userId: { $exists: false } } as any),
    ]);
    if (itemsWithoutUser === 0 && outfitsWithoutUser === 0) return;

    const legacyOwner = await UserModel.findOne({ email: LEGACY_OWNER_EMAIL } as any);
    if (!legacyOwner) {
      console.warn(`[Migration] ${LEGACY_OWNER_EMAIL} hesabı bulunamadı; sahipsiz kayıtlar bağlanmadan bırakıldı.`);
      return;
    }
    if (itemsWithoutUser > 0) {
      await ItemModel.updateMany({ userId: { $exists: false } } as any, { $set: { userId: legacyOwner._id } });
      console.log(`[Migration] ${itemsWithoutUser} sahipsiz gardırop öğesi ${LEGACY_OWNER_EMAIL} hesabına bağlandı.`);
    }
    if (outfitsWithoutUser > 0) {
      await OutfitModel.updateMany({ userId: { $exists: false } } as any, { $set: { userId: legacyOwner._id } });
      console.log(`[Migration] ${outfitsWithoutUser} sahipsiz kombin ${LEGACY_OWNER_EMAIL} hesabına bağlandı.`);
    }
  } catch (err) {
    console.error('[Migration] Hata oluştu:', err);
  }
}
