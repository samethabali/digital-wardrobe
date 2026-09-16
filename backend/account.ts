import {
  CollabSessionModel, ItemModel, OutfitModel, PushSubscriptionModel, UserModel, WearLogModel,
  deletePersonalizationData,
} from './db.js';
import { deleteImages, getOwnedPublicId } from './cloudinary.js';
import { RequestError } from './engine/request.js';
import { CONSENT_KEYS, ConsentKey, NOTICE_VERSION } from '../shared/privacy.js';
import type { Consents } from '../shared/api.js';

export function toConsentsDTO(user: any): Consents {
  const c = user?.consents || {};
  return {
    personalization: c.personalization?.granted === true,
    personalColor: c.personalColor?.granted === true,
    push: c.push?.granted === true,
    noticeVersion: c.noticeVersion || null,
    updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : null,
  };
}

export interface ConsentChange {
  changes: Partial<Record<ConsentKey, boolean>>;
  noticeVersion?: string;
}

/** İstemciden gelen rıza gövdesini doğrular. Rıza vermek için güncel aydınlatma metni sürümü gönderilmelidir. */
export function parseConsentChange(body: any): ConsentChange {
  const changes: Partial<Record<ConsentKey, boolean>> = {};
  for (const key of CONSENT_KEYS) {
    const value = body?.[key];
    if (value === undefined) continue;
    if (typeof value !== 'boolean') throw new RequestError(`Geçersiz rıza değeri: ${key}`);
    changes[key] = value;
  }
  if (Object.keys(changes).length === 0) throw new RequestError('Değiştirilecek bir rıza gönderilmedi.');
  const granting = Object.values(changes).some(Boolean);
  const noticeVersion = typeof body?.noticeVersion === 'string' ? body.noticeVersion : undefined;
  if (granting && noticeVersion !== NOTICE_VERSION) {
    throw new RequestError('Rıza vermeden önce güncel aydınlatma metnini onaylamalısın.', 409);
  }
  return { changes, noticeVersion };
}

/**
 * Rızaları günceller. Geri çekilen her rızanın dayandığı veriler aynı istekte silinir (KVKK m.7).
 * Rızası zaten olmayan bir alan için geri çekme de silme yapar: önceki sürümlerden kalmış veri olabilir.
 */
export async function applyConsentChange(userId: string, change: ConsentChange): Promise<Consents> {
  const now = new Date();
  const set: Record<string, unknown> = { 'consents.updatedAt': now };
  for (const [key, granted] of Object.entries(change.changes)) {
    set[`consents.${key}`] = { granted, at: now };
  }
  if (change.noticeVersion === NOTICE_VERSION && Object.values(change.changes).some(Boolean)) {
    set['consents.noticeVersion'] = NOTICE_VERSION;
  }

  const unset: Record<string, ''> = {};
  if (change.changes.personalColor === false) unset['styleProfile.personalColor'] = '';

  const user = await UserModel.findOneAndUpdate(
    { _id: userId } as any,
    { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { returnDocument: 'after' } as any,
  );
  if (!user) throw new RequestError('Kullanıcı bulunamadı.', 404);

  const cleanups: Promise<unknown>[] = [];
  if (change.changes.personalization === false) cleanups.push(deletePersonalizationData(userId));
  if (change.changes.push === false) cleanups.push(PushSubscriptionModel.deleteMany({ userId } as any));
  await Promise.all(cleanups);

  return toConsentsDTO(user);
}

export interface AccountDeletionResult {
  imagesDeleted: number;
  imagesFailed: number;
}

/**
 * Hesabı ve kullanıcıya ait tüm verileri siler: parça görselleri ve arka planı kaldırılmış kopyaları,
 * parçalar, kombinler, giyim günlüğü, beraber kombinler (iki taraftan da), bildirim abonelikleri,
 * geri bildirim/tercih verileri ve kullanıcı kaydı. Görsel silme başarısız olsa da veritabanı temizliği sürer.
 */
export async function deleteUserAccount(userId: string): Promise<AccountDeletionResult> {
  const items: any[] = await ItemModel.find({ userId } as any).select('imagePath cutoutImagePath').lean();
  const publicIds = items.flatMap(item => [
    getOwnedPublicId(item.imagePath, userId),
    getOwnedPublicId(item.cutoutImagePath, userId),
  ]).filter(Boolean) as string[];

  const images = await deleteImages(publicIds);
  if (images.failed.length > 0) {
    console.error(`[Account Delete] ${images.failed.length} görsel silinemedi:`, images.failed.slice(0, 20));
  }

  await Promise.all([
    ItemModel.deleteMany({ userId } as any),
    OutfitModel.deleteMany({ userId } as any),
    WearLogModel.deleteMany({ userId } as any),
    CollabSessionModel.deleteMany({ $or: [{ initiatorId: userId }, { friendId: userId }] } as any),
    PushSubscriptionModel.deleteMany({ userId } as any),
    deletePersonalizationData(userId),
  ]);
  await UserModel.deleteOne({ _id: userId } as any);

  return { imagesDeleted: images.deleted, imagesFailed: images.failed.length };
}
