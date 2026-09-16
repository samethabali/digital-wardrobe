import { ItemModel, OutfitModel, UserModel } from './db.js';

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
