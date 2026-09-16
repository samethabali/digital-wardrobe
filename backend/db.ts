import mongoose from 'mongoose';
import { getMongoUri } from './config.js';

// ─── Kullanıcı ─────────────────────────────────────────────────────────────
const PersonalColorSchema = new mongoose.Schema({
  season: String,
  undertone: String,
  contrast: String,
  bestColorFamilies: [String],
  avoidColorFamilies: [String],
  note: String,
  analyzedAt: Date,
}, { _id: false });

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  isPrivate: { type: Boolean, default: false },
  consents: {
    personalization: { granted: { type: Boolean, default: false }, at: Date },
    personalColor: { granted: { type: Boolean, default: false }, at: Date },
    push: { granted: { type: Boolean, default: false }, at: Date },
    noticeVersion: String,
    updatedAt: Date,
  },
  styleProfile: {
    preferredFits: [String],
    avoidFits: [String],
    dislikedColorFamilies: [String],
    notes: String,
    personalColor: { type: PersonalColorSchema, default: null },
  },
  lastLocation: {
    latitude: Number,
    longitude: Number,
    label: String,
    updatedAt: Date,
  },
  createdAt: { type: Date, default: Date.now }
});
export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);

// ─── Gardırop parçası ──────────────────────────────────────────────────────
const ItemSchema = new mongoose.Schema({
  id: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  name: String,
  category: String,
  subCategory: String,
  color: String,
  colorFamily: String,
  colorHex: String,
  secondaryColors: [String],
  material: String,
  style: String,
  pattern: String,
  fit: String,
  formality: Number,
  warmth: Number,
  waterResistant: Boolean,
  layerRole: String,
  seasons: [String],
  weatherMatch: [String],
  price: Number,
  imagePath: String,
  cutoutImagePath: String,
  attributes: mongoose.Schema.Types.Mixed,
  aiAnalyzed: Boolean,
  enrichAttemptedAt: Date,
  // Görsel + metin embedding'i; istemciye gönderilmez
  embedding: { type: [Number], select: false, default: undefined },
  embeddingModel: { type: String, select: false },
  wearCount: { type: Number, default: 0 },
  lastWornAt: Date,
  createdAt: { type: Date, default: Date.now },
});
export const ItemModel = mongoose.models.Item || mongoose.model('Item', ItemSchema);

// ─── Kaydedilen kombin ─────────────────────────────────────────────────────
const OutfitSchema = new mongoose.Schema({
  id: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  name: String,
  items: [String],
  stylingReason: String,
  compatibilityScore: Number,
  source: { type: String, default: 'ai' },
  context: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});
export const OutfitModel = mongoose.models.Outfit || mongoose.model('Outfit', OutfitSchema);

// ─── Beraber kombin ────────────────────────────────────────────────────────
const CollabSessionSchema = new mongoose.Schema({
  id: { type: String, unique: true, index: true },
  initiatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  initiatorName: String,
  friendId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  friendName: String,
  event: String,
  effort: Number,
  mood: String,
  myOutfit: [String],
  friendOutfit: [String],
  compatibilityScore: Number,
  collabReason: String,
  styleHarmony: String,
  seenByFriend: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
export const CollabSessionModel = mongoose.models.CollabSession || mongoose.model('CollabSession', CollabSessionSchema);

// ─── İstek sınırlama sayaçları ─────────────────────────────────────────────
// expiresAt geldiğinde MongoDB TTL indeksi kaydı kendiliğinden siler.
const RateLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, expires: 0 }
});
export const RateLimitModel = mongoose.models.RateLimit || mongoose.model('RateLimit', RateLimitSchema);

// ─── Geri bildirim olayları (yalnızca kişiselleştirme rızası varsa) ────────
const FeedbackEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  type: { type: String, required: true }, // shown | saved | replaced | rerolled | worn | liked | disliked
  generationId: String,
  itemIds: [String],
  itemId: String,
  reason: String,
  note: String,
  context: mongoose.Schema.Types.Mixed,
  // Bir yıl sonra otomatik silinir
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 365 },
});
FeedbackEventSchema.index({ userId: 1, createdAt: -1 });
export const FeedbackEventModel = mongoose.models.FeedbackEvent || mongoose.model('FeedbackEvent', FeedbackEventSchema);

// ─── Giyim günlüğü ─────────────────────────────────────────────────────────
const WearLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  date: { type: String, required: true }, // YYYY-MM-DD (yerel)
  itemIds: [String],
  outfitId: String,
  source: { type: String, default: 'manual' }, // suggestion | saved | manual
  note: String,
  createdAt: { type: Date, default: Date.now },
});
WearLogSchema.index({ userId: 1, date: -1 });
export const WearLogModel = mongoose.models.WearLog || mongoose.model('WearLog', WearLogSchema);

// ─── Tercih profili ────────────────────────────────────────────────────────
const PreferenceProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, index: true },
  affinities: {
    item: { type: mongoose.Schema.Types.Mixed, default: {} },
    colorFamily: { type: mongoose.Schema.Types.Mixed, default: {} },
    style: { type: mongoose.Schema.Types.Mixed, default: {} },
    fit: { type: mongoose.Schema.Types.Mixed, default: {} },
    pattern: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  eventCount: { type: Number, default: 0 },
  summary: String,
  summaryEventCount: { type: Number, default: 0 },
  summaryUpdatedAt: Date,
  updatedAt: { type: Date, default: Date.now },
});
export const PreferenceProfileModel = mongoose.models.PreferenceProfile || mongoose.model('PreferenceProfile', PreferenceProfileSchema);

// ─── Günlük öneri önbelleği ────────────────────────────────────────────────
const DailyPickSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  date: { type: String, required: true },
  payload: mongoose.Schema.Types.Mixed,
  pushedAt: Date,
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },
});
DailyPickSchema.index({ userId: 1, date: 1 }, { unique: true });
export const DailyPickModel = mongoose.models.DailyPick || mongoose.model('DailyPick', DailyPickSchema);

// ─── Web push abonelikleri ─────────────────────────────────────────────────
const PushSubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: { p256dh: String, auth: String },
  createdAt: { type: Date, default: Date.now },
});
export const PushSubscriptionModel = mongoose.models.PushSubscription || mongoose.model('PushSubscription', PushSubscriptionSchema);

// ─── Embedding önbelleği (bilgi tabanı, sorgu metinleri) ───────────────────
const EmbeddingCacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  vector: [Number],
  createdAt: { type: Date, default: Date.now },
});
export const EmbeddingCacheModel = mongoose.models.EmbeddingCache || mongoose.model('EmbeddingCache', EmbeddingCacheSchema);

// ─── Eğitilmiş model ağırlıkları (uyum yeniden sıralayıcı) ─────────────────
const ModelArtifactSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  payload: mongoose.Schema.Types.Mixed,
  trainedAt: Date,
});
export const ModelArtifactModel = mongoose.models.ModelArtifact || mongoose.model('ModelArtifact', ModelArtifactSchema);

// ─── Bağlantı ──────────────────────────────────────────────────────────────
let cachedConnection: typeof mongoose | null = null;
let onFirstConnect: (() => void) | null = null;

/** İlk bağlantı kurulduğunda bir kez çalışacak işi (ör. veri göçü) kaydeder. */
export function setOnFirstConnect(fn: () => void) {
  onFirstConnect = fn;
}

export async function connectToDatabase() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  const uri = getMongoUri();

  // Serverless için bağlantıyı önbelleğe al
  cachedConnection = await mongoose.connect(uri);
  console.log('[MongoDB] Yeni bağlantı başarıyla kuruldu.');

  if (onFirstConnect) {
    const fn = onFirstConnect;
    onFirstConnect = null;
    fn();
  }

  return cachedConnection;
}

/** Bir kullanıcıya ait tüm kişisel verileri siler (hesap silme ve rıza geri çekme). */
export async function deletePersonalizationData(userId: string) {
  await Promise.all([
    FeedbackEventModel.deleteMany({ userId } as any),
    PreferenceProfileModel.deleteMany({ userId } as any),
    DailyPickModel.deleteMany({ userId } as any),
  ]);
}
