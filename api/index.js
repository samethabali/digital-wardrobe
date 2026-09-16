// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// backend/db.ts
import mongoose from "mongoose";
var PersonalColorSchema = new mongoose.Schema({
  season: String,
  undertone: String,
  contrast: String,
  bestColorFamilies: [String],
  avoidColorFamilies: [String],
  note: String,
  analyzedAt: Date
}, { _id: false });
var UserSchema = new mongoose.Schema({
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
    updatedAt: Date
  },
  styleProfile: {
    preferredFits: [String],
    avoidFits: [String],
    dislikedColorFamilies: [String],
    notes: String,
    personalColor: { type: PersonalColorSchema, default: null }
  },
  lastLocation: {
    latitude: Number,
    longitude: Number,
    label: String,
    updatedAt: Date
  },
  createdAt: { type: Date, default: Date.now }
});
var UserModel = mongoose.models.User || mongoose.model("User", UserSchema);
var ItemSchema = new mongoose.Schema({
  id: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
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
  embedding: { type: [Number], select: false, default: void 0 },
  embeddingModel: { type: String, select: false },
  wearCount: { type: Number, default: 0 },
  lastWornAt: Date,
  createdAt: { type: Date, default: Date.now }
});
var ItemModel = mongoose.models.Item || mongoose.model("Item", ItemSchema);
var OutfitSchema = new mongoose.Schema({
  id: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  name: String,
  items: [String],
  stylingReason: String,
  compatibilityScore: Number,
  source: { type: String, default: "ai" },
  context: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});
var OutfitModel = mongoose.models.Outfit || mongoose.model("Outfit", OutfitSchema);
var CollabSessionSchema = new mongoose.Schema({
  id: { type: String, unique: true, index: true },
  initiatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  initiatorName: String,
  friendId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
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
var CollabSessionModel = mongoose.models.CollabSession || mongoose.model("CollabSession", CollabSessionSchema);
var RateLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, expires: 0 }
});
var RateLimitModel = mongoose.models.RateLimit || mongoose.model("RateLimit", RateLimitSchema);
var FeedbackEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  type: { type: String, required: true },
  // shown | saved | replaced | rerolled | worn | liked | disliked
  generationId: String,
  itemIds: [String],
  itemId: String,
  reason: String,
  note: String,
  context: mongoose.Schema.Types.Mixed,
  // Bir yıl sonra otomatik silinir
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 365 }
});
FeedbackEventSchema.index({ userId: 1, createdAt: -1 });
var FeedbackEventModel = mongoose.models.FeedbackEvent || mongoose.model("FeedbackEvent", FeedbackEventSchema);
var WearLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  date: { type: String, required: true },
  // YYYY-MM-DD (yerel)
  itemIds: [String],
  outfitId: String,
  source: { type: String, default: "manual" },
  // suggestion | saved | manual
  note: String,
  createdAt: { type: Date, default: Date.now }
});
WearLogSchema.index({ userId: 1, date: -1 });
var WearLogModel = mongoose.models.WearLog || mongoose.model("WearLog", WearLogSchema);
var PreferenceProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, index: true },
  affinities: {
    item: { type: mongoose.Schema.Types.Mixed, default: {} },
    colorFamily: { type: mongoose.Schema.Types.Mixed, default: {} },
    style: { type: mongoose.Schema.Types.Mixed, default: {} },
    fit: { type: mongoose.Schema.Types.Mixed, default: {} },
    pattern: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  eventCount: { type: Number, default: 0 },
  summary: String,
  summaryEventCount: { type: Number, default: 0 },
  summaryUpdatedAt: Date,
  updatedAt: { type: Date, default: Date.now }
});
var PreferenceProfileModel = mongoose.models.PreferenceProfile || mongoose.model("PreferenceProfile", PreferenceProfileSchema);
var DailyPickSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  date: { type: String, required: true },
  payload: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 }
});
DailyPickSchema.index({ userId: 1, date: 1 }, { unique: true });
var DailyPickModel = mongoose.models.DailyPick || mongoose.model("DailyPick", DailyPickSchema);
var PushSubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: { p256dh: String, auth: String },
  createdAt: { type: Date, default: Date.now }
});
var PushSubscriptionModel = mongoose.models.PushSubscription || mongoose.model("PushSubscription", PushSubscriptionSchema);
var EmbeddingCacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  vector: [Number],
  createdAt: { type: Date, default: Date.now }
});
var EmbeddingCacheModel = mongoose.models.EmbeddingCache || mongoose.model("EmbeddingCache", EmbeddingCacheSchema);
var ModelArtifactSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  payload: mongoose.Schema.Types.Mixed,
  trainedAt: Date
});
var ModelArtifactModel = mongoose.models.ModelArtifact || mongoose.model("ModelArtifact", ModelArtifactSchema);
var cachedConnection = null;
var onFirstConnect = null;
function setOnFirstConnect(fn) {
  onFirstConnect = fn;
}
async function connectToDatabase() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }
  const FALLBACK_MONGODB_URI = "mongodb+srv://smthbl_db_user:I0cqcx1HGGNEuo4y@cluster0.4ixj9s3.mongodb.net/?appName=Cluster0";
  const uri = process.env.MONGODB_URI || FALLBACK_MONGODB_URI;
  cachedConnection = await mongoose.connect(uri);
  console.log("[MongoDB] Yeni ba\u011Flant\u0131 ba\u015Far\u0131yla kuruldu.");
  if (onFirstConnect) {
    const fn = onFirstConnect;
    onFirstConnect = null;
    fn();
  }
  return cachedConnection;
}
async function deletePersonalizationData(userId) {
  await Promise.all([
    FeedbackEventModel.deleteMany({ userId }),
    PreferenceProfileModel.deleteMany({ userId }),
    DailyPickModel.deleteMany({ userId })
  ]);
}

// backend/cloudinary.ts
import { v2 as cloudinary } from "cloudinary";
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dstqxvqqf",
  api_key: process.env.CLOUDINARY_API_KEY || "385148218883752",
  api_secret: process.env.CLOUDINARY_API_SECRET || "r1mRxhJ1RLHZ1TD3p4dATssa5RE"
});
function getPublicIdFromUrl(url) {
  try {
    const parts = url.split("/upload/");
    if (parts.length < 2) return null;
    let publicIdWithExtension = parts[1];
    if (publicIdWithExtension.startsWith("v")) {
      const slashIndex = publicIdWithExtension.indexOf("/");
      if (slashIndex !== -1) {
        publicIdWithExtension = publicIdWithExtension.substring(slashIndex + 1);
      }
    }
    if (publicIdWithExtension.includes("digital_wardrobe/")) {
      const idx = publicIdWithExtension.indexOf("digital_wardrobe/");
      publicIdWithExtension = publicIdWithExtension.substring(idx);
    }
    const dotIndex = publicIdWithExtension.lastIndexOf(".");
    if (dotIndex !== -1) {
      return publicIdWithExtension.substring(0, dotIndex);
    }
    return publicIdWithExtension;
  } catch (e) {
    console.error("[Cloudinary] Extract public_id error:", e);
    return null;
  }
}
function getOwnedPublicId(url, userId) {
  if (!url) return null;
  const publicId = getPublicIdFromUrl(url);
  return publicId && publicId.startsWith(`digital_wardrobe/${userId}/`) ? publicId : null;
}
function isOwnCloudinaryUrl(url) {
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.hostname === "res.cloudinary.com" && parsed.pathname.startsWith(`/${process.env.CLOUDINARY_CLOUD_NAME}/`);
  } catch {
    return false;
  }
}
var imageFetcher = (url) => fetch(url, { signal: AbortSignal.timeout(1e4) });
async function downloadOwnImage(url) {
  if (!isOwnCloudinaryUrl(url)) {
    console.warn("[Cloudinary] Kendi hesab\u0131m\u0131z d\u0131\u015F\u0131ndaki g\xF6rsel adresi reddedildi:", url);
    return null;
  }
  try {
    const response = await imageFetcher(url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return { base64: buffer.toString("base64"), mimeType: response.headers.get("content-type") || "image/jpeg", buffer };
  } catch (e) {
    console.error("[Cloudinary] G\xF6rsel indirilemedi:", e);
    return null;
  }
}

// backend/engine/generate.ts
import crypto3 from "crypto";

// shared/wardrobe.ts
var UNKNOWN = "belirsiz";
var CATEGORIES = ["top", "bottom", "onepiece", "outerwear", "shoes", "accessory", "makeup"];
var CATEGORY_LABELS = {
  all: "T\xFCm\xFC",
  top: "\xDCst",
  bottom: "Alt",
  onepiece: "Tek Par\xE7a",
  outerwear: "D\u0131\u015F Giyim",
  shoes: "Ayakkab\u0131",
  accessory: "Aksesuar",
  makeup: "Makyaj"
};
var STYLES = ["casual", "smart-casual", "formal", "elegant", "classic", "sport", "streetwear", "bohemian"];
var STYLE_LABELS = {
  casual: "G\xFCnl\xFCk",
  "smart-casual": "Smart Casual",
  formal: "Resmi",
  elegant: "Zarif",
  classic: "Klasik",
  sport: "Spor",
  streetwear: "Sokak",
  bohemian: "Bohem"
};
var COLOR_FAMILIES = [
  "siyah",
  "beyaz",
  "gri",
  "lacivert",
  "mavi",
  "kahverengi",
  "bej",
  "haki",
  "ye\u015Fil",
  "k\u0131rm\u0131z\u0131",
  "bordo",
  "pembe",
  "mor",
  "sar\u0131",
  "turuncu",
  "\xE7ok renkli"
];
var NEUTRAL_COLOR_FAMILIES = ["siyah", "beyaz", "gri", "lacivert", "kahverengi", "bej", "haki"];
var COLOR_FAMILY_HEX = {
  siyah: "#111827",
  beyaz: "#F9FAFB",
  gri: "#9CA3AF",
  lacivert: "#1E3A8A",
  mavi: "#3B82F6",
  kahverengi: "#78350F",
  bej: "#E7D8C0",
  haki: "#6B705C",
  ye\u015Fil: "#16A34A",
  k\u0131rm\u0131z\u0131: "#DC2626",
  bordo: "#7F1D1D",
  pembe: "#EC4899",
  mor: "#7C3AED",
  sar\u0131: "#EAB308",
  turuncu: "#EA580C",
  "\xE7ok renkli": "#A855F7"
};
var PATTERNS = ["d\xFCz", "\xE7izgili", "kareli", "\xE7i\xE7ekli", "grafik", "noktal\u0131", "hayvan", "kamuflaj", "batik", UNKNOWN];
var PATTERN_LABELS = {
  d\u00FCz: "D\xFCz",
  \u00E7izgili: "\xC7izgili",
  kareli: "Kareli",
  \u00E7i\u00E7ekli: "\xC7i\xE7ekli",
  grafik: "Grafik / Bask\u0131",
  noktal\u0131: "Noktal\u0131",
  hayvan: "Hayvan Deseni",
  kamuflaj: "Kamuflaj",
  batik: "Batik / Tie-dye",
  [UNKNOWN]: "Belirsiz"
};
var FITS = ["dar", "normal", "bol", "oversize", "crop", UNKNOWN];
var FIT_LABELS = {
  dar: "Dar / Slim",
  normal: "Normal / Regular",
  bol: "Bol / Loose",
  oversize: "Oversize",
  crop: "Crop",
  [UNKNOWN]: "Belirsiz"
};
var LAYER_ROLES = ["base", "mid", "outer", "none"];
var SEASONS = ["ilkbahar", "yaz", "sonbahar", "k\u0131\u015F"];
var EVENTS = ["G\xFCndelik", "Ofis", "\u0130\u015F G\xF6r\xFC\u015Fmesi", "Randevu", "Parti", "D\xFC\u011F\xFCn/Davet", "Spor", "Seyahat", "Okul"];
var MOODS = ["Enerjik", "Minimalist", "Romantik", "Ciddi", "Rahat"];
var STYLE_TAG_GROUPS = [
  {
    label: "Renk Uyumu",
    tags: ["Monokromatik", "Tamamlay\u0131c\u0131", "Kontrast", "Pastel", "N\xF6tr Tonlar"]
  },
  {
    label: "Stil Karakteri",
    tags: ["Minimalist", "Maximalist", "Klasik", "Vintage", "Streetwear", "Preppy", "Boho", "Dark Academia", "Y2K", "Sporty", "Business Casual", "Romantic"]
  },
  {
    label: "Kesim & Katman",
    tags: ["Katmanl\u0131", "Oversize", "Fitted", "Crop & High-waist"]
  }
];
var STYLE_TAGS = STYLE_TAG_GROUPS.flatMap((g) => g.tags);
var GARMENT_CATEGORIES = ["top", "bottom", "onepiece", "outerwear"];
var isEmpty = (value) => value === void 0 || value === null || value === "";
function missingFields(item) {
  const missing = [];
  const category = item.category || "";
  if (isEmpty(item.subCategory)) missing.push("subCategory");
  if (isEmpty(item.colorFamily)) missing.push("colorFamily");
  if (isEmpty(item.style)) missing.push("style");
  if (category !== "makeup") {
    if (isEmpty(item.formality)) missing.push("formality");
    if (category !== "accessory" && isEmpty(item.warmth)) missing.push("warmth");
  }
  if (GARMENT_CATEGORIES.includes(category)) {
    if (isEmpty(item.material)) missing.push("material");
    if (isEmpty(item.pattern)) missing.push("pattern");
    if (isEmpty(item.fit)) missing.push("fit");
    if (isEmpty(item.layerRole)) missing.push("layerRole");
  }
  if ((category === "outerwear" || category === "shoes") && (item.waterResistant === void 0 || item.waterResistant === null)) {
    missing.push("waterResistant");
  }
  if (!["makeup", "accessory"].includes(category) && !(item.seasons && item.seasons.length)) {
    missing.push("seasons");
  }
  return missing;
}
function deriveWeatherMatch(item) {
  const tags = /* @__PURE__ */ new Set();
  const warmth = item.warmth ?? 3;
  if (warmth <= 2) {
    tags.add("sunny");
    tags.add("hot");
  }
  if (warmth === 3) {
    tags.add("sunny");
    tags.add("cloudy");
  }
  if (warmth >= 4) {
    tags.add("cloudy");
    tags.add("cold");
  }
  if (warmth >= 5) tags.add("snowy");
  if (item.waterResistant) tags.add("rainy");
  return Array.from(tags);
}
function normalizeTr(text2) {
  return (text2 || "").toLocaleLowerCase("tr-TR").trim();
}
var COLOR_NAME_HINTS = [
  ["\xE7ok renkli", "\xE7ok renkli"],
  ["renkli", "\xE7ok renkli"],
  ["multi", "\xE7ok renkli"],
  ["lacivert", "lacivert"],
  ["indigo", "lacivert"],
  ["navy", "lacivert"],
  ["bordo", "bordo"],
  ["\u015Farap", "bordo"],
  ["vi\u015Fne", "bordo"],
  ["haki", "haki"],
  ["zeytin", "haki"],
  ["asker", "haki"],
  ["antrasit", "gri"],
  ["f\xFCme", "gri"],
  ["g\xFCm\xFC\u015F", "gri"],
  ["gri", "gri"],
  ["siyah", "siyah"],
  ["black", "siyah"],
  ["beyaz", "beyaz"],
  ["white", "beyaz"],
  ["ekru", "bej"],
  ["krem", "bej"],
  ["ta\u015F", "bej"],
  ["bej", "bej"],
  ["camel", "kahverengi"],
  ["taba", "kahverengi"],
  ["kahve", "kahverengi"],
  ["vizon", "kahverengi"],
  ["brown", "kahverengi"],
  ["pudra", "pembe"],
  ["fu\u015Fya", "pembe"],
  ["somon", "pembe"],
  ["pembe", "pembe"],
  ["pink", "pembe"],
  ["lila", "mor"],
  ["lavanta", "mor"],
  ["mor", "mor"],
  ["purple", "mor"],
  ["hardal", "sar\u0131"],
  ["alt\u0131n", "sar\u0131"],
  ["sar\u0131", "sar\u0131"],
  ["yellow", "sar\u0131"],
  ["kiremit", "turuncu"],
  ["turuncu", "turuncu"],
  ["orange", "turuncu"],
  ["k\u0131rm\u0131z\u0131", "k\u0131rm\u0131z\u0131"],
  ["red", "k\u0131rm\u0131z\u0131"],
  ["mint", "ye\u015Fil"],
  ["z\xFCmr\xFCt", "ye\u015Fil"],
  ["ye\u015Fil", "ye\u015Fil"],
  ["green", "ye\u015Fil"],
  ["kot", "mavi"],
  ["denim", "mavi"],
  ["turkuaz", "mavi"],
  ["mavi", "mavi"],
  ["blue", "mavi"]
];
function colorFamilyFromName(name) {
  const normalized = normalizeTr(name);
  if (!normalized) return null;
  for (const [hint, family] of COLOR_NAME_HINTS) {
    if (normalized.includes(hint)) return family;
  }
  return null;
}
function isValidHex(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}
function seasonForDate(date) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return "ilkbahar";
  if (month >= 6 && month <= 8) return "yaz";
  if (month >= 9 && month <= 11) return "sonbahar";
  return "k\u0131\u015F";
}

// backend/ai/gemini.ts
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

// backend/ai/models.ts
import { ThinkingLevel } from "@google/genai";
var DEFAULT_MODELS = {
  // Kombin seçimi ve açıklama, beraber kombin, kapsül önerisi
  stylist: ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"],
  // Kıyafet fotoğrafı etiketleme
  vision: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-flash-lite-latest"],
  // Serbest metin ayrıştırma, tercih özeti gibi küçük işler
  light: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-lite-latest"],
  // Kişisel renk analizi gibi görsel + muhakeme gerektiren işler
  analysis: ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-3.5-flash-lite"],
  // Görüntü segmentasyonu yalnızca 2.5 Flash'ta destekleniyor (Gemini 3 kılavuzu)
  segmentation: ["gemini-2.5-flash"]
};
var ENV_KEYS = {
  stylist: "GEMINI_MODELS_STYLIST",
  vision: "GEMINI_MODELS_VISION",
  light: "GEMINI_MODELS_LIGHT",
  analysis: "GEMINI_MODELS_ANALYSIS",
  segmentation: "GEMINI_MODELS_SEGMENTATION"
};
function modelsFor(task) {
  const fromEnv = process.env[ENV_KEYS[task]];
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.split(",").map((m) => m.trim()).filter(Boolean);
  }
  return DEFAULT_MODELS[task];
}
var EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2";
var EMBEDDING_DIMENSIONS = 768;
var TASK_THINKING = {
  stylist: ThinkingLevel.LOW,
  vision: ThinkingLevel.MINIMAL,
  light: ThinkingLevel.MINIMAL,
  analysis: ThinkingLevel.LOW,
  segmentation: ThinkingLevel.MINIMAL
};
var BUDGET_FOR_LEVEL = {
  [ThinkingLevel.MINIMAL]: 0,
  [ThinkingLevel.LOW]: 512,
  [ThinkingLevel.MEDIUM]: 2048,
  [ThinkingLevel.HIGH]: 8192
};
function thinkingConfigFor(model, task) {
  const level = TASK_THINKING[task];
  if (/^gemini-3/.test(model)) return { thinkingLevel: level };
  if (/^gemini-2\.5/.test(model)) return { thinkingBudget: BUDGET_FOR_LEVEL[level] };
  return void 0;
}
var DEFAULT_TIMEOUTS_MS = {
  stylist: 2e4,
  vision: 15e3,
  light: 8e3,
  analysis: 25e3,
  segmentation: 3e4
};
var DEFAULT_TOTAL_BUDGET_MS = {
  stylist: 4e4,
  vision: 3e4,
  light: 12e3,
  analysis: 45e3,
  segmentation: 45e3
};

// backend/ai/gemini.ts
var AiError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};
var client = null;
function getClient() {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY || "AIzaSyCD0LspfgsLR7GKEBeUIt8vgTBM14jd9pY";
    const genai = new GoogleGenAI({ apiKey });
    client = {
      generateContent: (params) => genai.models.generateContent(params),
      embedContent: (params) => genai.models.embedContent(params)
    };
  }
  return client;
}
function logAiCall(entry) {
  console.log(JSON.stringify({ tag: "ai", ...entry }));
}
function classifyError(err) {
  const status = err?.status;
  const message = String(err?.message || "");
  if (err?.name === "AbortError" || /aborted|timeout/i.test(message)) return "retry";
  if (status === 429 || typeof status === "number" && status >= 500 || status === 404) return "retry";
  if (/429|quota|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/i.test(message)) return "retry";
  if ((status === 400 || status === void 0) && /not found|not supported|no longer available/i.test(message)) return "retry";
  if (status === void 0) return "retry";
  return "bad_request";
}
var BLOCKED_REASONS = /* @__PURE__ */ new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "IMAGE_SAFETY"]);
async function generateJson(opts) {
  const ai = getClient();
  let models = modelsFor(opts.task);
  if (opts.preferModel && models.includes(opts.preferModel)) {
    models = [opts.preferModel, ...models.filter((m) => m !== opts.preferModel)];
  }
  const perCallTimeout = opts.timeoutMs ?? DEFAULT_TIMEOUTS_MS[opts.task];
  const deadline = Date.now() + (opts.totalBudgetMs ?? DEFAULT_TOTAL_BUDGET_MS[opts.task]);
  let lastError = null;
  let attempts = 0;
  for (const model of models) {
    const remaining = deadline - Date.now();
    if (remaining < 1500) break;
    attempts++;
    const started = Date.now();
    try {
      const response = await ai.generateContent({
        model,
        contents: opts.contents,
        config: {
          ...opts.systemInstruction ? { systemInstruction: opts.systemInstruction } : {},
          responseMimeType: "application/json",
          responseJsonSchema: opts.schema,
          ...opts.mediaResolution ? { mediaResolution: opts.mediaResolution } : {},
          ...thinkingConfigFor(model, opts.task) ? { thinkingConfig: thinkingConfigFor(model, opts.task) } : {},
          abortSignal: AbortSignal.timeout(Math.min(perCallTimeout, remaining))
        }
      });
      const finishReason = response?.candidates?.[0]?.finishReason;
      const blockReason = response?.promptFeedback?.blockReason;
      if (blockReason || finishReason && BLOCKED_REASONS.has(finishReason)) {
        logAiCall({ label: opts.label, model, ok: false, latencyMs: Date.now() - started, error: `blocked:${blockReason || finishReason}` });
        throw new AiError("blocked", "\u0130\xE7erik g\xFCvenlik filtresine tak\u0131ld\u0131.");
      }
      const text2 = response?.text;
      let data;
      try {
        if (!text2) throw new Error("bo\u015F yan\u0131t");
        data = JSON.parse(text2);
      } catch (parseErr) {
        lastError = new AiError("invalid_output", `Model ge\xE7erli JSON d\xF6nd\xFCrmedi (${finishReason || "bilinmiyor"}).`);
        logAiCall({ label: opts.label, model, ok: false, latencyMs: Date.now() - started, error: `invalid_json:${finishReason}` });
        continue;
      }
      const usage = response?.usageMetadata || {};
      const info = {
        model,
        latencyMs: Date.now() - started,
        attempts,
        promptTokens: usage.promptTokenCount ?? null,
        outputTokens: usage.candidatesTokenCount ?? null,
        thoughtsTokens: usage.thoughtsTokenCount ?? null
      };
      logAiCall({ label: opts.label, ok: true, ...info });
      return { data, info };
    } catch (err) {
      if (err instanceof AiError && err.code === "blocked") throw err;
      lastError = err;
      const kind = classifyError(err);
      logAiCall({ label: opts.label, model, ok: false, latencyMs: Date.now() - started, status: err?.status, error: String(err?.message || err).slice(0, 200) });
      if (kind === "bad_request") {
        throw new AiError("bad_request", "Yapay zeka iste\u011Fi ge\xE7ersiz bulundu.");
      }
    }
  }
  if (Date.now() >= deadline - 1500) {
    throw new AiError("timeout", "Yapay zeka zaman\u0131nda yan\u0131t veremedi. L\xFCtfen biraz sonra tekrar dene.");
  }
  if (lastError instanceof AiError) throw lastError;
  throw new AiError("unavailable", "Yapay zeka asistan\u0131 \u015Fu an yan\u0131t veremiyor (modeller me\u015Fgul veya kota doldu). L\xFCtfen daha sonra tekrar dene.");
}
async function embed(input, label, timeoutMs = 1e4) {
  const contents = [];
  if (input.text) contents.push({ text: input.text });
  if (input.image) contents.push({ inlineData: { mimeType: input.image.mimeType, data: input.image.base64 } });
  if (contents.length === 0) return null;
  const started = Date.now();
  try {
    const ai = getClient();
    const response = await ai.embedContent({
      model: EMBEDDING_MODEL,
      contents,
      config: { outputDimensionality: EMBEDDING_DIMENSIONS, abortSignal: AbortSignal.timeout(timeoutMs) }
    });
    const values = response?.embeddings?.[0]?.values;
    if (!values || values.length !== EMBEDDING_DIMENSIONS) throw new Error("beklenmeyen embedding boyutu");
    logAiCall({ label, model: EMBEDDING_MODEL, ok: true, latencyMs: Date.now() - started });
    return normalizeVector(values);
  } catch (err) {
    logAiCall({ label, model: EMBEDDING_MODEL, ok: false, latencyMs: Date.now() - started, status: err?.status, error: String(err?.message || err).slice(0, 200) });
    return null;
  }
}
function normalizeVector(values) {
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0)) || 1;
  return values.map((v) => v / norm);
}
function cosine(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return null;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
function embeddingCacheKey(text2) {
  return crypto.createHash("sha1").update(`${EMBEDDING_MODEL}:${EMBEDDING_DIMENSIONS}:${text2}`).digest("hex");
}

// shared/turkeyLocations.ts
var TURKISH_PROVINCES = [
  {
    "id": 1,
    "name": "Adana",
    "lat": 37.0017,
    "lon": 35.3289,
    "districts": [
      "Alada\u011F",
      "Ceyhan",
      "\xC7ukurova",
      "Feke",
      "\u0130mamo\u011Flu",
      "Karaisal\u0131",
      "Karata\u015F",
      "Kozan",
      "Pozant\u0131",
      "Saimbeyli",
      "Sar\u0131\xE7am",
      "Seyhan",
      "Tufanbeyli",
      "Yumurtal\u0131k",
      "Y\xFCre\u011Fir"
    ]
  },
  {
    "id": 2,
    "name": "Ad\u0131yaman",
    "lat": 37.7647,
    "lon": 38.2786,
    "districts": [
      "Besni",
      "\xC7elikhan",
      "Gerger",
      "G\xF6lba\u015F\u0131",
      "Kahta",
      "Merkez",
      "Samsat",
      "Sincik",
      "Tut"
    ]
  },
  {
    "id": 3,
    "name": "Afyonkarahisar",
    "lat": 38.7503,
    "lon": 30.5567,
    "districts": [
      "Ba\u015Fmak\xE7\u0131",
      "Bayat",
      "Bolvadin",
      "\xC7ay",
      "\xC7obanlar",
      "Dazk\u0131r\u0131",
      "Dinar",
      "Emirda\u011F",
      "Evciler",
      "Hocalar",
      "\u0130hsaniye",
      "\u0130scehisar",
      "K\u0131z\u0131l\xF6ren",
      "Merkez",
      "Sand\u0131kl\u0131",
      "Sinanpa\u015Fa",
      "Sultanda\u011F\u0131",
      "\u015Euhut"
    ]
  },
  {
    "id": 4,
    "name": "A\u011Fr\u0131",
    "lat": 39.7194,
    "lon": 43.0506,
    "districts": [
      "Diyadin",
      "Do\u011Fubayaz\u0131t",
      "Ele\u015Fkirt",
      "Hamur",
      "Merkez",
      "Patnos",
      "Ta\u015Fl\u0131\xE7ay",
      "Tutak"
    ]
  },
  {
    "id": 68,
    "name": "Aksaray",
    "lat": 38.3667,
    "lon": 34.0333,
    "districts": [
      "A\u011Fa\xE7\xF6ren",
      "Eskil",
      "G\xFCla\u011Fa\xE7",
      "G\xFCzelyurt",
      "Merkez",
      "Ortak\xF6y",
      "Sar\u0131yah\u015Fi",
      "Sultanhan\u0131"
    ]
  },
  {
    "id": 5,
    "name": "Amasya",
    "lat": 40.6497,
    "lon": 35.8353,
    "districts": [
      "G\xF6yn\xFCcek",
      "G\xFCm\xFC\u015Fhac\u0131k\xF6y",
      "Hamam\xF6z\xFC",
      "Merkez",
      "Merzifon",
      "Suluova",
      "Ta\u015Fova"
    ]
  },
  {
    "id": 6,
    "name": "Ankara",
    "lat": 39.9208,
    "lon": 32.8541,
    "districts": [
      "Akyurt",
      "Alt\u0131nda\u011F",
      "Aya\u015F",
      "Bala",
      "Beypazar\u0131",
      "\xC7aml\u0131dere",
      "\xC7ankaya",
      "\xC7ubuk",
      "Elmada\u011F",
      "Etimesgut",
      "Evren",
      "G\xF6lba\u015F\u0131",
      "G\xFCd\xFCl",
      "Haymana",
      "Kahramankazan",
      "Kalecik",
      "Ke\xE7i\xF6ren",
      "K\u0131z\u0131lcahamam",
      "Mamak",
      "Nall\u0131han",
      "Polatl\u0131",
      "Pursaklar",
      "Sincan",
      "\u015Eerefliko\xE7hisar",
      "Yenimahalle"
    ]
  },
  {
    "id": 7,
    "name": "Antalya",
    "lat": 36.8841,
    "lon": 30.7056,
    "districts": [
      "Akseki",
      "Aksu",
      "Alanya",
      "Demre",
      "D\xF6\u015Femealt\u0131",
      "Elmal\u0131",
      "Finike",
      "Gazipa\u015Fa",
      "G\xFCndo\u011Fmu\u015F",
      "\u0130brad\u0131",
      "Ka\u015F",
      "Kemer",
      "Kepez",
      "Konyaalt\u0131",
      "Korkuteli",
      "Kumluca",
      "Manavgat",
      "Muratpa\u015Fa",
      "Serik"
    ]
  },
  {
    "id": 75,
    "name": "Ardahan",
    "lat": 41.1083,
    "lon": 42.7,
    "districts": [
      "\xC7\u0131ld\u0131r",
      "Damal",
      "G\xF6le",
      "Hanak",
      "Merkez",
      "Posof"
    ]
  },
  {
    "id": 8,
    "name": "Artvin",
    "lat": 41.1822,
    "lon": 41.8189,
    "districts": [
      "Ardanu\xE7",
      "Arhavi",
      "Bor\xE7ka",
      "Hopa",
      "Kemalpa\u015Fa",
      "Merkez",
      "Murgul",
      "\u015Eav\u015Fat",
      "Yusufeli"
    ]
  },
  {
    "id": 9,
    "name": "Ayd\u0131n",
    "lat": 37.8444,
    "lon": 27.8456,
    "districts": [
      "Bozdo\u011Fan",
      "Buharkent",
      "\xC7ine",
      "Didim",
      "Efeler",
      "Germencik",
      "\u0130ncirliova",
      "Karacasu",
      "Karpuzlu",
      "Ko\xE7arl\u0131",
      "K\xF6\u015Fk",
      "Ku\u015Fadas\u0131",
      "Kuyucak",
      "Nazilli",
      "S\xF6ke",
      "Sultanhisar",
      "Yenipazar"
    ]
  },
  {
    "id": 10,
    "name": "Bal\u0131kesir",
    "lat": 39.6486,
    "lon": 27.8825,
    "districts": [
      "Alt\u0131eyl\xFCl",
      "Ayval\u0131k",
      "Balya",
      "Band\u0131rma",
      "Bigadi\xE7",
      "Burhaniye",
      "Dursunbey",
      "Edremit",
      "Erdek",
      "G\xF6me\xE7",
      "G\xF6nen",
      "Havran",
      "\u0130vrindi",
      "Karesi",
      "Kepsut",
      "Manyas",
      "Marmara",
      "Sava\u015Ftepe",
      "S\u0131nd\u0131rg\u0131",
      "Susurluk"
    ]
  },
  {
    "id": 74,
    "name": "Bart\u0131n",
    "lat": 41.6333,
    "lon": 32.3333,
    "districts": [
      "Amasra",
      "Kuruca\u015File",
      "Merkez",
      "Ulus"
    ]
  },
  {
    "id": 72,
    "name": "Batman",
    "lat": 37.8833,
    "lon": 41.1333,
    "districts": [
      "Be\u015Firi",
      "Gerc\xFC\u015F",
      "Hasankeyf",
      "Kozluk",
      "Merkez",
      "Sason"
    ]
  },
  {
    "id": 69,
    "name": "Bayburt",
    "lat": 40.25,
    "lon": 40.2167,
    "districts": [
      "Ayd\u0131ntepe",
      "Demir\xF6z\xFC",
      "Merkez"
    ]
  },
  {
    "id": 11,
    "name": "Bilecik",
    "lat": 40.1456,
    "lon": 29.9792,
    "districts": [
      "Boz\xFCy\xFCk",
      "G\xF6lpazar\u0131",
      "\u0130nhisar",
      "Merkez",
      "Osmaneli",
      "Pazaryeri",
      "S\xF6\u011F\xFCt",
      "Yenipazar"
    ]
  },
  {
    "id": 12,
    "name": "Bing\xF6l",
    "lat": 38.885,
    "lon": 40.4986,
    "districts": [
      "Adakl\u0131",
      "Gen\xE7",
      "Karl\u0131ova",
      "Ki\u011F\u0131",
      "Merkez",
      "Solhan",
      "Yayladere",
      "Yedisu"
    ]
  },
  {
    "id": 13,
    "name": "Bitlis",
    "lat": 38.3953,
    "lon": 42.1236,
    "districts": [
      "Adilcevaz",
      "Ahlat",
      "G\xFCroymak",
      "Hizan",
      "Merkez",
      "Mutki",
      "Tatvan"
    ]
  },
  {
    "id": 14,
    "name": "Bolu",
    "lat": 40.7353,
    "lon": 31.6064,
    "districts": [
      "D\xF6rtdivan",
      "Gerede",
      "G\xF6yn\xFCk",
      "K\u0131br\u0131sc\u0131k",
      "Mengen",
      "Merkez",
      "Mudurnu",
      "Seben",
      "Yeni\xE7a\u011Fa"
    ]
  },
  {
    "id": 15,
    "name": "Burdur",
    "lat": 37.7211,
    "lon": 30.2906,
    "districts": [
      "A\u011Flasun",
      "Alt\u0131nyayla",
      "Bucak",
      "\xC7avd\u0131r",
      "\xC7eltik\xE7i",
      "G\xF6lhisar",
      "Karamanl\u0131",
      "Kemer",
      "Merkez",
      "Tefenni",
      "Ye\u015Filova"
    ]
  },
  {
    "id": 16,
    "name": "Bursa",
    "lat": 40.1822,
    "lon": 29.0611,
    "districts": [
      "B\xFCy\xFCkorhan",
      "Gemlik",
      "G\xFCrsu",
      "Harmanc\u0131k",
      "\u0130neg\xF6l",
      "\u0130znik",
      "Karacabey",
      "Keles",
      "Kestel",
      "Mudanya",
      "Mustafakemalpa\u015Fa",
      "Nil\xFCfer",
      "Orhaneli",
      "Orhangazi",
      "Osmangazi",
      "Yeni\u015Fehir",
      "Y\u0131ld\u0131r\u0131m"
    ]
  },
  {
    "id": 17,
    "name": "\xC7anakkale",
    "lat": 40.1556,
    "lon": 26.4144,
    "districts": [
      "Ayvac\u0131k",
      "Bayrami\xE7",
      "Biga",
      "Bozcaada",
      "\xC7an",
      "Eceabat",
      "Ezine",
      "Gelibolu",
      "G\xF6k\xE7eada",
      "Lapseki",
      "Merkez",
      "Yenice"
    ]
  },
  {
    "id": 18,
    "name": "\xC7ank\u0131r\u0131",
    "lat": 40.6,
    "lon": 33.6167,
    "districts": [
      "Atkaracalar",
      "Bayram\xF6ren",
      "\xC7erke\u015F",
      "Eldivan",
      "Ilgaz",
      "K\u0131z\u0131l\u0131rmak",
      "Korgun",
      "Kur\u015Funlu",
      "Merkez",
      "Orta",
      "\u015Eaban\xF6z\xFC",
      "Yaprakl\u0131"
    ]
  },
  {
    "id": 19,
    "name": "\xC7orum",
    "lat": 40.5506,
    "lon": 34.9556,
    "districts": [
      "Alaca",
      "Bayat",
      "Bo\u011Fazkale",
      "Dodurga",
      "\u0130skilip",
      "Karg\u0131",
      "La\xE7in",
      "Mecit\xF6z\xFC",
      "Merkez",
      "O\u011Fuzlar",
      "Ortak\xF6y",
      "Osmanc\u0131k",
      "Sungurlu",
      "U\u011Furluda\u011F"
    ]
  },
  {
    "id": 20,
    "name": "Denizli",
    "lat": 37.7764,
    "lon": 29.0861,
    "districts": [
      "Ac\u0131payam",
      "Babada\u011F",
      "Baklan",
      "Bekilli",
      "Beya\u011Fa\xE7",
      "Bozkurt",
      "Buldan",
      "\xC7al",
      "\xC7ameli",
      "\xC7ardak",
      "\xC7ivril",
      "G\xFCney",
      "Honaz",
      "Kale",
      "Merkezefendi",
      "Pamukkale",
      "Sarayk\xF6y",
      "Serinhisar",
      "Tavas"
    ]
  },
  {
    "id": 21,
    "name": "Diyarbak\u0131r",
    "lat": 37.9142,
    "lon": 40.2306,
    "districts": [
      "Ba\u011Flar",
      "Bismil",
      "\xC7ermik",
      "\xC7\u0131nar",
      "\xC7\xFCng\xFC\u015F",
      "Dicle",
      "E\u011Fil",
      "Ergani",
      "Hani",
      "Hazro",
      "Kayap\u0131nar",
      "Kocak\xF6y",
      "Kulp",
      "Lice",
      "Silvan",
      "Sur",
      "Yeni\u015Fehir"
    ]
  },
  {
    "id": 81,
    "name": "D\xFCzce",
    "lat": 40.8333,
    "lon": 31.1667,
    "districts": [
      "Ak\xE7akoca",
      "Cumayeri",
      "\xC7ilimli",
      "G\xF6lyaka",
      "G\xFCm\xFC\u015Fova",
      "Kayna\u015Fl\u0131",
      "Merkez",
      "Y\u0131\u011F\u0131lca"
    ]
  },
  {
    "id": 22,
    "name": "Edirne",
    "lat": 41.6708,
    "lon": 26.5556,
    "districts": [
      "Enez",
      "Havsa",
      "\u0130psala",
      "Ke\u015Fan",
      "Lalapa\u015Fa",
      "Meri\xE7",
      "Merkez",
      "S\xFClo\u011Flu",
      "Uzunk\xF6pr\xFC"
    ]
  },
  {
    "id": 23,
    "name": "Elaz\u0131\u011F",
    "lat": 38.6806,
    "lon": 39.2264,
    "districts": [
      "A\u011F\u0131n",
      "Alacakaya",
      "Ar\u0131cak",
      "Baskil",
      "Karako\xE7an",
      "Keban",
      "Kovanc\u0131lar",
      "Maden",
      "Merkez",
      "Palu",
      "Sivrice"
    ]
  },
  {
    "id": 24,
    "name": "Erzincan",
    "lat": 39.75,
    "lon": 39.5,
    "districts": [
      "\xC7ay\u0131rl\u0131",
      "\u0130li\xE7",
      "Kemah",
      "Kemaliye",
      "Merkez",
      "Otlukbeli",
      "Refahiye",
      "Tercan",
      "\xDCz\xFCml\xFC"
    ]
  },
  {
    "id": 25,
    "name": "Erzurum",
    "lat": 39.9086,
    "lon": 41.2769,
    "districts": [
      "A\u015Fkale",
      "Aziziye",
      "\xC7at",
      "H\u0131n\u0131s",
      "Horasan",
      "\u0130spir",
      "Kara\xE7oban",
      "Karayaz\u0131",
      "K\xF6pr\xFCk\xF6y",
      "Narman",
      "Oltu",
      "Olur",
      "Paland\xF6ken",
      "Pasinler",
      "Pazaryolu",
      "\u015Eenkaya",
      "Tekman",
      "Tortum",
      "Uzundere",
      "Yakutiye"
    ]
  },
  {
    "id": 26,
    "name": "Eski\u015Fehir",
    "lat": 39.7764,
    "lon": 30.5206,
    "districts": [
      "Alpu",
      "Beylikova",
      "\xC7ifteler",
      "G\xFCny\xFCz\xFC",
      "Han",
      "\u0130n\xF6n\xFC",
      "Mahmudiye",
      "Mihalgazi",
      "Mihal\u0131\xE7\xE7\u0131k",
      "Odunpazar\u0131",
      "Sar\u0131cakaya",
      "Seyitgazi",
      "Sivrihisar",
      "Tepeba\u015F\u0131"
    ]
  },
  {
    "id": 27,
    "name": "Gaziantep",
    "lat": 37.0667,
    "lon": 37.3833,
    "districts": [
      "Araban",
      "\u0130slahiye",
      "Karkam\u0131\u015F",
      "Nizip",
      "Nurda\u011F\u0131",
      "O\u011Fuzeli",
      "\u015Eahinbey",
      "\u015Eehitkamil",
      "Yavuzeli"
    ]
  },
  {
    "id": 28,
    "name": "Giresun",
    "lat": 40.9167,
    "lon": 38.4,
    "districts": [
      "Alucra",
      "Bulancak",
      "\xC7amoluk",
      "\xC7anak\xE7\u0131",
      "Dereli",
      "Do\u011Fankent",
      "Espiye",
      "Eynesil",
      "G\xF6rele",
      "G\xFCce",
      "Ke\u015Fap",
      "Merkez",
      "Piraziz",
      "\u015Eebinkarahisar",
      "Tirebolu",
      "Ya\u011Fl\u0131dere"
    ]
  },
  {
    "id": 29,
    "name": "G\xFCm\xFC\u015Fhane",
    "lat": 40.45,
    "lon": 39.4833,
    "districts": [
      "Kelkit",
      "K\xF6se",
      "K\xFCrt\xFCn",
      "Merkez",
      "\u015Eiran",
      "Torul"
    ]
  },
  {
    "id": 30,
    "name": "Hakkari",
    "lat": 37.5833,
    "lon": 43.7333,
    "districts": [
      "\xC7ukurca",
      "Derecik",
      "Merkez",
      "\u015Eemdinli",
      "Y\xFCksekova"
    ]
  },
  {
    "id": 31,
    "name": "Hatay",
    "lat": 36.2,
    "lon": 36.1667,
    "districts": [
      "Alt\u0131n\xF6z\xFC",
      "Antakya",
      "Arsuz",
      "Belen",
      "Defne",
      "D\xF6rtyol",
      "Erzin",
      "Hassa",
      "\u0130skenderun",
      "K\u0131r\u0131khan",
      "Kumlu",
      "Payas",
      "Reyhanl\u0131",
      "Samanda\u011F",
      "Yaylada\u011F\u0131"
    ]
  },
  {
    "id": 76,
    "name": "I\u011Fd\u0131r",
    "lat": 39.9167,
    "lon": 44.0333,
    "districts": [
      "Aral\u0131k",
      "Karakoyunlu",
      "Merkez",
      "Tuzluca"
    ]
  },
  {
    "id": 32,
    "name": "Isparta",
    "lat": 37.7667,
    "lon": 30.55,
    "districts": [
      "Aksu",
      "Atabey",
      "E\u011Firdir",
      "Gelendost",
      "G\xF6nen",
      "Ke\xE7iborlu",
      "Merkez",
      "Senirkent",
      "S\xFCt\xE7\xFCler",
      "\u015Earkikaraa\u011Fa\xE7",
      "Uluborlu",
      "Yalva\xE7",
      "Yeni\u015Farbademli"
    ]
  },
  {
    "id": 34,
    "name": "\u0130stanbul",
    "lat": 41.0138,
    "lon": 28.9497,
    "districts": [
      "Adalar",
      "Arnavutk\xF6y",
      "Ata\u015Fehir",
      "Avc\u0131lar",
      "Ba\u011Fc\u0131lar",
      "Bah\xE7elievler",
      "Bak\u0131rk\xF6y",
      "Ba\u015Fak\u015Fehir",
      "Bayrampa\u015Fa",
      "Be\u015Fikta\u015F",
      "Beykoz",
      "Beylikd\xFCz\xFC",
      "Beyo\u011Flu",
      "B\xFCy\xFCk\xE7ekmece",
      "\xC7atalca",
      "\xC7ekmek\xF6y",
      "Esenler",
      "Esenyurt",
      "Ey\xFCpsultan",
      "Fatih",
      "Gaziosmanpa\u015Fa",
      "G\xFCng\xF6ren",
      "Kad\u0131k\xF6y",
      "Ka\u011F\u0131thane",
      "Kartal",
      "K\xFC\xE7\xFCk\xE7ekmece",
      "Maltepe",
      "Pendik",
      "Sancaktepe",
      "Sar\u0131yer",
      "Silivri",
      "Sultanbeyli",
      "Sultangazi",
      "\u015Eile",
      "\u015Ei\u015Fli",
      "Tuzla",
      "\xDCmraniye",
      "\xDCsk\xFCdar",
      "Zeytinburnu"
    ]
  },
  {
    "id": 35,
    "name": "\u0130zmir",
    "lat": 38.4188,
    "lon": 27.1287,
    "districts": [
      "Alia\u011Fa",
      "Bal\xE7ova",
      "Bay\u0131nd\u0131r",
      "Bayrakl\u0131",
      "Bergama",
      "Beyda\u011F",
      "Bornova",
      "Buca",
      "\xC7e\u015Fme",
      "\xC7i\u011Fli",
      "Dikili",
      "Fo\xE7a",
      "Gaziemir",
      "G\xFCzelbah\xE7e",
      "Karaba\u011Flar",
      "Karaburun",
      "Kar\u015F\u0131yaka",
      "Kemalpa\u015Fa",
      "K\u0131n\u0131k",
      "Kiraz",
      "Konak",
      "Menderes",
      "Menemen",
      "Narl\u0131dere",
      "\xD6demi\u015F",
      "Seferihisar",
      "Sel\xE7uk",
      "Tire",
      "Torbal\u0131",
      "Urla"
    ]
  },
  {
    "id": 46,
    "name": "Kahramanmara\u015F",
    "lat": 37.5833,
    "lon": 36.9333,
    "districts": [
      "Af\u015Fin",
      "And\u0131r\u0131n",
      "\xC7a\u011Flayancerit",
      "Dulkadiro\u011Flu",
      "Ekin\xF6z\xFC",
      "Elbistan",
      "G\xF6ksun",
      "Nurhak",
      "Oniki\u015Fubat",
      "Pazarc\u0131k",
      "T\xFCrko\u011Flu"
    ]
  },
  {
    "id": 78,
    "name": "Karab\xFCk",
    "lat": 41.2,
    "lon": 32.6333,
    "districts": [
      "Eflani",
      "Eskipazar",
      "Merkez",
      "Ovac\u0131k",
      "Safranbolu",
      "Yenice"
    ]
  },
  {
    "id": 70,
    "name": "Karaman",
    "lat": 37.1833,
    "lon": 33.2167,
    "districts": [
      "Ayranc\u0131",
      "Ba\u015Fyayla",
      "Ermenek",
      "Kaz\u0131mkarabekir",
      "Merkez",
      "Sar\u0131veliler"
    ]
  },
  {
    "id": 36,
    "name": "Kars",
    "lat": 40.6083,
    "lon": 43.0833,
    "districts": [
      "Akyaka",
      "Arpa\xE7ay",
      "Digor",
      "Ka\u011F\u0131zman",
      "Merkez",
      "Sar\u0131kam\u0131\u015F",
      "Selim",
      "Susuz"
    ]
  },
  {
    "id": 37,
    "name": "Kastamonu",
    "lat": 41.3889,
    "lon": 33.7822,
    "districts": [
      "Abana",
      "A\u011Fl\u0131",
      "Ara\xE7",
      "Azdavay",
      "Bozkurt",
      "Cide",
      "\xC7atalzeytin",
      "Daday",
      "Devrekani",
      "Do\u011Fanyurt",
      "Han\xF6n\xFC",
      "\u0130hsangazi",
      "\u0130nebolu",
      "K\xFCre",
      "Merkez",
      "P\u0131narba\u015F\u0131",
      "Seydiler",
      "\u015Eenpazar",
      "Ta\u015Fk\xF6pr\xFC",
      "Tosya"
    ]
  },
  {
    "id": 38,
    "name": "Kayseri",
    "lat": 38.7311,
    "lon": 35.4789,
    "districts": [
      "Akk\u0131\u015Fla",
      "B\xFCnyan",
      "Develi",
      "Felahiye",
      "Hac\u0131lar",
      "\u0130ncesu",
      "Kocasinan",
      "Melikgazi",
      "\xD6zvatan",
      "P\u0131narba\u015F\u0131",
      "Sar\u0131o\u011Flan",
      "Sar\u0131z",
      "Talas",
      "Tomarza",
      "Yahyal\u0131",
      "Ye\u015Filhisar"
    ]
  },
  {
    "id": 71,
    "name": "K\u0131r\u0131kkale",
    "lat": 39.85,
    "lon": 33.5167,
    "districts": [
      "Bah\u015F\u0131l\u0131",
      "Bal\u0131\u015Feyh",
      "\xC7elebi",
      "Delice",
      "Karake\xE7ili",
      "Keskin",
      "Merkez",
      "Sulakyurt",
      "Yah\u015Fihan"
    ]
  },
  {
    "id": 39,
    "name": "K\u0131rklareli",
    "lat": 41.7333,
    "lon": 27.2167,
    "districts": [
      "Babaeski",
      "Demirk\xF6y",
      "Kof\xE7az",
      "L\xFCleburgaz",
      "Merkez",
      "Pehlivank\xF6y",
      "P\u0131narhisar",
      "Vize"
    ]
  },
  {
    "id": 40,
    "name": "K\u0131r\u015Fehir",
    "lat": 39.1422,
    "lon": 34.1706,
    "districts": [
      "Ak\xE7akent",
      "Akp\u0131nar",
      "Boztepe",
      "\xC7i\xE7ekda\u011F\u0131",
      "Kaman",
      "Merkez",
      "Mucur"
    ]
  },
  {
    "id": 79,
    "name": "Kilis",
    "lat": 36.7167,
    "lon": 37.1167,
    "districts": [
      "Elbeyli",
      "Merkez",
      "Musabeyli",
      "Polateli"
    ]
  },
  {
    "id": 41,
    "name": "Kocaeli",
    "lat": 40.7667,
    "lon": 29.9167,
    "districts": [
      "Ba\u015Fiskele",
      "\xC7ay\u0131rova",
      "Dar\u0131ca",
      "Derince",
      "Dilovas\u0131",
      "Gebze",
      "G\xF6lc\xFCk",
      "\u0130zmit",
      "Kand\u0131ra",
      "Karam\xFCrsel",
      "Kartepe",
      "K\xF6rfez"
    ]
  },
  {
    "id": 42,
    "name": "Konya",
    "lat": 37.8667,
    "lon": 32.4833,
    "districts": [
      "Ah\u0131rl\u0131",
      "Ak\xF6ren",
      "Ak\u015Fehir",
      "Alt\u0131nekin",
      "Bey\u015Fehir",
      "Bozk\u0131r",
      "Cihanbeyli",
      "\xC7eltik",
      "\xC7umra",
      "Derbent",
      "Derebucak",
      "Do\u011Fanhisar",
      "Emirgazi",
      "Ere\u011Fli",
      "G\xFCneys\u0131n\u0131r",
      "Hadim",
      "Halkap\u0131nar",
      "H\xFCy\xFCk",
      "Ilg\u0131n",
      "Kad\u0131nhan\u0131",
      "Karap\u0131nar",
      "Karatay",
      "Kulu",
      "Meram",
      "Saray\xF6n\xFC",
      "Sel\xE7uklu",
      "Seydi\u015Fehir",
      "Ta\u015Fkent",
      "Tuzluk\xE7u",
      "Yal\u0131h\xFCy\xFCk",
      "Yunak"
    ]
  },
  {
    "id": 43,
    "name": "K\xFCtahya",
    "lat": 39.4167,
    "lon": 29.9833,
    "districts": [
      "Alt\u0131nta\u015F",
      "Aslanapa",
      "\xC7avdarhisar",
      "Domani\xE7",
      "Dumlup\u0131nar",
      "Emet",
      "Gediz",
      "Hisarc\u0131k",
      "Merkez",
      "Pazarlar",
      "Simav",
      "\u015Eaphane",
      "Tav\u015Fanl\u0131"
    ]
  },
  {
    "id": 44,
    "name": "Malatya",
    "lat": 38.355,
    "lon": 38.305,
    "districts": [
      "Ak\xE7ada\u011F",
      "Arapgir",
      "Arguvan",
      "Battalgazi",
      "Darende",
      "Do\u011Fan\u015Fehir",
      "Do\u011Fanyol",
      "Hekimhan",
      "Kale",
      "Kuluncak",
      "P\xFCt\xFCrge",
      "Yaz\u0131han",
      "Ye\u015Filyurt"
    ]
  },
  {
    "id": 45,
    "name": "Manisa",
    "lat": 38.6136,
    "lon": 27.4269,
    "districts": [
      "Ahmetli",
      "Akhisar",
      "Ala\u015Fehir",
      "Demirci",
      "G\xF6lmarmara",
      "G\xF6rdes",
      "K\u0131rka\u011Fa\xE7",
      "K\xF6pr\xFCba\u015F\u0131",
      "Kula",
      "Salihli",
      "Sar\u0131g\xF6l",
      "Saruhanl\u0131",
      "Selendi",
      "Soma",
      "\u015Eehzadeler",
      "Turgutlu",
      "Yunusemre"
    ]
  },
  {
    "id": 47,
    "name": "Mardin",
    "lat": 37.3111,
    "lon": 40.7436,
    "districts": [
      "Artuklu",
      "Darge\xE7it",
      "Derik",
      "K\u0131z\u0131ltepe",
      "Maz\u0131da\u011F\u0131",
      "Midyat",
      "Nusaybin",
      "\xD6merli",
      "Savur",
      "Ye\u015Filli"
    ]
  },
  {
    "id": 33,
    "name": "Mersin",
    "lat": 36.8,
    "lon": 34.6333,
    "districts": [
      "Akdeniz",
      "Anamur",
      "Ayd\u0131nc\u0131k",
      "Bozyaz\u0131",
      "\xC7aml\u0131yayla",
      "Erdemli",
      "G\xFClnar",
      "Mezitli",
      "Mut",
      "Silifke",
      "Tarsus",
      "Toroslar",
      "Yeni\u015Fehir"
    ]
  },
  {
    "id": 48,
    "name": "Mu\u011Fla",
    "lat": 37.2167,
    "lon": 28.3667,
    "districts": [
      "Bodrum",
      "Dalaman",
      "Dat\xE7a",
      "Fethiye",
      "Kavakl\u0131dere",
      "K\xF6yce\u011Fiz",
      "Marmaris",
      "Mente\u015Fe",
      "Milas",
      "Ortaca",
      "Seydikemer",
      "Ula",
      "Yata\u011Fan"
    ]
  },
  {
    "id": 49,
    "name": "Mu\u015F",
    "lat": 38.7444,
    "lon": 41.4961,
    "districts": [
      "Bulan\u0131k",
      "Hask\xF6y",
      "Korkut",
      "Malazgirt",
      "Merkez",
      "Varto"
    ]
  },
  {
    "id": 50,
    "name": "Nev\u015Fehir",
    "lat": 38.6244,
    "lon": 34.7231,
    "districts": [
      "Ac\u0131g\xF6l",
      "Avanos",
      "Derinkuyu",
      "G\xFCl\u015Fehir",
      "Hac\u0131bekta\u015F",
      "Kozakl\u0131",
      "Merkez",
      "\xDCrg\xFCp"
    ]
  },
  {
    "id": 51,
    "name": "Ni\u011Fde",
    "lat": 37.9667,
    "lon": 34.6833,
    "districts": [
      "Altunhisar",
      "Bor",
      "\xC7amard\u0131",
      "\xC7iftlik",
      "Merkez",
      "Uluk\u0131\u015Fla"
    ]
  },
  {
    "id": 52,
    "name": "Ordu",
    "lat": 40.9833,
    "lon": 37.8833,
    "districts": [
      "Akku\u015F",
      "Alt\u0131nordu",
      "Aybast\u0131",
      "\xC7ama\u015F",
      "\xC7atalp\u0131nar",
      "\xC7ayba\u015F\u0131",
      "Fatsa",
      "G\xF6lk\xF6y",
      "G\xFClyal\u0131",
      "G\xFCrgentepe",
      "\u0130kizce",
      "Kabad\xFCz",
      "Kabata\u015F",
      "Korgan",
      "Kumru",
      "Mesudiye",
      "Per\u015Fembe",
      "Ulubey",
      "\xDCnye"
    ]
  },
  {
    "id": 80,
    "name": "Osmaniye",
    "lat": 37.0667,
    "lon": 36.25,
    "districts": [
      "Bah\xE7e",
      "D\xFCzi\xE7i",
      "Hasanbeyli",
      "Kadirli",
      "Merkez",
      "Sumbas",
      "Toprakkale"
    ]
  },
  {
    "id": 53,
    "name": "Rize",
    "lat": 41.0208,
    "lon": 40.5236,
    "districts": [
      "Arde\u015Fen",
      "\xC7aml\u0131hem\u015Fin",
      "\xC7ayeli",
      "Derepazar\u0131",
      "F\u0131nd\u0131kl\u0131",
      "G\xFCneysu",
      "Hem\u015Fin",
      "\u0130kizdere",
      "\u0130yidere",
      "Kalkandere",
      "Merkez",
      "Pazar"
    ]
  },
  {
    "id": 54,
    "name": "Sakarya",
    "lat": 40.7667,
    "lon": 30.4167,
    "districts": [
      "Adapazar\u0131",
      "Akyaz\u0131",
      "Arifiye",
      "Erenler",
      "Ferizli",
      "Geyve",
      "Hendek",
      "Karap\xFCr\xE7ek",
      "Karasu",
      "Kaynarca",
      "Kocaali",
      "Pamukova",
      "Sapanca",
      "Serdivan",
      "S\xF6\u011F\xFCtl\xFC",
      "Tarakl\u0131"
    ]
  },
  {
    "id": 55,
    "name": "Samsun",
    "lat": 41.2864,
    "lon": 36.3314,
    "districts": [
      "19 May\u0131s",
      "Ala\xE7am",
      "Asarc\u0131k",
      "Atakum",
      "Ayvac\u0131k",
      "Bafra",
      "Canik",
      "\xC7ar\u015Famba",
      "Havza",
      "\u0130lkad\u0131m",
      "Kavak",
      "Ladik",
      "Sal\u0131pazar\u0131",
      "Tekkek\xF6y",
      "Terme",
      "Vezirk\xF6pr\xFC",
      "Yakakent"
    ]
  },
  {
    "id": 56,
    "name": "Siirt",
    "lat": 37.9444,
    "lon": 41.9333,
    "districts": [
      "Baykan",
      "Eruh",
      "Kurtalan",
      "Merkez",
      "Pervari",
      "\u015Eirvan",
      "Tillo"
    ]
  },
  {
    "id": 57,
    "name": "Sinop",
    "lat": 42.0236,
    "lon": 35.1531,
    "districts": [
      "Ayanc\u0131k",
      "Boyabat",
      "Dikmen",
      "Dura\u011Fan",
      "Erfelek",
      "Gerze",
      "Merkez",
      "Sarayd\xFCz\xFC",
      "T\xFCrkeli"
    ]
  },
  {
    "id": 58,
    "name": "Sivas",
    "lat": 39.7472,
    "lon": 37.0175,
    "districts": [
      "Ak\u0131nc\u0131lar",
      "Alt\u0131nyayla",
      "Divri\u011Fi",
      "Do\u011Fan\u015Far",
      "Gemerek",
      "G\xF6lova",
      "G\xFCr\xFCn",
      "Hafik",
      "\u0130mranl\u0131",
      "Kangal",
      "Koyulhisar",
      "Merkez",
      "Su\u015Fehri",
      "\u015Eark\u0131\u015Fla",
      "Ula\u015F",
      "Y\u0131ld\u0131zeli",
      "Zara"
    ]
  },
  {
    "id": 63,
    "name": "\u015Eanl\u0131urfa",
    "lat": 37.15,
    "lon": 38.8,
    "districts": [
      "Ak\xE7akale",
      "Birecik",
      "Bozova",
      "Ceylanp\u0131nar",
      "Eyy\xFCbiye",
      "Halfeti",
      "Haliliye",
      "Harran",
      "Hilvan",
      "Karak\xF6pr\xFC",
      "Siverek",
      "Suru\xE7",
      "Viran\u015Fehir"
    ]
  },
  {
    "id": 73,
    "name": "\u015E\u0131rnak",
    "lat": 37.5167,
    "lon": 42.4667,
    "districts": [
      "Beyt\xFC\u015F\u015Febap",
      "Cizre",
      "G\xFC\xE7l\xFCkonak",
      "\u0130dil",
      "Merkez",
      "Silopi",
      "Uludere"
    ]
  },
  {
    "id": 59,
    "name": "Tekirda\u011F",
    "lat": 40.9833,
    "lon": 27.5167,
    "districts": [
      "\xC7erkezk\xF6y",
      "\xC7orlu",
      "Ergene",
      "Hayrabolu",
      "Kapakl\u0131",
      "Malkara",
      "Marmaraere\u011Flisi",
      "Muratl\u0131",
      "Saray",
      "S\xFCleymanpa\u015Fa",
      "\u015Eark\xF6y"
    ]
  },
  {
    "id": 60,
    "name": "Tokat",
    "lat": 40.3167,
    "lon": 36.55,
    "districts": [
      "Almus",
      "Artova",
      "Ba\u015F\xE7iftlik",
      "Erbaa",
      "Merkez",
      "Niksar",
      "Pazar",
      "Re\u015Fadiye",
      "Sulusaray",
      "Turhal",
      "Ye\u015Filyurt",
      "Zile"
    ]
  },
  {
    "id": 61,
    "name": "Trabzon",
    "lat": 41,
    "lon": 39.7333,
    "districts": [
      "Ak\xE7aabat",
      "Arakl\u0131",
      "Arsin",
      "Be\u015Fikd\xFCz\xFC",
      "\xC7ar\u015F\u0131ba\u015F\u0131",
      "\xC7aykara",
      "Dernekpazar\u0131",
      "D\xFCzk\xF6y",
      "Hayrat",
      "K\xF6pr\xFCba\u015F\u0131",
      "Ma\xE7ka",
      "Of",
      "Ortahisar",
      "S\xFCrmene",
      "\u015Ealpazar\u0131",
      "Tonya",
      "Vakf\u0131kebir",
      "Yomra"
    ]
  },
  {
    "id": 62,
    "name": "Tunceli",
    "lat": 39.1167,
    "lon": 39.5333,
    "districts": [
      "\xC7emi\u015Fgezek",
      "Hozat",
      "Mazgirt",
      "Merkez",
      "Naz\u0131miye",
      "Ovac\u0131k",
      "Pertek",
      "P\xFCl\xFCm\xFCr"
    ]
  },
  {
    "id": 64,
    "name": "U\u015Fak",
    "lat": 38.6833,
    "lon": 29.4167,
    "districts": [
      "Banaz",
      "E\u015Fme",
      "Karahall\u0131",
      "Merkez",
      "Sivasl\u0131",
      "Ulubey"
    ]
  },
  {
    "id": 65,
    "name": "Van",
    "lat": 38.5,
    "lon": 43.4,
    "districts": [
      "Bah\xE7esaray",
      "Ba\u015Fkale",
      "\xC7ald\u0131ran",
      "\xC7atak",
      "Edremit",
      "Erci\u015F",
      "Geva\u015F",
      "G\xFCrp\u0131nar",
      "\u0130pekyolu",
      "Muradiye",
      "\xD6zalp",
      "Saray",
      "Tu\u015Fba"
    ]
  },
  {
    "id": 77,
    "name": "Yalova",
    "lat": 40.65,
    "lon": 29.2667,
    "districts": [
      "Alt\u0131nova",
      "Armutlu",
      "\xC7\u0131narc\u0131k",
      "\xC7iftlikk\xF6y",
      "Merkez",
      "Termal"
    ]
  },
  {
    "id": 66,
    "name": "Yozgat",
    "lat": 39.8167,
    "lon": 34.8167,
    "districts": [
      "Akda\u011Fmadeni",
      "Ayd\u0131nc\u0131k",
      "Bo\u011Fazl\u0131yan",
      "\xC7and\u0131r",
      "\xC7ay\u0131ralan",
      "\xC7ekerek",
      "Kad\u0131\u015Fehri",
      "Merkez",
      "Saraykent",
      "Sar\u0131kaya",
      "Sorgun",
      "\u015Eefaatli",
      "Yenifak\u0131l\u0131",
      "Yerk\xF6y"
    ]
  },
  {
    "id": 67,
    "name": "Zonguldak",
    "lat": 41.45,
    "lon": 31.8,
    "districts": [
      "Alapl\u0131",
      "\xC7aycuma",
      "Devrek",
      "Ere\u011Fli",
      "G\xF6k\xE7ebey",
      "Kilimli",
      "Kozlu",
      "Merkez"
    ]
  }
];
function normalizeTurkishText(text2) {
  if (!text2) return "";
  return text2.trim().replace(/İ/g, "i").replace(/I/g, "i").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}
var KNOWN_DISTRICT_COORDS = {
  "kadikoy-istanbul": { lat: 40.9788, lon: 29.0827 },
  "besiktas-istanbul": { lat: 41.0422, lon: 29.0067 },
  "sisli-istanbul": { lat: 41.0602, lon: 28.9877 },
  "fatih-istanbul": { lat: 41.0186, lon: 28.9497 },
  "uskudar-istanbul": { lat: 41.0267, lon: 29.0156 },
  "sariyer-istanbul": { lat: 41.1663, lon: 29.0504 },
  "bakirkoy-istanbul": { lat: 40.9792, lon: 28.8717 },
  "beyoglu-istanbul": { lat: 41.037, lon: 28.9763 },
  "atasehir-istanbul": { lat: 40.9847, lon: 29.1067 },
  "maltepe-istanbul": { lat: 40.9247, lon: 29.1311 },
  "pendik-istanbul": { lat: 40.8744, lon: 29.2333 },
  "kartal-istanbul": { lat: 40.8886, lon: 29.1856 },
  "cankaya-ankara": { lat: 39.9042, lon: 32.8597 },
  "yenimahalle-ankara": { lat: 39.9719, lon: 32.8028 },
  "kecioren-ankara": { lat: 40.0197, lon: 32.8611 },
  "etimesgut-ankara": { lat: 39.9519, lon: 32.6844 },
  "konak-izmir": { lat: 38.4192, lon: 27.1287 },
  "karsiyaka-izmir": { lat: 38.4594, lon: 27.1106 },
  "bornova-izmir": { lat: 38.465, lon: 27.2181 },
  "buca-izmir": { lat: 38.3878, lon: 27.1778 },
  "cesme-izmir": { lat: 38.3236, lon: 26.3056 },
  "nilufer-bursa": { lat: 40.2144, lon: 28.9839 },
  "osmangazi-bursa": { lat: 40.1989, lon: 29.0608 },
  "muratpasa-antalya": { lat: 36.8841, lon: 30.7056 },
  "konyaalti-antalya": { lat: 36.8617, lon: 30.6361 },
  "alanya-antalya": { lat: 36.5438, lon: 31.9997 }
};
function searchTurkishLocations(query, limit = 8) {
  const norm = normalizeTurkishText(query);
  if (!norm || norm.length < 2) return [];
  const results = [];
  const seen = /* @__PURE__ */ new Set();
  for (const prov of TURKISH_PROVINCES) {
    const pNorm = normalizeTurkishText(prov.name);
    if (pNorm.startsWith(norm) || pNorm === norm) {
      const key = prov.name;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ label: prov.name, province: prov.name, lat: prov.lat, lon: prov.lon });
      }
    }
  }
  for (const prov of TURKISH_PROVINCES) {
    const pNorm = normalizeTurkishText(prov.name);
    for (const dist of prov.districts) {
      const dNorm = normalizeTurkishText(dist);
      const combo1 = `${dNorm} ${pNorm}`;
      const combo2 = `${pNorm} ${dNorm}`;
      if (dNorm.startsWith(norm) || dNorm === norm || combo1.includes(norm) || combo2.includes(norm)) {
        const key = `${dist}, ${prov.name}`;
        if (!seen.has(key)) {
          seen.add(key);
          const coordKey = `${dNorm}-${pNorm}`;
          const coords = KNOWN_DISTRICT_COORDS[coordKey] || { lat: prov.lat, lon: prov.lon };
          results.push({
            label: key,
            province: prov.name,
            district: dist,
            lat: coords.lat,
            lon: coords.lon
          });
          if (results.length >= limit) return results;
        }
      }
    }
  }
  if (results.length < limit) {
    for (const prov of TURKISH_PROVINCES) {
      const pNorm = normalizeTurkishText(prov.name);
      if (pNorm.includes(norm) && !seen.has(prov.name)) {
        seen.add(prov.name);
        results.push({ label: prov.name, province: prov.name, lat: prov.lat, lon: prov.lon });
        if (results.length >= limit) return results;
      }
    }
  }
  return results;
}
function resolveTurkishLocation(query) {
  const matches = searchTurkishLocations(query, 1);
  if (matches[0]) {
    return {
      latitude: matches[0].lat,
      longitude: matches[0].lon,
      label: matches[0].label
    };
  }
  return null;
}

// backend/weather.ts
var WMO_CODES = {
  0: "A\xE7\u0131k",
  1: "\xC7o\u011Funlukla a\xE7\u0131k",
  2: "Par\xE7al\u0131 bulutlu",
  3: "Kapal\u0131",
  45: "Sisli",
  48: "K\u0131ra\u011F\u0131l\u0131 sis",
  51: "Hafif \xE7isenti",
  53: "Orta \xE7isenti",
  55: "Yo\u011Fun \xE7isenti",
  56: "Hafif dondurucu \xE7isenti",
  57: "Yo\u011Fun dondurucu \xE7isenti",
  61: "Hafif ya\u011Fmur",
  63: "Orta \u015Fiddetli ya\u011Fmur",
  65: "\u015Eiddetli ya\u011Fmur",
  66: "Hafif dondurucu ya\u011Fmur",
  67: "\u015Eiddetli dondurucu ya\u011Fmur",
  71: "Hafif kar",
  73: "Orta \u015Fiddetli kar",
  75: "Yo\u011Fun kar",
  77: "Kar taneleri",
  80: "Hafif sa\u011Fanak ya\u011F\u0131\u015F",
  81: "Orta sa\u011Fanak ya\u011F\u0131\u015F",
  82: "\u015Eiddetli sa\u011Fanak ya\u011F\u0131\u015F",
  85: "Hafif kar sa\u011Fana\u011F\u0131",
  86: "Yo\u011Fun kar sa\u011Fana\u011F\u0131",
  95: "G\xF6k g\xFCr\xFClt\xFCl\xFC f\u0131rt\u0131na",
  96: "Hafif dolulu f\u0131rt\u0131na",
  99: "\u015Eiddetli dolulu f\u0131rt\u0131na"
};
var RAIN_CODES = /* @__PURE__ */ new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
var SNOW_CODES = /* @__PURE__ */ new Set([71, 73, 75, 77, 85, 86]);
var WeatherError = class extends Error {
};
var isCustomFetcher = false;
var fetcher = (url) => fetch(url, { signal: AbortSignal.timeout(8e3) });
var geocodeCache = /* @__PURE__ */ new Map();
async function geocode(name) {
  const normKey = name.trim().toLowerCase();
  const cached = geocodeCache.get(normKey);
  if (cached && cached.expires > Date.now()) return cached.data;
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=tr&format=json&countryCode=TR`;
  const res = await fetcher(url);
  if (!res.ok) throw new WeatherError(`Konum servisi hata verdi (${res.status}).`);
  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  if (geocodeCache.size > 200) geocodeCache.clear();
  geocodeCache.set(normKey, { expires: Date.now() + 24 * 60 * 60 * 1e3, data: results });
  return results;
}
async function resolveLocation(input) {
  if (!input) return null;
  const location = typeof input === "string" ? { type: "text", query: input } : input;
  if (location.type === "coords") {
    if (!Number.isFinite(location.lat) || !Number.isFinite(location.lon)) return null;
    if (Math.abs(location.lat) > 90 || Math.abs(location.lon) > 180) return null;
    return { latitude: location.lat, longitude: location.lon, label: location.label || "Mevcut konum" };
  }
  if (location.type === "place") {
    const province = (location.province || "").trim();
    const district = (location.district || "").trim();
    if (!province) return null;
    if (!isCustomFetcher) {
      const placeQuery = district ? `${district}, ${province}` : province;
      const local = resolveTurkishLocation(placeQuery) || (district ? resolveTurkishLocation(district) : null) || resolveTurkishLocation(province);
      if (local) return local;
    }
    if (district) {
      const found = await findDistrict(province, district);
      if (found) return found;
    }
    return findProvince(province);
  }
  const query = (location.query || "").trim();
  if (query.length < 2) return null;
  if (!isCustomFetcher) {
    const localMatch = resolveTurkishLocation(query);
    if (localMatch) return localMatch;
  }
  const parts = query.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const [first, second] = parts;
    if (!isCustomFetcher) {
      const localCombo = resolveTurkishLocation(`${first}, ${second}`) || resolveTurkishLocation(`${second}, ${first}`) || resolveTurkishLocation(first) || resolveTurkishLocation(second);
      if (localCombo) return localCombo;
    }
    return await findDistrict(second, first) || await findDistrict(first, second) || await findProvince(second) || await findProvince(first);
  }
  const results = await geocode(query);
  return results[0] ? toResolved(results[0], query) : null;
}
async function findDistrict(province, district) {
  const label = `${district}, ${province}`;
  const exact = await geocode(label);
  if (exact[0]) return toResolved(exact[0], label);
  const loose = await geocode(district);
  const match = loose.find((r) => normalizeTr(r.admin1) === normalizeTr(province));
  return match ? toResolved(match, label) : null;
}
async function findProvince(province) {
  const results = await geocode(province);
  const wanted = normalizeTr(province);
  const match = results.find((r) => normalizeTr(r.admin1) === wanted && normalizeTr(r.name) === wanted) || results.find((r) => normalizeTr(r.admin1) === wanted);
  return match ? toResolved(match, province) : null;
}
function toResolved(result, label) {
  return { latitude: result.latitude, longitude: result.longitude, label };
}
var forecastCache = /* @__PURE__ */ new Map();
async function fetchForecast(latitude, longitude) {
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = forecastCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
    hourly: "temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m",
    daily: "temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,weather_code",
    timezone: "auto",
    forecast_days: "16"
  });
  const res = await fetcher(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) throw new WeatherError(`Hava durumu servisi hata verdi (${res.status}).`);
  const data = await res.json();
  if (forecastCache.size > 200) forecastCache.clear();
  forecastCache.set(key, { expires: Date.now() + 30 * 60 * 1e3, data });
  return data;
}
function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
async function getWeather(location, dateTime) {
  const data = await fetchForecast(location.latitude, location.longitude);
  const hourlyTimes = data?.hourly?.time || [];
  const dailyTimes = data?.daily?.time || [];
  let hourIndex = -1;
  let isForecast = false;
  if (dateTime) {
    const target = `${dateTime.slice(0, 13)}:00`;
    hourIndex = hourlyTimes.indexOf(target);
    if (hourIndex === -1) throw new WeatherError("Se\xE7ilen tarih i\xE7in tahmin yok (en fazla 16 g\xFCn sonras\u0131).");
    isForecast = true;
  } else {
    const currentTime = data?.current?.time;
    if (currentTime) hourIndex = hourlyTimes.indexOf(`${currentTime.slice(0, 13)}:00`);
  }
  const date = dateTime ? dateTime.slice(0, 10) : (data?.current?.time || "").slice(0, 10);
  const dayIndex = dailyTimes.indexOf(date);
  const hourly = data?.hourly || {};
  const current = data?.current || {};
  const daily = data?.daily || {};
  const temperature = isForecast ? num(hourly.temperature_2m?.[hourIndex]) : num(current.temperature_2m);
  const feelsLike = isForecast ? num(hourly.apparent_temperature?.[hourIndex]) : num(current.apparent_temperature);
  const code = isForecast ? num(hourly.weather_code?.[hourIndex]) : num(current.weather_code);
  const wind = isForecast ? num(hourly.wind_speed_10m?.[hourIndex]) : num(current.wind_speed_10m);
  if (temperature === null || code === null) {
    throw new WeatherError("Hava durumu verisi eksik geldi.");
  }
  const hourlyPrecip = hourIndex >= 0 ? num(hourly.precipitation_probability?.[hourIndex]) : null;
  const dailyPrecip = dayIndex >= 0 ? num(daily.precipitation_probability_max?.[dayIndex]) : null;
  return {
    locationLabel: location.label,
    latitude: location.latitude,
    longitude: location.longitude,
    time: isForecast ? `${dateTime.slice(0, 13)}:00` : current.time || "",
    isForecast,
    temperatureC: Math.round(temperature * 10) / 10,
    feelsLikeC: Math.round((feelsLike ?? temperature) * 10) / 10,
    minC: dayIndex >= 0 ? num(daily.temperature_2m_min?.[dayIndex]) : null,
    maxC: dayIndex >= 0 ? num(daily.temperature_2m_max?.[dayIndex]) : null,
    precipitationProbability: hourlyPrecip ?? dailyPrecip,
    weatherCode: code,
    condition: WMO_CODES[code] || "Bilinmeyen hava durumu",
    windKmh: wind
  };
}

// backend/knowledge/rules.ts
var KNOWLEDGE_RULES = [
  // ─── RENK ────────────────────────────────────────────────────────────────
  {
    id: "color_60_30_10",
    category: "color",
    general: true,
    priority: 3,
    title: "60-30-10 dengesi",
    text: "Bir ana renk (yakla\u015F\u0131k %60), bir ikincil renk (%30) ve k\xFC\xE7\xFCk bir vurgu (%10) kullan. Vurgu genelde ayakkab\u0131, \xE7anta veya aksesuarda kal\u0131r."
  },
  {
    id: "color_neutral_accent",
    category: "color",
    general: true,
    priority: 3,
    title: "N\xF6tr zemin, tek vurgu",
    text: "Canl\u0131 bir renk kullan\u0131yorsan geri kalan par\xE7alar\u0131 siyah, beyaz, gri, lacivert, bej veya kahverengi gibi n\xF6trlerde tut. \u0130ki canl\u0131 renk ayn\u0131 anda yar\u0131\u015Fmas\u0131n."
  },
  {
    id: "color_tonal",
    category: "color",
    priority: 2,
    styleTags: ["Monokromatik"],
    title: "Ton-s\xFCr-ton",
    text: "Ayn\u0131 rengin a\xE7\u0131k, orta ve koyu tonlar\u0131n\u0131 bir arada kullan (\xF6r. koyu kahve pantolon, s\xFCtl\xFC kahve triko, bej kaban). G\xF6z tek renkte kayd\u0131\u011F\u0131 i\xE7in boy uzun ve rafine g\xF6r\xFCn\xFCr."
  },
  {
    id: "color_tonal_formal",
    category: "color",
    priority: 2,
    formality: [3, 5],
    title: "\u015E\u0131k kombinde sakin palet",
    text: "Resmiyet artt\u0131k\xE7a palet sadele\u015Fir: lacivert, gri, siyah, bej ve kahverengi a\u011F\u0131rl\u0131kl\u0131 bir kombin, tek bir derin tonla (bordo, z\xFCmr\xFCt) zenginle\u015Fir."
  },
  {
    id: "color_complementary",
    category: "color",
    priority: 2,
    styleTags: ["Tamamlay\u0131c\u0131"],
    title: "Tamamlay\u0131c\u0131 renkler",
    text: "Renk \xE7emberinde kar\u015F\u0131l\u0131kl\u0131 renkler (mavi\u2013turuncu, mor\u2013sar\u0131, bordo\u2013ye\u015Fil) birbirini canland\u0131r\u0131r. Birini ana, di\u011Ferini k\xFC\xE7\xFCk bir vurgu olarak kullan; iki b\xFCy\xFCk par\xE7ada e\u015Fit da\u011F\u0131tma."
  },
  {
    id: "color_analogous",
    category: "color",
    general: true,
    priority: 1,
    title: "Kom\u015Fu renkler",
    text: "Renk \xE7emberinde yan yana duran renkler (bordo\u2013pembe, mavi\u2013ye\u015Fil, sar\u0131\u2013turuncu) yumu\u015Fak ve uyumlu ge\xE7i\u015F sa\u011Flar; kontrast istemedi\u011Finde g\xFCvenli se\xE7imdir."
  },
  {
    id: "color_navy_camel",
    category: "color",
    priority: 2,
    formality: [3, 5],
    title: "Lacivert ve kahve/bej",
    text: "Lacivert; taba, camel, bej ve kahverengiyle klasik ve s\u0131cak bir uyum yakalar. \u0130\u015F ve ak\u015Fam kombinlerinde siyahtan daha yumu\u015Fak bir ciddiyet verir."
  },
  {
    id: "color_black_white",
    category: "color",
    priority: 2,
    styleTags: ["Kontrast", "Minimalist"],
    title: "Siyah-beyaz kontrast",
    text: "Siyah ve beyaz g\xFC\xE7l\xFC bir kontrast kurar. Kontrast\u0131 dengelemek i\xE7in \xFC\xE7\xFCnc\xFC bir renk eklemek yerine dokularla (deri, triko, saten) \xE7e\u015Fitlilik yarat."
  },
  {
    id: "color_pastel",
    category: "color",
    priority: 2,
    styleTags: ["Pastel"],
    title: "Pastel dengesi",
    text: "Pastel tonlar beyaz, krem, a\xE7\u0131k gri veya kum rengiyle ferah durur. Birden fazla pasteli yan yana kullan\u0131yorsan ayn\u0131 a\xE7\u0131kl\u0131k seviyesinde tut."
  },
  {
    id: "color_earth_autumn",
    category: "color",
    priority: 2,
    seasons: ["sonbahar"],
    title: "Toprak tonlar\u0131",
    text: "Sonbaharda haki, kahverengi, hardal, kiremit ve bordo birbiriyle do\u011Fal bir uyum kurar; krem veya ekru bir par\xE7a bu paleti ayd\u0131nlat\u0131r."
  },
  {
    id: "color_summer_light",
    category: "color",
    priority: 2,
    tempBands: ["warm", "hot"],
    title: "S\u0131cakta a\xE7\u0131k renkler",
    text: "S\u0131cak havada beyaz, krem, a\xE7\u0131k mavi ve pastel tonlar hem daha serin tutar hem de ferah g\xF6r\xFCn\xFCr. Koyu renkleri alt par\xE7ada veya aksesuarda kullan."
  },
  {
    id: "color_winter_deep",
    category: "color",
    priority: 2,
    seasons: ["k\u0131\u015F"],
    title: "K\u0131\u015F tonlar\u0131",
    text: "K\u0131\u015F\u0131n koyu lacivert, antrasit, bordo ve orman ye\u015Fili gibi derin tonlar y\xFCn ve ka\u015Fe dokularla zenginle\u015Fir; a\xE7\u0131k renkli bir atk\u0131 y\xFCze \u0131\u015F\u0131k verir."
  },
  {
    id: "color_shoe_accent",
    category: "color",
    priority: 1,
    styleTags: ["Maximalist"],
    title: "Renkli ayakkab\u0131 vurgusu",
    text: "N\xF6tr bir kombinde renkli ayakkab\u0131 veya \xE7anta tek ba\u015F\u0131na vurgu olabilir; ayn\u0131 rengi k\xFC\xE7\xFCk bir aksesuarda tekrarlamak b\xFCt\xFCnl\xFCk sa\u011Flar."
  },
  {
    id: "color_repeat",
    category: "color",
    general: true,
    priority: 1,
    title: "Renk tekrar\u0131",
    text: "\xDCstteki bir rengi ayakkab\u0131, kemer veya \xE7antada k\xFC\xE7\xFCk \xF6l\xE7\xFCde tekrarlamak kombini bilin\xE7li ve b\xFCt\xFCn g\xF6sterir."
  },
  {
    id: "color_texture_monochrome",
    category: "color",
    priority: 2,
    styleTags: ["Monokromatik", "N\xF6tr Tonlar"],
    title: "Tek renkte doku",
    text: "Tek renk veya n\xF6tr bir palet d\xFCz g\xF6r\xFCnmesin diye farkl\u0131 dokular\u0131 (\xF6rg\xFC, deri, saten, keten) bir araya getir."
  },
  {
    id: "color_neutral_layers",
    category: "color",
    priority: 2,
    styleTags: ["N\xF6tr Tonlar"],
    title: "N\xF6tr katmanlar",
    text: "Bej, ta\u015F, gri ve ekruyu katmanlarken tonlar aras\u0131nda hafif a\xE7\u0131kl\u0131k fark\u0131 b\u0131rak; tamamen ayn\u0131 ton kombini soluk g\xF6sterebilir."
  },
  {
    id: "color_contrast_block",
    category: "color",
    priority: 2,
    styleTags: ["Kontrast"],
    title: "A\xE7\u0131k\u2013koyu bloklama",
    text: "\xDCst ve alt aras\u0131nda belirgin a\xE7\u0131kl\u0131k fark\u0131 (\xF6r. krem \xFCst, koyu lacivert alt) sil\xFCeti netle\u015Ftirir ve foto\u011Frafta g\xFC\xE7l\xFC durur."
  },
  {
    id: "color_interview_calm",
    category: "color",
    priority: 3,
    events: ["\u0130\u015F G\xF6r\xFC\u015Fmesi"],
    title: "G\xF6r\xFC\u015Fmede sakin renkler",
    text: "\u0130\u015F g\xF6r\xFC\u015Fmesinde dikkati k\u0131yafete de\u011Fil sana \xE7ekecek sakin renkler se\xE7: lacivert, gri, siyah, bej, beyaz. Vurgu gerekiyorsa g\xF6mlek veya aksesuarda k\xFC\xE7\xFCk tut."
  },
  // ─── DESEN ───────────────────────────────────────────────────────────────
  {
    id: "pattern_single_focus",
    category: "pattern",
    general: true,
    priority: 3,
    title: "Tek desen odak",
    text: "Kombinde bir desenli par\xE7a yeterlidir; di\u011Fer par\xE7alar\u0131 desenin i\xE7indeki renklerden birinde ve d\xFCz se\xE7."
  },
  {
    id: "pattern_mixing",
    category: "pattern",
    priority: 2,
    styleTags: ["Maximalist", "Vintage"],
    title: "Desen kar\u0131\u015Ft\u0131rma",
    text: "\u0130ki deseni birle\u015Ftireceksen desen \xF6l\xE7eklerini farkl\u0131 tut (ince \xE7izgi ile b\xFCy\xFCk kare gibi) ve ortak bir renk \xFCzerinden ba\u011Fla."
  },
  {
    id: "pattern_stripes_neutral",
    category: "pattern",
    general: true,
    priority: 1,
    title: "\xC7izgili basic",
    text: "\u0130nce \xE7izgili (\xF6r. lacivert-beyaz) par\xE7alar neredeyse n\xF6tr gibi davran\u0131r; d\xFCz renkli par\xE7alarla rahat\xE7a e\u015Fle\u015Fir."
  },
  {
    id: "pattern_animal",
    category: "pattern",
    priority: 2,
    styleTags: ["Maximalist", "Y2K"],
    title: "Hayvan deseni",
    text: "Leopar veya y\u0131lan derisi deseni tek ba\u015F\u0131na g\xFC\xE7l\xFC bir odakt\u0131r; siyah, kahverengi, krem gibi n\xF6trlerle kullan."
  },
  {
    id: "pattern_floral",
    category: "pattern",
    priority: 2,
    styleTags: ["Romantic", "Boho"],
    title: "\xC7i\xE7ek deseni",
    text: "\xC7i\xE7ekli par\xE7alar romantik ve bohem stile uyar; desenin zemin rengini ayakkab\u0131 veya h\u0131rkada tekrarla, sert kontrastlardan ka\xE7\u0131n."
  },
  {
    id: "pattern_graphic",
    category: "pattern",
    priority: 2,
    formality: [1, 2],
    title: "Grafik bask\u0131",
    text: "Grafik bask\u0131l\u0131 ti\u015F\xF6rtler g\xFCndelik ve sokak stiline aittir; d\xFCz jean, cargo veya jogger ile rahat, sneaker ile tamamlan\u0131r."
  },
  {
    id: "pattern_minimal",
    category: "pattern",
    priority: 2,
    styleTags: ["Minimalist"],
    title: "Minimalist desen",
    text: "Minimalist stilde desen yerine temiz \xE7izgiler, kaliteli kuma\u015F ve iyi oturan kesim \xF6ne \xE7\u0131kar; desen kullan\u0131lacaksa ince \xE7izgi veya k\xFC\xE7\xFCk doku yeterli."
  },
  {
    id: "pattern_office",
    category: "pattern",
    priority: 2,
    events: ["Ofis", "\u0130\u015F G\xF6r\xFC\u015Fmesi"],
    title: "\u0130\u015F ortam\u0131nda desen",
    text: "\u0130\u015F ortam\u0131nda ince \xE7izgi, k\xFC\xE7\xFCk kare veya hafif doku uygundur; b\xFCy\xFCk grafik bask\u0131lar ve iddial\u0131 desenler dikkat da\u011F\u0131t\u0131r."
  },
  // ─── KUMAŞ / DOKU ────────────────────────────────────────────────────────
  {
    id: "fabric_winter",
    category: "fabric",
    priority: 2,
    tempBands: ["cold", "freezing"],
    title: "K\u0131\u015F dokular\u0131",
    text: "So\u011Fukta y\xFCn, ka\u015Fmir, ka\u015Fe, kadife ve kal\u0131n \xF6rg\xFC hem s\u0131cak tutar hem de kombine zengin bir doku katar."
  },
  {
    id: "fabric_summer",
    category: "fabric",
    priority: 2,
    tempBands: ["warm", "hot"],
    title: "Yaz kuma\u015Flar\u0131",
    text: "S\u0131cakta keten, pamuk, ipek ve viskon gibi nefes alan, terletmeyen kuma\u015Flar\u0131 se\xE7; sentetik ve kal\u0131n kuma\u015Flardan ka\xE7\u0131n."
  },
  {
    id: "fabric_texture_contrast",
    category: "fabric",
    general: true,
    priority: 1,
    title: "Doku kontrast\u0131",
    text: "P\xFCr\xFCzs\xFCz bir kuma\u015F\u0131 dokulu bir kuma\u015Fla e\u015Fle\u015Ftirmek (saten ile triko, deri ile y\xFCn) kombine derinlik verir."
  },
  {
    id: "fabric_linen_office",
    category: "fabric",
    priority: 2,
    events: ["Ofis"],
    tempBands: ["warm", "hot"],
    title: "S\u0131cakta ofis kuma\u015F\u0131",
    text: "S\u0131cak havada ofiste keten kar\u0131\u015F\u0131ml\u0131 pantolon ve pamuklu g\xF6mlek hem rahat hem d\xFCzg\xFCn durur; \xE7ok buru\u015Fan saf keteni resmi toplant\u0131larda dikkatli kullan."
  },
  {
    id: "fabric_evening_sheen",
    category: "fabric",
    priority: 2,
    events: ["Parti", "D\xFC\u011F\xFCn/Davet"],
    title: "Gece parlakl\u0131\u011F\u0131",
    text: "Ak\u015Fam etkinliklerinde saten, ipek, kadife ve hafif par\u0131lt\u0131l\u0131 kuma\u015Flar yak\u0131\u015F\u0131r; parlakl\u0131\u011F\u0131 tek par\xE7ada tutup di\u011Ferlerini mat se\xE7."
  },
  {
    id: "fabric_denim_on_denim",
    category: "fabric",
    priority: 1,
    styleTags: ["Streetwear", "Vintage"],
    title: "Kot \xFCst\xFCne kot",
    text: "Kot ceket ile kot pantolon birlikte giyilecekse tonlar\u0131 belirgin \u015Fekilde farkl\u0131 olsun (a\xE7\u0131k y\u0131kama ceket, koyu pantolon)."
  },
  {
    id: "fabric_sport_technical",
    category: "fabric",
    priority: 3,
    events: ["Spor"],
    title: "Teknik kuma\u015F",
    text: "Sporda ter atan, esneyen teknik kuma\u015Flar\u0131 tercih et; pamuk teri tutar ve so\u011Fukta \xFC\u015F\xFCt\xFCr."
  },
  {
    id: "fabric_velvet_evening",
    category: "fabric",
    priority: 1,
    events: ["Parti", "Randevu", "D\xFC\u011F\xFCn/Davet"],
    tempBands: ["cool", "cold", "freezing"],
    title: "Kadife ak\u015Fam",
    text: "Serin ve so\u011Fuk ak\u015Famlarda kadife ceket, pantolon veya elbise hem s\u0131cak tutar hem de \u015F\u0131k bir doku sa\u011Flar."
  },
  {
    id: "fabric_wet_avoid",
    category: "fabric",
    priority: 2,
    precipitation: ["rain", "snow"],
    title: "Islak havada kuma\u015F",
    text: "Ya\u011F\u0131\u015Fl\u0131 havada s\xFCet ayakkab\u0131, ipek ve a\xE7\u0131k renk uzun pa\xE7alar kolayca lekelenir; deri, suya dayan\u0131kl\u0131 veya koyu renkli par\xE7alar\u0131 se\xE7."
  },
  {
    id: "fabric_travel",
    category: "fabric",
    priority: 2,
    events: ["Seyahat"],
    title: "Seyahat kuma\u015F\u0131",
    text: "Seyahatte buru\u015Fmayan triko, jarse ve esnek kuma\u015Flar uzun yolculukta d\xFCzg\xFCn kal\u0131r ve rahatt\u0131r."
  },
  // ─── ORAN / SİLÜET ───────────────────────────────────────────────────────
  {
    id: "prop_volume_balance",
    category: "proportion",
    general: true,
    priority: 3,
    title: "Hacim dengesi",
    text: "\xDCst bol veya oversize ise alt par\xE7ay\u0131 dar ya da d\xFCz kesim se\xE7; alt geni\u015F pa\xE7a ise \xFCst daha oturan olsun. \u0130ki bol par\xE7a sil\xFCeti kaybettirir."
  },
  {
    id: "prop_rule_of_thirds",
    category: "proportion",
    general: true,
    priority: 2,
    title: "\xDC\xE7te bir oran\u0131",
    text: "V\xFCcudu ortadan ikiye b\xF6lmek yerine \xFCst\xFC k\u0131sa (1/3), alt\u0131 uzun (2/3) g\xF6ster: \xFCst\xFC y\xFCksek bel pantolonun i\xE7ine hafif\xE7e sokmak bacaklar\u0131 uzun g\xF6sterir."
  },
  {
    id: "prop_crop_highwaist",
    category: "proportion",
    priority: 2,
    styleTags: ["Crop & High-waist"],
    title: "Crop ve y\xFCksek bel",
    text: "Crop \xFCstleri y\xFCksek bel pantolon veya etekle e\u015Fle\u015Ftir; bel \xE7izgisi y\xFCkselir ve orant\u0131 dengelenir."
  },
  {
    id: "prop_oversize",
    category: "proportion",
    priority: 2,
    styleTags: ["Oversize"],
    title: "Oversize dengesi",
    text: "Oversize bir par\xE7ay\u0131 merkeze al; di\u011Fer par\xE7alardan en az birini daha oturan se\xE7 ya da kollar\u0131 k\u0131v\u0131rarak ve bile\u011Fi g\xF6stererek hacmi dengele."
  },
  {
    id: "prop_fitted",
    category: "proportion",
    priority: 2,
    styleTags: ["Fitted"],
    title: "Oturan kesimler",
    text: "V\xFCcuda oturan kesimlerde kuma\u015F\u0131n kalitesi ve boylar\u0131n do\u011Fru olmas\u0131 \xF6ne \xE7\u0131kar; \xE7ok dar ve gergin duran par\xE7alar yerine v\xFCcudu takip eden kesimler se\xE7."
  },
  {
    id: "prop_wide_leg",
    category: "proportion",
    general: true,
    priority: 1,
    title: "Geni\u015F pa\xE7a",
    text: "Geni\u015F pa\xE7a pantolonla oturan veya i\xE7eri sokulmu\u015F bir \xFCst kullan; pa\xE7a boyu ayakkab\u0131n\u0131n yar\u0131s\u0131n\u0131 kapatacak uzunlukta dursun."
  },
  {
    id: "prop_vertical_line",
    category: "proportion",
    general: true,
    priority: 1,
    title: "Dikey \xE7izgi",
    text: "A\xE7\u0131k b\u0131rak\u0131lm\u0131\u015F uzun bir ceket veya ayn\u0131 tondaki \xFCst-alt, g\xF6ze dikey bir \xE7izgi \xE7izer ve boyu uzun g\xF6sterir."
  },
  {
    id: "prop_blazer_length",
    category: "proportion",
    priority: 2,
    events: ["Ofis", "\u0130\u015F G\xF6r\xFC\u015Fmesi"],
    title: "Ceket boyu",
    text: "Blazer omuzdan ta\u015Fmamal\u0131, kollar\u0131 bile\u011Fi ge\xE7memeli; k\u0131sa ceketleri y\xFCksek bel altlarla, uzun ceketleri d\xFCz ve dar kesimlerle kullan."
  },
  {
    id: "prop_hem_shoes",
    category: "proportion",
    general: true,
    priority: 1,
    title: "Pa\xE7a ve ayakkab\u0131",
    text: "Dar pa\xE7a sneaker ve loaferla temiz durur; geni\u015F ve uzun pa\xE7alar hafif topuk veya kal\u0131n taban ister."
  },
  {
    id: "prop_belt_waist",
    category: "proportion",
    priority: 1,
    styleTags: ["Romantic", "Fitted"],
    title: "Bel vurgusu",
    text: "Bol bir elbise veya ceketi kemerle bele oturtmak sil\xFCeti tan\u0131mlar ve kombine zarif bir odak kazand\u0131r\u0131r."
  },
  {
    id: "prop_layer_lengths",
    category: "proportion",
    priority: 2,
    styleTags: ["Katmanl\u0131"],
    title: "Katman uzunluklar\u0131",
    text: "Katmanl\u0131 g\xF6r\xFCn\xFCmde en i\xE7teki par\xE7a en k\u0131sa, d\u0131\u015F katman en uzun olsun ya da katmanlar belirgin \u015Fekilde farkl\u0131 boylarda g\xF6r\xFCns\xFCn."
  },
  {
    id: "prop_dark_bottom",
    category: "proportion",
    general: true,
    priority: 1,
    title: "Odak noktas\u0131",
    text: "G\xF6z a\xE7\u0131k renklere ve desenlere \xE7ekilir: \xF6ne \xE7\u0131karmak istedi\u011Fin b\xF6lgeyi a\xE7\u0131k veya desenli, dengelemek istedi\u011Fin b\xF6lgeyi koyu ve d\xFCz se\xE7."
  },
  // ─── HAVA / KATMANLAMA ───────────────────────────────────────────────────
  {
    id: "weather_sandwich",
    category: "weather",
    priority: 2,
    tempBands: ["cool", "cold"],
    title: "Sandvi\xE7 katmanlama",
    text: "\u0130\xE7te ince bir ti\u015F\xF6rt veya bluz, ortada g\xF6mlek/h\u0131rka/triko, d\u0131\u015Fta yap\u0131land\u0131r\u0131lm\u0131\u015F bir ceket ya da kaban: hava de\u011Fi\u015Fse de katman \xE7\u0131kararak rahat edersin."
  },
  {
    id: "weather_cold_base",
    category: "weather",
    priority: 3,
    tempBands: ["cold", "freezing"],
    title: "So\u011Fukta i\xE7 kat",
    text: "So\u011Fukta tek kal\u0131n par\xE7a yerine ince y\xFCn veya termal bir i\xE7 kat ile iyi bir kaban daha s\u0131cak tutar; kapal\u0131 mekanda da rahat \xE7\u0131kar\u0131l\u0131r."
  },
  {
    id: "weather_freezing",
    category: "weather",
    priority: 3,
    tempBands: ["freezing"],
    title: "Dondurucu so\u011Fuk",
    text: "Donma noktas\u0131 civar\u0131nda kal\u0131n ve r\xFCzgar ge\xE7irmeyen bir mont/kaban, kapal\u0131 bot ve atk\u0131-bere-eldiven gerekir; a\xE7\u0131k ayakkab\u0131 ve ince kuma\u015F alt giyimden ka\xE7\u0131n."
  },
  {
    id: "weather_rain",
    category: "weather",
    priority: 3,
    precipitation: ["rain"],
    title: "Ya\u011Fmur",
    text: "Ya\u011F\u0131\u015Fta su ge\xE7irmez bir d\u0131\u015F katman (tren\xE7kot, ya\u011Fmurluk, deri ceket) ve suya dayan\u0131kl\u0131 ayakkab\u0131 se\xE7; kanvas ve s\xFCet ayakkab\u0131lar \u0131slan\u0131r."
  },
  {
    id: "weather_snow",
    category: "weather",
    priority: 3,
    precipitation: ["snow"],
    title: "Kar",
    text: "Karda kaymaz tabanl\u0131, su ge\xE7irmez botlar ve pa\xE7as\u0131 botun i\xE7ine girebilecek ya da bot \xFCst\xFCnde duran alt giyim kullan."
  },
  {
    id: "weather_swing",
    category: "weather",
    priority: 2,
    tempBands: ["mild", "cool"],
    title: "Sabah-ak\u015Fam fark\u0131",
    text: "Il\u0131k ve serin g\xFCnlerde sabah ile \xF6\u011Fle aras\u0131ndaki farka kar\u015F\u0131 kolayca \xE7\u0131kar\u0131labilen hafif bir katman (h\u0131rka, overshirt, ince ceket) ta\u015F\u0131."
  },
  {
    id: "weather_mild_light_layer",
    category: "weather",
    priority: 2,
    tempBands: ["mild"],
    title: "Il\u0131k hava",
    text: "Il\u0131k havada kal\u0131n d\u0131\u015F giyime gerek yok; ince blazer, kot ceket veya h\u0131rka kombini tamamlar ve ak\u015Fam serinli\u011Finde i\u015Fe yarar."
  },
  {
    id: "weather_warm_breathable",
    category: "weather",
    priority: 3,
    tempBands: ["warm", "hot"],
    title: "S\u0131cak hava",
    text: "S\u0131cak havada tek kat, nefes alan kuma\u015F ve biraz bol kesim tercih et; kal\u0131n d\u0131\u015F giyim ve bot gerekmez."
  },
  {
    id: "weather_hot",
    category: "weather",
    priority: 3,
    tempBands: ["hot"],
    title: "\xC7ok s\u0131cak",
    text: "\xC7ok s\u0131cakta a\xE7\u0131k renkli, bol kesim, tek katl\u0131 par\xE7alar ile sandalet, espadril veya nefes alan sneaker se\xE7; \u015Fapka ve g\xFCne\u015F g\xF6zl\xFC\u011F\xFC koruma sa\u011Flar."
  },
  {
    id: "weather_rain_coat",
    category: "weather",
    priority: 2,
    precipitation: ["rain"],
    title: "Ya\u011Fmurda \u015F\u0131kl\u0131k",
    text: "Tren\xE7kot ya\u011F\u0131\u015Fl\u0131 g\xFCnlerde hem g\xFCndelik hem i\u015F kombinlerini \u015F\u0131k tutar; \u015Femsiye kullan\u0131lacaksa daha ince bir su ge\xE7irmez ceket yeterlidir."
  },
  {
    id: "weather_cool_outer",
    category: "weather",
    priority: 2,
    tempBands: ["cool"],
    title: "Serin hava d\u0131\u015F katman\u0131",
    text: "Serin havada tren\xE7kot, deri ceket, kal\u0131n blazer veya ka\u015Fe ceket a\u011F\u0131rl\u0131\u011F\u0131nda bir d\u0131\u015F katman yeterlidir; \u015Fi\u015Fme mont fazla gelir."
  },
  {
    id: "weather_indoor_outdoor",
    category: "weather",
    priority: 1,
    tempBands: ["cold", "freezing"],
    title: "\u0130\xE7\u2013d\u0131\u015F mekan fark\u0131",
    text: "So\u011Fukta kaban \xE7\u0131kar\u0131ld\u0131\u011F\u0131nda alttaki kombin etkinli\u011Fe uygun g\xF6r\xFCnmeli; en \u015F\u0131k katman\u0131 i\xE7te, en s\u0131cak katman\u0131 d\u0131\u015Fta tut."
  },
  {
    id: "weather_winter_shoes",
    category: "weather",
    priority: 2,
    tempBands: ["cold", "freezing"],
    title: "K\u0131\u015F ayakkab\u0131s\u0131",
    text: "So\u011Fuk havada kapal\u0131 ve kal\u0131n tabanl\u0131 ayakkab\u0131 veya bot giy; ince tabanl\u0131 ayakkab\u0131lar yerden gelen so\u011Fu\u011Fu ge\xE7irir."
  },
  {
    id: "weather_office_ac",
    category: "weather",
    priority: 1,
    events: ["Ofis"],
    tempBands: ["warm", "hot"],
    title: "Klimal\u0131 ofis",
    text: "S\u0131cak g\xFCnlerde klimal\u0131 ofis i\xE7in ince bir h\u0131rka veya ceketi yan\u0131nda bulundur."
  },
  // ─── ETKİNLİK ────────────────────────────────────────────────────────────
  {
    id: "occ_casual_base",
    category: "occasion",
    priority: 3,
    events: ["G\xFCndelik"],
    title: "G\xFCndelik form\xFCl",
    text: "Temiz bir basic \xFCst, iyi oturan bir jean veya chino ve sade bir sneaker g\xFCndelik kombinin g\xFCvenli temelidir."
  },
  {
    id: "occ_casual_elevate",
    category: "occasion",
    priority: 2,
    events: ["G\xFCndelik"],
    formality: [2, 3],
    title: "G\xFCndeli\u011Fi bir t\u0131k \u015F\u0131kla\u015Ft\u0131r",
    text: "G\xFCndelik bir kombini bir blazer, loafer veya kaliteli bir triko ile smart casual seviyesine ta\u015F\u0131yabilirsin."
  },
  {
    id: "occ_casual_statement",
    category: "occasion",
    priority: 1,
    events: ["G\xFCndelik", "Okul"],
    title: "Tek iddial\u0131 par\xE7a",
    text: "G\xFCndelik kombinde tek bir iddial\u0131 par\xE7a (renkli ceket, desenli g\xF6mlek, dikkat \xE7eken ayakkab\u0131) yeterlidir; gerisi sade kals\u0131n."
  },
  {
    id: "occ_office_formula",
    category: "occasion",
    priority: 3,
    events: ["Ofis"],
    title: "Ofis form\xFCl\xFC",
    text: "Kuma\u015F pantolon veya d\xFCz kesim etek, g\xF6mlek/bluz/ince triko ve loafer veya sade deri ayakkab\u0131; so\u011Fukta \xFCst\xFCne blazer veya kaban."
  },
  {
    id: "occ_office_color",
    category: "occasion",
    priority: 2,
    events: ["Ofis"],
    title: "Ofiste renk",
    text: "Ofiste n\xF6tr bir temel \xFCzerine tek bir renk vurgusu profesyonel ama s\u0131k\u0131c\u0131 olmayan bir g\xF6r\xFCn\xFCm sa\u011Flar."
  },
  {
    id: "occ_office_avoid",
    category: "occasion",
    priority: 2,
    events: ["Ofis", "\u0130\u015F G\xF6r\xFC\u015Fmesi"],
    title: "\u0130\u015F ortam\u0131nda ka\xE7\u0131n\u0131lacaklar",
    text: "\u0130\u015F ortam\u0131nda \u015Fort, terlik, spor tayt, y\u0131rt\u0131k jean ve \xE7ok dekolteli par\xE7alardan ka\xE7\u0131n; kurumun k\xFClt\xFCr\xFC daha rahatsa bile temiz ve \xFCt\xFCl\xFC g\xF6r\xFCn."
  },
  {
    id: "occ_interview_level",
    category: "occasion",
    priority: 3,
    events: ["\u0130\u015F G\xF6r\xFC\u015Fmesi"],
    title: "Bir t\u0131k \u015F\u0131k",
    text: "G\xF6r\xFC\u015Fmeye \u015Firketin g\xFCnl\xFCk k\u0131yafet d\xFCzeninden bir seviye daha \u015F\u0131k git: yap\u0131land\u0131r\u0131lm\u0131\u015F bir ceket veya blazer g\xFCvenilir ve haz\u0131rl\u0131kl\u0131 g\xF6sterir."
  },
  {
    id: "occ_interview_formula",
    category: "occasion",
    priority: 3,
    events: ["\u0130\u015F G\xF6r\xFC\u015Fmesi"],
    title: "G\xF6r\xFC\u015Fme form\xFCl\xFC",
    text: "Oturan bir blazer, sade g\xF6mlek veya bluz, kuma\u015F pantolon ya da diz hizas\u0131 etek ve temiz, kapal\u0131 deri ayakkab\u0131 en g\xFCvenli g\xF6r\xFC\u015Fme kombinidir."
  },
  {
    id: "occ_interview_details",
    category: "occasion",
    priority: 2,
    events: ["\u0130\u015F G\xF6r\xFC\u015Fmesi"],
    title: "G\xF6r\xFC\u015Fmede ayr\u0131nt\u0131lar",
    text: "G\xF6r\xFC\u015Fmede aksesuar ve tak\u0131lar\u0131 sade tut, k\u0131yafetin \xFCt\xFCl\xFC ve ayakkab\u0131n\u0131n temiz oldu\u011Fundan emin ol; rahat edemeyece\u011Fin yeni ayakkab\u0131lardan ka\xE7\u0131n."
  },
  {
    id: "occ_date_comfort",
    category: "occasion",
    priority: 3,
    events: ["Randevu"],
    title: "Randevuda kendin ol",
    text: "Randevuda kendini rahat hissetti\u011Fin ama \xF6zen g\xF6sterdi\u011Fin bir kombin se\xE7; hi\xE7 denemedi\u011Fin, s\xFCrekli d\xFCzeltmen gereken par\xE7alar seni gergin g\xF6sterir."
  },
  {
    id: "occ_date_texture",
    category: "occasion",
    priority: 2,
    events: ["Randevu"],
    title: "Dokuyla \xF6zen",
    text: "Saten bir bluz, kaliteli bir triko veya deri bir ceket gibi tek bir dokulu par\xE7a randevu kombinini abartmadan \xF6zel k\u0131lar."
  },
  {
    id: "occ_date_venue",
    category: "occasion",
    priority: 2,
    events: ["Randevu"],
    title: "Mekana g\xF6re",
    text: "Ak\u015Fam yeme\u011Fi i\xE7in smart casual, a\xE7\u0131k hava veya kahve bulu\u015Fmas\u0131 i\xE7in rahat \u015F\u0131k bir kombin se\xE7; mekan\u0131n havas\u0131na uy."
  },
  {
    id: "occ_party_night",
    category: "occasion",
    priority: 3,
    events: ["Parti"],
    title: "Gece dokular\u0131",
    text: "Partide saten, deri, kadife veya \xF6l\xE7\xFCl\xFC par\u0131lt\u0131l\u0131 par\xE7alar \xF6ne \xE7\u0131kar; koyu bir zemin \xFCzerinde tek parlak par\xE7a en etkili sonucu verir."
  },
  {
    id: "occ_party_dance",
    category: "occasion",
    priority: 2,
    events: ["Parti"],
    title: "Uzun gece",
    text: "Uzun s\xFCre ayakta kalacaksan veya dans edeceksen \u015F\u0131k ama rahat ayakkab\u0131 se\xE7 (blok topuk, \u015F\u0131k bot, deri sneaker)."
  },
  {
    id: "occ_party_cocktail",
    category: "occasion",
    priority: 2,
    events: ["Parti"],
    formality: [3, 5],
    title: "Kokteyl",
    text: "Kokteyl davetinde midi elbise ya da \u015F\u0131k bir pantolon ile saten veya ipek bir \xFCst, zarif ayakkab\u0131yla tamamlan\u0131r."
  },
  {
    id: "occ_wedding_dresscode",
    category: "occasion",
    priority: 3,
    events: ["D\xFC\u011F\xFCn/Davet"],
    title: "Davet k\u0131yafet kural\u0131",
    text: "G\xFCnd\xFCz davetlerinde a\xE7\u0131k ve pastel tonlar, ak\u015Fam davetlerinde koyu ve derin tonlar ile daha parlak kuma\u015Flar uygundur."
  },
  {
    id: "occ_wedding_white",
    category: "occasion",
    priority: 3,
    events: ["D\xFC\u011F\xFCn/Davet"],
    title: "Beyazdan ka\xE7\u0131n",
    text: "D\xFC\u011F\xFCnlerde gelinle kar\u0131\u015Fmamak i\xE7in ba\u015Ftan a\u015Fa\u011F\u0131 beyaz veya k\u0131r\u0131k beyaz kombinlerden ka\xE7\u0131n."
  },
  {
    id: "occ_wedding_formula",
    category: "occasion",
    priority: 3,
    events: ["D\xFC\u011F\xFCn/Davet"],
    title: "Davet form\xFCl\xFC",
    text: "Tak\u0131m elbise veya \u015F\u0131k kuma\u015F pantolon ile ceket, ya da midi/uzun elbise; deri ve temiz ayakkab\u0131, \xF6l\xE7\xFCl\xFC tak\u0131larla tamamlan\u0131r. Jean ve spor ayakkab\u0131 davet i\xE7in uygun de\u011Fildir."
  },
  {
    id: "occ_wedding_henna",
    category: "occasion",
    priority: 1,
    events: ["D\xFC\u011F\xFCn/Davet"],
    formality: [3, 4],
    title: "K\u0131na ve ni\u015Fan",
    text: "K\u0131na ve ni\u015Fan gibi daha samimi davetlerde renkli ve daha rahat kesimler kullan\u0131labilir; yine de \u015F\u0131k ayakkab\u0131 ve \xF6zenli detaylar korunur."
  },
  {
    id: "occ_sport_functional",
    category: "occasion",
    priority: 3,
    events: ["Spor"],
    title: "Spor i\u015Flevselli\u011Fi",
    text: "Sporda hareketi k\u0131s\u0131tlamayan, esneyen ve ter atan par\xE7alar se\xE7; \u015F\u0131kl\u0131k yerine konfor ve g\xFCvenlik \xF6ncelikli."
  },
  {
    id: "occ_sport_shoes",
    category: "occasion",
    priority: 3,
    events: ["Spor"],
    title: "Do\u011Fru spor ayakkab\u0131s\u0131",
    text: "Ko\u015Fu, y\xFCr\xFCy\xFC\u015F veya salon i\xE7in uygun tabanl\u0131 spor ayakkab\u0131s\u0131 giy; moda sneaker ve d\xFCz tabanl\u0131 ayakkab\u0131lar sakatl\u0131k riskini art\u0131r\u0131r."
  },
  {
    id: "occ_sport_cold",
    category: "occasion",
    priority: 2,
    events: ["Spor"],
    tempBands: ["cool", "cold", "freezing"],
    title: "So\u011Fukta spor",
    text: "So\u011Fukta d\u0131\u015Far\u0131da spor yaparken ter atan bir i\xE7 kat, ince bir ara kat ve r\xFCzgar ge\xE7irmeyen bir d\u0131\u015F kat kullan; \u0131s\u0131nd\u0131k\xE7a katman \xE7\u0131kar."
  },
  {
    id: "occ_travel_comfort",
    category: "occasion",
    priority: 3,
    events: ["Seyahat"],
    title: "Seyahatte konfor",
    text: "Yolculukta rahat bel, esnek kuma\u015F ve kolay \xE7\u0131kar\u0131lan katmanlar se\xE7; u\xE7ak ve otob\xFCs i\xE7i s\u0131cakl\u0131\u011F\u0131 de\u011Fi\u015Fkendir."
  },
  {
    id: "occ_travel_capsule",
    category: "occasion",
    priority: 2,
    events: ["Seyahat"],
    title: "Seyahat kaps\xFCl\xFC",
    text: "Seyahat i\xE7in birbirleriyle kombinlenebilen n\xF6tr bir renk paletinde az say\u0131da par\xE7a se\xE7; her \xFCst her altla e\u015Fle\u015Febilsin."
  },
  {
    id: "occ_travel_shoes",
    category: "occasion",
    priority: 2,
    events: ["Seyahat"],
    title: "Seyahat ayakkab\u0131s\u0131",
    text: "\xC7ok y\xFCr\xFCnecek seyahatlerde \xF6nceden al\u0131\u015F\u0131lm\u0131\u015F, rahat tabanl\u0131 ayakkab\u0131 se\xE7; g\xFCvenlik kontrol\xFCnde kolay \xE7\u0131kar\u0131labilmesi de avantajd\u0131r."
  },
  {
    id: "occ_school_day",
    category: "occasion",
    priority: 2,
    events: ["Okul"],
    title: "Uzun okul g\xFCn\xFC",
    text: "Okulda uzun g\xFCn boyunca rahat edece\u011Fin, s\u0131n\u0131f ile d\u0131\u015Far\u0131 aras\u0131nda katman de\u011Fi\u015Ftirebilece\u011Fin par\xE7alar se\xE7."
  },
  {
    id: "occ_school_bag",
    category: "occasion",
    priority: 1,
    events: ["Okul"],
    title: "\xC7antayla uyum",
    text: "S\u0131rt \xE7antas\u0131 omuzdaki par\xE7alar\u0131 ezer; ince ve kaygan kuma\u015Flar yerine dayan\u0131kl\u0131 \xFCstler ve sade bir renk paleti kullan."
  },
  // ─── AYAKKABI ────────────────────────────────────────────────────────────
  {
    id: "shoes_define_formality",
    category: "shoes",
    general: true,
    priority: 3,
    title: "Ayakkab\u0131 resmiyeti belirler",
    text: "Ayn\u0131 kombin sneaker ile g\xFCndelik, loafer ile smart casual, oxford veya topukluyla resmi g\xF6r\xFCn\xFCr; ayakkab\u0131y\u0131 etkinli\u011Fin resmiyetine g\xF6re se\xE7."
  },
  {
    id: "shoes_leather_match",
    category: "shoes",
    priority: 2,
    formality: [3, 5],
    title: "Deri tonu uyumu",
    text: "\u015E\u0131k kombinlerde kemer ve ayakkab\u0131n\u0131n deri tonu ayn\u0131 ailede olsun (siyah\u2013siyah, kahve\u2013kahve)."
  },
  {
    id: "shoes_white_sneaker",
    category: "shoes",
    priority: 2,
    formality: [2, 3],
    title: "Beyaz sneaker k\xF6pr\xFCs\xFC",
    text: "Temiz, sade beyaz deri sneaker g\xFCndelik ile smart casual aras\u0131nda k\xF6pr\xFC kurar; blazer ve kuma\u015F pantolonla bile modern durur."
  },
  {
    id: "shoes_loafer",
    category: "shoes",
    priority: 2,
    events: ["Ofis", "Randevu"],
    title: "Loafer",
    text: "Loafer kuma\u015F pantolon, chino ve d\xFCz pa\xE7a jeanle uyumlu, \xE7ok y\xF6nl\xFC bir ayakkab\u0131d\u0131r; ofis ve ak\u015Fam yeme\u011Fi i\xE7in g\xFCvenli se\xE7imdir."
  },
  {
    id: "shoes_formal",
    category: "shoes",
    priority: 3,
    events: ["\u0130\u015F G\xF6r\xFC\u015Fmesi", "D\xFC\u011F\xFCn/Davet"],
    title: "Resmi ayakkab\u0131",
    text: "Resmi etkinliklerde oxford, derby, \u015F\u0131k loafer, stiletto veya zarif topuklu gibi kapal\u0131 ve bak\u0131ml\u0131 deri ayakkab\u0131lar se\xE7."
  },
  {
    id: "shoes_boots_trousers",
    category: "shoes",
    priority: 2,
    tempBands: ["cool", "cold", "freezing"],
    title: "Bot ve pa\xE7a",
    text: "Botla dar pa\xE7a pantolonu botun i\xE7ine veya hemen \xFCst\xFCne d\xFC\u015Fecek \u015Fekilde, geni\u015F pa\xE7ay\u0131 ise botun \xFCzerini \xF6rtecek \u015Fekilde kullan."
  },
  {
    id: "shoes_summer",
    category: "shoes",
    priority: 2,
    tempBands: ["warm", "hot"],
    formality: [1, 3],
    title: "Yaz ayakkab\u0131s\u0131",
    text: "S\u0131cak g\xFCnlerde sandalet, espadril veya file sneaker aya\u011F\u0131 rahatlat\u0131r; resmi ortamlarda a\xE7\u0131k ayakkab\u0131 yerine loafer tercih et."
  },
  {
    id: "shoes_neutral",
    category: "shoes",
    general: true,
    priority: 1,
    title: "N\xF6tr ayakkab\u0131",
    text: "Siyah, kahverengi, beyaz ve bej ayakkab\u0131lar neredeyse her kombinle \xE7al\u0131\u015F\u0131r; renkli ayakkab\u0131y\u0131 kombinin tek vurgusu olarak kullan."
  },
  // ─── AKSESUAR ────────────────────────────────────────────────────────────
  {
    id: "acc_single_focus",
    category: "accessory",
    general: true,
    priority: 2,
    title: "Tek odak aksesuar",
    text: "Aksesuarlarda tek bir odak se\xE7 (iddial\u0131 k\xFCpe, dikkat \xE7eken \xE7anta veya saat); hepsi birden \xF6ne \xE7\u0131k\u0131nca kombin kalabal\u0131kla\u015F\u0131r."
  },
  {
    id: "acc_office",
    category: "accessory",
    priority: 2,
    events: ["Ofis", "\u0130\u015F G\xF6r\xFC\u015Fmesi"],
    title: "\u0130\u015F aksesuar\u0131",
    text: "\u0130\u015F ortam\u0131nda sade bir saat, deri kemer ve yap\u0131land\u0131r\u0131lm\u0131\u015F bir \xE7anta profesyonel g\xF6r\xFCn\xFCm\xFC tamamlar."
  },
  {
    id: "acc_bag_scale",
    category: "accessory",
    general: true,
    priority: 1,
    title: "\xC7anta orant\u0131s\u0131",
    text: "G\xFCndelikte b\xFCy\xFCk ve yumu\u015Fak \xE7antalar, \u015F\u0131k etkinliklerde k\xFC\xE7\xFCk ve yap\u0131land\u0131r\u0131lm\u0131\u015F \xE7antalar daha uyumlu durur."
  },
  {
    id: "acc_evening_jewelry",
    category: "accessory",
    priority: 2,
    events: ["Parti", "D\xFC\u011F\xFCn/Davet"],
    title: "Gece tak\u0131lar\u0131",
    text: "Ak\u015Fam etkinliklerinde tak\u0131lar\u0131 biraz daha belirgin kullanabilirsin; k\u0131yafet parlaksa tak\u0131y\u0131 sade, k\u0131yafet sadeyse tak\u0131y\u0131 iddial\u0131 tut."
  },
  {
    id: "acc_sun",
    category: "accessory",
    priority: 2,
    tempBands: ["warm", "hot"],
    title: "G\xFCne\u015F aksesuar\u0131",
    text: "G\xFCne\u015Fli ve s\u0131cak havada \u015Fapka ve g\xFCne\u015F g\xF6zl\xFC\u011F\xFC hem koruma sa\u011Flar hem de kombini tamamlar."
  },
  {
    id: "acc_winter_link",
    category: "accessory",
    priority: 2,
    tempBands: ["cold", "freezing"],
    title: "Atk\u0131 ve bere",
    text: "Atk\u0131 ve bere k\u0131\u015F\u0131n kombinin renk ba\u011Flant\u0131s\u0131n\u0131 kurabilir: kabanla tonlu ya da ayakkab\u0131 veya \xE7antayla ayn\u0131 renkte se\xE7."
  },
  // ─── STİL ETİKETLERİ ─────────────────────────────────────────────────────
  {
    id: "style_minimalist",
    category: "style",
    priority: 3,
    styleTags: ["Minimalist"],
    title: "Minimalist",
    text: "Az par\xE7a, temiz \xE7izgi, n\xF6tr palet ve iyi kuma\u015F. Logosuz, desensiz par\xE7alar ve tek bir yap\u0131land\u0131r\u0131lm\u0131\u015F siluet minimalist g\xF6r\xFCn\xFCm\xFC ta\u015F\u0131r."
  },
  {
    id: "style_maximalist",
    category: "style",
    priority: 3,
    styleTags: ["Maximalist"],
    title: "Maximalist",
    text: "Renk, desen ve dokuyu cesurca birle\u015Ftir ama ortak bir renk veya tema \xFCzerinden ba\u011Fla ki kombin kaotik de\u011Fil bilin\xE7li dursun."
  },
  {
    id: "style_classic",
    category: "style",
    priority: 3,
    styleTags: ["Klasik"],
    title: "Klasik",
    text: "Blazer, d\xFCz g\xF6mlek, kuma\u015F pantolon, tren\xE7kot ve loafer gibi zamans\u0131z par\xE7alar; lacivert, bej, beyaz ve kahverengi paleti."
  },
  {
    id: "style_vintage",
    category: "style",
    priority: 3,
    styleTags: ["Vintage"],
    title: "Vintage",
    text: "Bir veya iki d\xF6nem par\xE7as\u0131n\u0131 (y\xFCksek bel kot, kareli blazer, kolej h\u0131rka) modern ve sade par\xE7alarla dengele; ba\u015Ftan a\u015Fa\u011F\u0131 kost\xFCm gibi g\xF6r\xFCnmesin."
  },
  {
    id: "style_streetwear",
    category: "style",
    priority: 3,
    styleTags: ["Streetwear"],
    title: "Streetwear",
    text: "Oversize \xFCstler, cargo veya geni\u015F pa\xE7a pantolon, iddial\u0131 sneaker ve katmanl\u0131 par\xE7alar; grafik veya logolu tek bir odak par\xE7a."
  },
  {
    id: "style_preppy",
    category: "style",
    priority: 3,
    styleTags: ["Preppy"],
    title: "Preppy",
    text: "Oxford g\xF6mlek, v yaka triko veya h\u0131rka, chino ve loafer; lacivert, bordo, ye\u015Fil ve kareli detaylarla d\xFCzenli bir kolej havas\u0131."
  },
  {
    id: "style_boho",
    category: "style",
    priority: 3,
    styleTags: ["Boho"],
    title: "Boho",
    text: "Ak\u0131\u015Fkan kuma\u015Flar, etnik ve \xE7i\xE7ekli desenler, toprak tonlar\u0131, s\xFCet ve has\u0131r dokular; katmanl\u0131 tak\u0131lar ve rahat sil\xFCetler."
  },
  {
    id: "style_dark_academia",
    category: "style",
    priority: 3,
    styleTags: ["Dark Academia"],
    title: "Dark Academia",
    text: "T\xFCvit ve y\xFCn, kareli ve bal\u0131k\xE7\u0131ks\u0131rt\u0131 desenler, koyu kahve, haki, bordo ve lacivert; oxford ayakkab\u0131 ve katmanl\u0131 triko-g\xF6mlek."
  },
  {
    id: "style_y2k",
    category: "style",
    priority: 3,
    styleTags: ["Y2K"],
    title: "Y2K",
    text: "D\xFC\u015F\xFCk bel ve bol pa\xE7a, crop \xFCstler, parlak renkler ve oyuncu aksesuarlar; bir iki Y2K detay\u0131n\u0131 sade par\xE7alarla dengelemek daha g\xFCncel durur."
  },
  {
    id: "style_sporty",
    category: "style",
    priority: 3,
    styleTags: ["Sporty"],
    title: "Sporty",
    text: "E\u015Fofman, sweatshirt, teknik ceket ve sneaker; spor par\xE7alar\u0131 temiz bir palet ve bir \u015F\u0131k par\xE7ayla (\xF6r. y\xFCn kaban) \u015Fehir kombinine \xE7evirebilirsin."
  },
  {
    id: "style_business_casual",
    category: "style",
    priority: 3,
    styleTags: ["Business Casual"],
    title: "Business Casual",
    text: "Kravats\u0131z, tak\u0131m olmayan ama \xF6zenli: chino veya kuma\u015F pantolon, g\xF6mlek veya triko, blazer ve loafer/deri sneaker."
  },
  {
    id: "style_romantic",
    category: "style",
    priority: 3,
    styleTags: ["Romantic"],
    title: "Romantic",
    text: "Yumu\u015Fak kuma\u015Flar, f\u0131rf\u0131r ve dantel detaylar, pastel ve pudra tonlar; ak\u0131\u015Fkan sil\xFCetleri belde tan\u0131mlayarak zarif bir g\xF6r\xFCn\xFCm yakala."
  },
  // ─── RUH HALİ ────────────────────────────────────────────────────────────
  {
    id: "mood_energetic",
    category: "mood",
    priority: 2,
    moods: ["Enerjik"],
    title: "Enerjik",
    text: "Enerjik bir ruh hali i\xE7in canl\u0131 bir vurgu rengi veya hareketli bir par\xE7a (renkli sneaker, desenli g\xF6mlek) ve rahat bir sil\xFCet se\xE7."
  },
  {
    id: "mood_minimal",
    category: "mood",
    priority: 2,
    moods: ["Minimalist"],
    title: "Sade ruh hali",
    text: "Sade bir g\xFCn i\xE7in n\xF6tr tonlar, az par\xE7a ve d\xFCz kuma\u015Flar; tek bir kaliteli detay yeterli."
  },
  {
    id: "mood_romantic",
    category: "mood",
    priority: 2,
    moods: ["Romantik"],
    title: "Romantik",
    text: "Romantik bir his i\xE7in yumu\u015Fak dokular, ak\u0131\u015Fkan kuma\u015Flar ve pastel veya derin \u015Farap tonlar\u0131 kullan."
  },
  {
    id: "mood_serious",
    category: "mood",
    priority: 2,
    moods: ["Ciddi"],
    title: "Ciddi",
    text: "Ciddi ve g\xFCven veren bir g\xF6r\xFCn\xFCm i\xE7in yap\u0131land\u0131r\u0131lm\u0131\u015F par\xE7alar, koyu n\xF6trler ve temiz, keskin \xE7izgiler se\xE7."
  },
  {
    id: "mood_relaxed",
    category: "mood",
    priority: 2,
    moods: ["Rahat"],
    title: "Rahat",
    text: "Rahat bir g\xFCn i\xE7in yumu\u015Fak kuma\u015Flar ve hareket alan\u0131 b\u0131rakan kesimler se\xE7; \xF6zenli g\xF6r\xFCnmek i\xE7in tek bir derli toplu par\xE7a (d\xFCzg\xFCn bir ceket veya temiz sneaker) yeterli."
  },
  // ─── TEK PARÇA ───────────────────────────────────────────────────────────
  {
    id: "onepiece_layer",
    category: "onepiece",
    priority: 3,
    requiresOnepiece: true,
    title: "Elbise ve katman",
    text: "Elbise veya tulumun \xFCzerine blazer, kot ceket veya h\u0131rka eklemek kombinin resmiyetini ve s\u0131cakl\u0131\u011F\u0131n\u0131 ayarlaman\u0131n en kolay yoludur."
  },
  {
    id: "onepiece_winter",
    category: "onepiece",
    priority: 3,
    requiresOnepiece: true,
    tempBands: ["cool", "cold", "freezing"],
    title: "So\u011Fukta elbise",
    text: "So\u011Fukta elbiseyi kal\u0131n \xE7orap, bot ve elbiseden uzun ya da ona yak\u0131n boyda bir kabanla giy."
  },
  {
    id: "onepiece_jumpsuit",
    category: "onepiece",
    priority: 2,
    requiresOnepiece: true,
    title: "Tulum",
    text: "Tulumu kemerle bele oturt; pa\xE7a boyuna g\xF6re sneaker, sandalet veya hafif topuklu ayakkab\u0131 se\xE7."
  },
  {
    id: "onepiece_dress_shoes",
    category: "onepiece",
    priority: 2,
    requiresOnepiece: true,
    events: ["Ofis", "Randevu", "Parti", "G\xFCndelik"],
    title: "Elbisenin resmiyeti",
    text: "Ayn\u0131 elbise sneaker ve kot ceketle g\xFCndelik, loafer ve blazerla ofis, topuklu ve saten detaylarla ak\u015Fam kombinine d\xF6n\xFC\u015F\xFCr."
  }
];

// backend/knowledge/examples.ts
var EXAMPLE_OUTFITS = [
  {
    id: "ex_office_cool",
    events: ["Ofis"],
    tempBands: ["cool", "mild"],
    formality: [3, 4],
    styleTags: ["Business Casual", "Klasik"],
    outfit: "Lacivert blazer + beyaz g\xF6mlek + gri kuma\u015F pantolon + kahverengi deri loafer + kahverengi kemer",
    why: "Lacivert-gri-beyaz sakin bir i\u015F paleti; kahverengi deri ayakkab\u0131 ve kemer s\u0131cakl\u0131k kat\u0131yor ve birbirini tekrar ediyor."
  },
  {
    id: "ex_office_warm",
    events: ["Ofis"],
    tempBands: ["warm", "hot"],
    formality: [3, 3],
    styleTags: ["Business Casual"],
    outfit: "A\xE7\u0131k mavi pamuklu g\xF6mlek (kollar\u0131 k\u0131vr\u0131lm\u0131\u015F) + bej keten kar\u0131\u015F\u0131m pantolon + beyaz deri sneaker veya a\xE7\u0131k kahve loafer",
    why: "Nefes alan kuma\u015Flar ve a\xE7\u0131k renkler s\u0131cakta rahat; d\xFCzg\xFCn kesim ofis ciddiyetini koruyor."
  },
  {
    id: "ex_office_freezing",
    events: ["Ofis"],
    tempBands: ["cold", "freezing"],
    formality: [3, 4],
    styleTags: ["Klasik"],
    outfit: "Antrasit y\xFCn kuma\u015F pantolon + krem bal\u0131k\xE7\u0131 yaka triko + kahverengi blazer + deve t\xFCy\xFC y\xFCn kaban + koyu kahve deri bot",
    why: "\u0130\xE7eride blazer ve triko \u015F\u0131k kal\u0131rken d\u0131\u015Far\u0131da y\xFCn kaban ve bot s\u0131cak tutuyor; kahve ve krem tonlar\u0131 uyumlu."
  },
  {
    id: "ex_interview_cold",
    events: ["\u0130\u015F G\xF6r\xFC\u015Fmesi"],
    tempBands: ["cool", "cold", "freezing"],
    formality: [4, 5],
    styleTags: ["Klasik"],
    outfit: "Koyu gri blazer + krem ince triko veya beyaz g\xF6mlek + koyu gri kuma\u015F pantolon + siyah derby/topuklu + uzun lacivert kaban",
    why: "Sade ve yap\u0131land\u0131r\u0131lm\u0131\u015F siluet g\xFCven veriyor; dikkat da\u011F\u0131tmayan renkler; kaban i\xE7eride \xE7\u0131kar\u0131ld\u0131\u011F\u0131nda kombin yine tam."
  },
  {
    id: "ex_interview_mild",
    events: ["\u0130\u015F G\xF6r\xFC\u015Fmesi"],
    tempBands: ["mild", "warm"],
    formality: [4, 4],
    styleTags: ["Minimalist"],
    outfit: "Bej blazer + beyaz bluz veya g\xF6mlek + siyah kuma\u015F pantolon + siyah deri loafer",
    why: "Bir t\u0131k \u015F\u0131k ama bo\u011Fucu de\u011Fil; bej-siyah-beyaz kontrast\u0131 temiz ve profesyonel."
  },
  {
    id: "ex_casual_mild",
    events: ["G\xFCndelik", "Okul"],
    tempBands: ["mild", "warm"],
    formality: [2, 2],
    styleTags: ["Minimalist"],
    outfit: "Beyaz basic ti\u015F\xF6rt + koyu mavi d\xFCz pa\xE7a jean + beyaz sneaker (+ serinse kot veya ince deri ceket)",
    why: "Zamans\u0131z g\xFCndelik form\xFCl; tek renk \xFCst ve koyu jean temiz bir kontrast kuruyor."
  },
  {
    id: "ex_casual_hot",
    events: ["G\xFCndelik", "Seyahat"],
    tempBands: ["hot"],
    formality: [1, 2],
    outfit: "Bol kesim beyaz keten g\xF6mlek + bej keten \u015Fort veya pantolon + espadril + g\xFCne\u015F g\xF6zl\xFC\u011F\xFC",
    why: "Tek kat, nefes alan kuma\u015F ve a\xE7\u0131k renkler \xE7ok s\u0131cakta serin tutuyor."
  },
  {
    id: "ex_casual_cold",
    events: ["G\xFCndelik", "Okul"],
    tempBands: ["cold"],
    formality: [2, 2],
    outfit: "Gri \xF6rg\xFC kazak + koyu jean + kahverengi chelsea bot + haki parka",
    why: "Katmanl\u0131 ve s\u0131cak; gri-haki-kahve toprak tonlar\u0131 do\u011Fal bir uyum kuruyor."
  },
  {
    id: "ex_casual_rain",
    events: ["G\xFCndelik", "Ofis"],
    tempBands: ["cool", "cold"],
    precipitation: ["rain"],
    formality: [2, 3],
    outfit: "Bej tren\xE7kot + lacivert triko + koyu jean veya chino + suya dayan\u0131kl\u0131 deri bot",
    why: "Tren\xE7kot ya\u011Fmuru kar\u015F\u0131larken kombini \u015F\u0131k tutuyor; koyu alt ve deri bot \u0131slakl\u0131ktan etkilenmiyor."
  },
  {
    id: "ex_casual_snow",
    events: ["G\xFCndelik"],
    tempBands: ["freezing"],
    precipitation: ["snow"],
    formality: [1, 2],
    outfit: "Termal i\xE7lik + kal\u0131n bal\u0131k\xE7\u0131 kazak + kal\u0131n kuma\u015F pantolon + \u015Fi\u015Fme mont + kaymaz tabanl\u0131 su ge\xE7irmez bot + atk\u0131 ve bere",
    why: "Katman katman s\u0131cak tutuyor; bot karda kaymay\u0131 ve \u0131slanmay\u0131 \xF6nl\xFCyor."
  },
  {
    id: "ex_date_cool",
    events: ["Randevu"],
    tempBands: ["cool", "cold"],
    formality: [3, 3],
    styleTags: ["Romantic", "Kontrast"],
    outfit: "Bordo saten bluz veya ince bordo triko + siyah dar pantolon + siyah deri ceket + siyah bilek bot",
    why: "Siyah zemin \xFCzerinde tek derin renk vurgusu; saten/triko dokusu \xF6zenli ama abart\u0131s\u0131z."
  },
  {
    id: "ex_date_warm",
    events: ["Randevu"],
    tempBands: ["mild", "warm"],
    formality: [2, 3],
    styleTags: ["Pastel", "Romantic"],
    outfit: "Pastel midi elbise + ince krem h\u0131rka + bej babet veya sandalet",
    why: "Ak\u0131\u015Fkan elbise ve pastel ton romantik; h\u0131rka ak\u015Fam serinli\u011Fine kar\u015F\u0131."
  },
  {
    id: "ex_date_minimal",
    events: ["Randevu", "G\xFCndelik"],
    tempBands: ["mild", "cool"],
    formality: [2, 3],
    styleTags: ["Monokromatik", "Minimalist"],
    outfit: "Bej triko + bej geni\u015F pa\xE7a pantolon + kahverengi loafer",
    why: "Ton-s\xFCr-ton bej kombin boyu uzun g\xF6steriyor; kahverengi ayakkab\u0131 derinlik kat\u0131yor."
  },
  {
    id: "ex_party_night",
    events: ["Parti"],
    tempBands: ["mild", "cool", "warm"],
    formality: [3, 4],
    outfit: "Siyah pantolon veya siyah midi etek + parlak saten \xFCst + ince metalik tak\u0131 + blok topuk veya \u015F\u0131k deri bot",
    why: "Koyu zemin \xFCzerinde tek parlak par\xE7a; blok topuk uzun gece i\xE7in rahat."
  },
  {
    id: "ex_party_maximalist",
    events: ["Parti"],
    tempBands: ["mild", "warm"],
    formality: [2, 3],
    styleTags: ["Maximalist"],
    outfit: "Desenli g\xF6mlek + d\xFCz siyah pantolon + g\xF6mlekteki renklerden birinde ayakkab\u0131",
    why: "Tek desen odak; ayakkab\u0131 desendeki rengi tekrar ederek b\xFCt\xFCnl\xFCk sa\u011Fl\u0131yor."
  },
  {
    id: "ex_wedding_day",
    events: ["D\xFC\u011F\xFCn/Davet"],
    tempBands: ["mild", "warm", "hot"],
    formality: [4, 5],
    outfit: "Pastel veya a\xE7\u0131k renk midi elbise ya da a\xE7\u0131k gri tak\u0131m + zarif sandalet veya deri loafer + k\xFC\xE7\xFCk \xE7anta",
    why: "G\xFCnd\xFCz davetine uygun a\xE7\u0131k tonlar; beyazdan ka\xE7\u0131n\u0131lm\u0131\u015F; \u015F\u0131k ama havaya uygun."
  },
  {
    id: "ex_wedding_evening",
    events: ["D\xFC\u011F\xFCn/Davet"],
    tempBands: ["cool", "cold", "freezing"],
    formality: [5, 5],
    outfit: "Koyu lacivert tak\u0131m elbise veya z\xFCmr\xFCt uzun elbise + oxford veya topuklu + y\xFCn kaban",
    why: "Ak\u015Fam davetine uygun derin tonlar ve resmi ayakkab\u0131; kaban d\u0131\u015Far\u0131daki so\u011Fuk i\xE7in."
  },
  {
    id: "ex_sport_cool",
    events: ["Spor"],
    tempBands: ["cool", "cold"],
    formality: [1, 1],
    styleTags: ["Sporty"],
    outfit: "Ter atan uzun kollu teknik \xFCst + tayt veya e\u015Fofman alt\u0131 + r\xFCzgarl\u0131k + ko\u015Fu ayakkab\u0131s\u0131",
    why: "Katmanlar \u0131s\u0131nd\u0131k\xE7a \xE7\u0131kar\u0131labiliyor; teknik kuma\u015F teri tutmuyor."
  },
  {
    id: "ex_sport_hot",
    events: ["Spor"],
    tempBands: ["warm", "hot"],
    formality: [1, 1],
    styleTags: ["Sporty"],
    outfit: "Nefes alan atlet veya ti\u015F\xF6rt + spor \u015Fort + ko\u015Fu ayakkab\u0131s\u0131 + \u015Fapka",
    why: "Tek kat ve hafif; \u015Fapka g\xFCne\u015Ften koruyor."
  },
  {
    id: "ex_travel",
    events: ["Seyahat"],
    tempBands: ["mild", "cool"],
    formality: [1, 2],
    styleTags: ["Minimalist"],
    outfit: "Siyah rahat jogger veya esnek pantolon + beyaz ti\u015F\xF6rt + gri h\u0131rka + rahat sneaker",
    why: "Uzun yolculukta rahat ve buru\u015Fmayan par\xE7alar; n\xF6tr renkler var\u0131\u015F yerinde ba\u015Fka par\xE7alarla da e\u015Fle\u015Fiyor."
  },
  {
    id: "ex_school_street",
    events: ["Okul", "G\xFCndelik"],
    tempBands: ["cool", "mild"],
    formality: [1, 2],
    styleTags: ["Streetwear", "Oversize"],
    outfit: "Oversize grafik sweatshirt + dar veya d\xFCz pa\xE7a jean + kal\u0131n tabanl\u0131 sneaker + bomber ceket",
    why: "Oversize \xFCst dar altla dengeleniyor; tek grafik odak, gerisi sade."
  }
];

// backend/knowledge/retrieval.ts
var RULE_QUOTAS = {
  occasion: 2,
  weather: 2,
  color: 2,
  proportion: 1,
  pattern: 1,
  fabric: 1,
  style: 1,
  mood: 1,
  shoes: 1,
  accessory: 1,
  onepiece: 1
};
var MAX_RULES = 9;
var TEXT_TUNABLE = /* @__PURE__ */ new Set(["color", "pattern", "fabric", "proportion", "style", "mood", "accessory", "shoes"]);
function styleTagsFromText(text2) {
  const normalized = ` ${normalizeTr(text2).replace(/[^\p{L}\p{N}&\s-]/gu, " ")} `;
  if (!normalized.trim()) return [];
  return STYLE_TAGS.filter((tag) => normalized.includes(` ${normalizeTr(tag)} `));
}
function ruleMatchScore(rule, input, textTags = []) {
  const { ctx } = input;
  let score = rule.priority ?? 2;
  let constrained = false;
  if (rule.events) {
    constrained = true;
    if (ctx.event === "\xD6zel" || !rule.events.includes(ctx.event)) return null;
    score += 4;
  }
  if (rule.tempBands) {
    constrained = true;
    if (!ctx.tempBand || !rule.tempBands.includes(ctx.tempBand)) return null;
    score += 3;
  }
  if (rule.precipitation) {
    constrained = true;
    if (ctx.precipitation === "none" || !rule.precipitation.includes(ctx.precipitation)) return null;
    score += 3;
  }
  if (rule.seasons) {
    constrained = true;
    if (!rule.seasons.includes(ctx.season)) return null;
    score += 1;
  }
  if (rule.formality) {
    constrained = true;
    const [min, max] = rule.formality;
    if (ctx.formality.target < min - 0.5 || ctx.formality.target > max + 0.5) return null;
    score += 1;
  }
  if (rule.styleTags) {
    constrained = true;
    const explicit = rule.styleTags.some((t) => ctx.styleTags.includes(t));
    const fromText = TEXT_TUNABLE.has(rule.category) && rule.styleTags.some((t) => textTags.includes(t));
    if (!explicit && !fromText) return null;
    score += explicit ? 3 : 2;
  }
  if (rule.moods) {
    constrained = true;
    if (!ctx.mood || !rule.moods.includes(ctx.mood)) return null;
    score += 2;
  }
  if (rule.requiresOnepiece) {
    constrained = true;
    if (!input.hasOnepiece) return null;
    score += 2;
  }
  if (!constrained && !rule.general) return null;
  if (TEXT_TUNABLE.has(rule.category) && input.queryEmbedding && input.ruleEmbeddings) {
    const sim = cosine(input.queryEmbedding, input.ruleEmbeddings.get(rule.id));
    if (sim !== null) score += 4 * Math.max(0, (sim - 0.5) / 0.5);
  }
  return score;
}
function retrieveRules(input) {
  const rules = input.rules || KNOWLEDGE_RULES;
  const textTags = styleTagsFromText([input.ctx.personalContext, input.ctx.eventNotes].filter(Boolean).join(" "));
  const scored = rules.map((rule) => ({ rule, score: ruleMatchScore(rule, input, textTags) })).filter((r) => r.score !== null).sort((a, b) => b.score - a.score || a.rule.id.localeCompare(b.rule.id));
  const used = {};
  const picked = [];
  for (const { rule } of scored) {
    if (picked.length >= MAX_RULES) break;
    const count = used[rule.category] || 0;
    if (count >= RULE_QUOTAS[rule.category]) continue;
    used[rule.category] = count + 1;
    picked.push(rule);
  }
  return picked;
}
function retrieveExamples(ctx, limit = 2) {
  return EXAMPLE_OUTFITS.map((example) => {
    let score = 0;
    if (ctx.event !== "\xD6zel" && example.events.includes(ctx.event)) score += 3;
    if (ctx.tempBand && example.tempBands.includes(ctx.tempBand)) score += 2;
    if (example.precipitation && ctx.precipitation !== "none" && example.precipitation.includes(ctx.precipitation)) score += 2;
    const [min, max] = example.formality;
    if (ctx.formality.target >= min - 0.5 && ctx.formality.target <= max + 0.5) score += 1;
    if (example.styleTags?.some((t) => ctx.styleTags.includes(t))) score += 2;
    return { example, score };
  }).filter((e) => e.score >= 3).sort((a, b) => b.score - a.score || a.example.id.localeCompare(b.example.id)).slice(0, limit).map((e) => e.example);
}
function ruleEmbeddingText(rule) {
  return `${rule.title}: ${rule.text}`;
}

// backend/knowledge/embeddingStore.ts
async function getTextEmbedding(text2, label) {
  const trimmed = text2.trim().slice(0, 2e3);
  if (!trimmed) return null;
  const key = embeddingCacheKey(trimmed);
  const cached = await EmbeddingCacheModel.findOne({ key }).lean();
  if (cached?.vector?.length) return cached.vector;
  const vector = await embed({ text: trimmed }, label);
  if (vector) {
    await EmbeddingCacheModel.updateOne({ key }, { $set: { key, vector } }, { upsert: true }).catch(() => void 0);
  }
  return vector;
}
async function loadRuleEmbeddings(computeMissing = 2, rules = KNOWLEDGE_RULES) {
  const keys = rules.map((rule) => ({ rule, key: embeddingCacheKey(ruleEmbeddingText(rule)) }));
  const docs = await EmbeddingCacheModel.find({ key: { $in: keys.map((k) => k.key) } }).lean();
  const byKey = new Map(docs.map((d) => [d.key, d.vector]));
  const result = /* @__PURE__ */ new Map();
  let computed = 0;
  for (const { rule, key } of keys) {
    const vector = byKey.get(key);
    if (vector?.length) {
      result.set(rule.id, vector);
    } else if (computed < computeMissing) {
      computed++;
      const fresh = await getTextEmbedding(ruleEmbeddingText(rule), "knowledge_rule");
      if (fresh) result.set(rule.id, fresh);
    }
  }
  return result;
}

// backend/time.ts
var APP_TIME_ZONE = "Europe/Istanbul";
function localDate(date = /* @__PURE__ */ new Date(), timeZone = APP_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function localDateTime(date = /* @__PURE__ */ new Date(), timeZone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}
function daysBetween(a, b) {
  const toUtc = (s) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((toUtc(b) - toUtc(a)) / 864e5);
}
function isValidLocalDateTime(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}:00Z`));
}

// backend/preferences.ts
function hasConsent(user, key) {
  return user?.consents?.[key]?.granted === true;
}
var EMPTY_AFFINITIES = () => ({ item: {}, colorFamily: {}, style: {}, fit: {}, pattern: {} });
var HALF_LIFE_DAYS = 60;
function applyDecay(aff, days) {
  if (days <= 0) return aff;
  const factor = Math.pow(0.5, days / HALF_LIFE_DAYS);
  const decayMap = (map) => {
    const out = {};
    for (const [k, v] of Object.entries(map || {})) {
      const next = v * factor;
      if (Math.abs(next) >= 0.05) out[k] = next;
    }
    return out;
  };
  return {
    item: decayMap(aff.item),
    colorFamily: decayMap(aff.colorFamily),
    style: decayMap(aff.style),
    fit: decayMap(aff.fit),
    pattern: decayMap(aff.pattern)
  };
}
async function loadPreferenceData(user) {
  const style = user?.styleProfile || {};
  const personalColor = hasConsent(user, "personalColor") ? style.personalColor : null;
  let affinities = null;
  if (hasConsent(user, "personalization")) {
    const profile = await PreferenceProfileModel.findOne({ userId: user._id }).lean();
    if (profile?.affinities) {
      const days = profile.updatedAt ? (Date.now() - new Date(profile.updatedAt).getTime()) / 864e5 : 0;
      affinities = applyDecay({ ...EMPTY_AFFINITIES(), ...profile.affinities }, days);
    }
  }
  return {
    affinities,
    preferredFits: style.preferredFits || [],
    avoidFits: style.avoidFits || [],
    dislikedColorFamilies: style.dislikedColorFamilies || [],
    bestColorFamilies: personalColor?.bestColorFamilies || [],
    avoidColorFamilies: personalColor?.avoidColorFamilies || []
  };
}
async function preferenceSummary(user) {
  if (!hasConsent(user, "personalization")) return null;
  const profile = await PreferenceProfileModel.findOne({ userId: user._id }).select("summary").lean();
  return profile?.summary || null;
}
async function logShownOutfits(user, generationId, outfits, context) {
  if (!hasConsent(user, "personalization") || outfits.length === 0) return;
  await FeedbackEventModel.insertMany(outfits.map((itemIds) => ({
    userId: user._id,
    type: "shown",
    generationId,
    itemIds,
    context,
    createdAt: /* @__PURE__ */ new Date()
  })));
}
async function recentShownOutfits(user, hours = 72, limit = 20) {
  if (!hasConsent(user, "personalization")) return [];
  const since = new Date(Date.now() - hours * 36e5);
  const events = await FeedbackEventModel.find({ userId: user._id, type: { $in: ["shown", "worn"] }, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(limit).select("itemIds").lean();
  return events.map((e) => e.itemIds || []);
}
async function recentlyWornMap(userId, days = 3) {
  const today = localDate();
  const logs = await WearLogModel.find({ userId }).sort({ date: -1 }).limit(20).select("date itemIds").lean();
  const map = /* @__PURE__ */ new Map();
  for (const log of logs) {
    const ago = daysBetween(log.date, today);
    if (ago < 0 || ago > days) continue;
    for (const id of log.itemIds || []) {
      if (!map.has(id) || map.get(id) > ago) map.set(id, ago);
    }
  }
  return map;
}

// backend/engine/items.ts
var STYLE_FORMALITY = {
  formal: 5,
  elegant: 4,
  classic: 4,
  "smart-casual": 3,
  casual: 2,
  bohemian: 2,
  streetwear: 2,
  sport: 1
};
var includesAny = (text2, words) => words.some((w) => text2.includes(w));
var ONEPIECE_WORDS = ["elbise", "tulum", "abiye", "jumpsuit", "dress", "salopet"];
function inferCategory(category, subCategory) {
  const sub = normalizeTr(subCategory);
  if ((category === "top" || category === "bottom") && includesAny(sub, ONEPIECE_WORDS)) return "onepiece";
  if (CATEGORIES.includes(category)) return category;
  if (includesAny(sub, ONEPIECE_WORDS)) return "onepiece";
  if (includesAny(sub, ["mont", "kaban", "parka", "tren\xE7kot", "palto", "ya\u011Fmurluk"])) return "outerwear";
  if (includesAny(sub, ["ayakkab\u0131", "sneaker", "bot", "\xE7izme", "loafer", "sandalet", "topuklu", "terlik"])) return "shoes";
  if (includesAny(sub, ["pantolon", "etek", "\u015Fort", "jean", "tayt"])) return "bottom";
  return "top";
}
function inferFormality(style, category, subCategory) {
  const sub = normalizeTr(subCategory);
  if (category === "shoes") {
    if (includesAny(sub, ["stiletto", "topuklu", "oxford", "derby", "rugan"])) return 5;
    if (includesAny(sub, ["loafer", "makosen", "babet", "chelsea"])) return 4;
    if (includesAny(sub, ["terlik", "parmak aras\u0131"])) return 1;
    if (includesAny(sub, ["ko\u015Fu", "spor ayakkab\u0131", "krampon"])) return 1;
    if (includesAny(sub, ["sneaker", "sandalet", "espadril"])) return 2;
  }
  if (includesAny(sub, ["tak\u0131m elbise", "smokin", "abiye"])) return 5;
  if (includesAny(sub, ["blazer", "g\xF6mlek", "kuma\u015F pantolon", "pantolon kuma\u015F", "kalem etek"])) return 4;
  if (includesAny(sub, ["e\u015Fofman", "tayt", "\u015Fort", "atlet", "sweatshirt", "hoodie"])) return Math.min(2, STYLE_FORMALITY[style] ?? 2);
  return STYLE_FORMALITY[style] ?? 2;
}
function inferWarmth(category, subCategory, material, weatherMatch) {
  const text2 = `${normalizeTr(subCategory)} ${normalizeTr(material)}`;
  if (category === "outerwear") {
    if (includesAny(text2, ["\u015Fi\u015Fme", "kaz t\xFCy\xFC", "parka", "k\xFCrk", "kaban", "palto"])) return 5;
    if (includesAny(text2, ["mont", "y\xFCn", "ka\u015Fe"])) return 4;
    if (includesAny(text2, ["tren\xE7kot", "deri", "blazer", "ceket", "ya\u011Fmurluk"])) return 3;
    return 3;
  }
  if (category === "shoes") {
    if (includesAny(text2, ["\xE7izme", "kar botu", "k\xFCrkl\xFC"])) return 5;
    if (includesAny(text2, ["bot", "chelsea"])) return 4;
    if (includesAny(text2, ["sandalet", "terlik", "espadril", "parmak aras\u0131"])) return 1;
    return 2;
  }
  if (includesAny(text2, ["ka\u015Fmir", "polar", "kal\u0131n \xF6rg\xFC", "bal\u0131k\xE7\u0131"])) return 4;
  if (includesAny(text2, ["kazak", "triko", "y\xFCn", "sweatshirt", "hoodie", "kadife"])) return 4;
  if (includesAny(text2, ["h\u0131rka", "g\xF6mlek", "uzun kollu", "jean", "denim", "kuma\u015F pantolon"])) return 3;
  if (includesAny(text2, ["\u015Fort", "atlet", "ask\u0131l\u0131", "crop", "keten", "ipek", "\u015Fifon", "ti\u015F\xF6rt", "t-shirt", "bluz"])) return 2;
  const tags = new Set(weatherMatch || []);
  if (tags.has("snowy") || tags.has("cold")) return 4;
  if (tags.has("hot")) return 1;
  if (tags.has("sunny") && !tags.has("rainy")) return 2;
  return 3;
}
function inferWaterResistant(category, subCategory, material, weatherMatch) {
  if (category !== "outerwear" && category !== "shoes") return false;
  const text2 = `${normalizeTr(subCategory)} ${normalizeTr(material)}`;
  if (includesAny(text2, ["su ge\xE7irmez", "ya\u011Fmurluk", "tren\xE7kot", "gore", "naylon", "deri", "bot", "parka", "\u015Fi\u015Fme"])) return true;
  return (weatherMatch || []).includes("rainy");
}
function inferLayerRole(category, subCategory) {
  if (category === "outerwear") return "outer";
  if (category === "top") {
    const sub = normalizeTr(subCategory);
    if (includesAny(sub, ["g\xF6mlek", "h\u0131rka", "yelek", "blazer", "ceket", "overshirt"])) return "mid";
    return "base";
  }
  if (category === "onepiece" || category === "bottom") return "base";
  return "none";
}
function seasonsFromWarmth(warmth) {
  if (warmth <= 1) return ["yaz"];
  if (warmth === 2) return ["ilkbahar", "yaz"];
  if (warmth === 3) return ["ilkbahar", "sonbahar"];
  if (warmth === 4) return ["sonbahar", "k\u0131\u015F"];
  return ["k\u0131\u015F"];
}
var clampScale = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(5, Math.max(1, Math.round(value)));
};
function toEngineItem(doc) {
  const inferred = [];
  const subCategory = doc.subCategory || "";
  const material = doc.material || "";
  const weatherMatch = Array.isArray(doc.weatherMatch) ? doc.weatherMatch : [];
  const category = inferCategory(doc.category, subCategory);
  if (category !== doc.category) inferred.push("category");
  const style = doc.style || "casual";
  let formality = clampScale(doc.formality);
  if (formality === null) {
    formality = inferFormality(style, category, subCategory);
    inferred.push("formality");
  }
  let warmth = clampScale(doc.warmth);
  if (warmth === null) {
    warmth = inferWarmth(category, subCategory, material, weatherMatch);
    inferred.push("warmth");
  }
  let waterResistant;
  if (typeof doc.waterResistant === "boolean") waterResistant = doc.waterResistant;
  else {
    waterResistant = inferWaterResistant(category, subCategory, material, weatherMatch);
    inferred.push("waterResistant");
  }
  let layerRole;
  if (LAYER_ROLES.includes(doc.layerRole)) layerRole = doc.layerRole;
  else {
    layerRole = inferLayerRole(category, subCategory);
    inferred.push("layerRole");
  }
  let colorFamily = COLOR_FAMILIES.includes(doc.colorFamily) ? doc.colorFamily : null;
  if (!colorFamily) {
    colorFamily = colorFamilyFromName(doc.color);
    if (colorFamily) inferred.push("colorFamily");
  }
  let seasons = Array.isArray(doc.seasons) ? doc.seasons.filter((s) => SEASONS.includes(s)) : [];
  if (seasons.length === 0) {
    seasons = seasonsFromWarmth(warmth);
    inferred.push("seasons");
  }
  const secondaryColors = Array.isArray(doc.secondaryColors) ? doc.secondaryColors.filter((c) => COLOR_FAMILIES.includes(c)) : [];
  return {
    id: doc.id,
    name: doc.name || subCategory || "Par\xE7a",
    category,
    subCategory,
    colorFamily,
    colorHex: isValidHex(doc.colorHex) ? doc.colorHex : null,
    secondaryColors,
    material: material || UNKNOWN,
    pattern: doc.pattern || UNKNOWN,
    fit: doc.fit || UNKNOWN,
    style,
    formality,
    warmth,
    waterResistant,
    layerRole,
    seasons,
    imagePath: doc.imagePath || "",
    cutoutImagePath: doc.cutoutImagePath || null,
    embedding: Array.isArray(doc.embedding) && doc.embedding.length > 0 ? doc.embedding : null,
    wearCount: typeof doc.wearCount === "number" ? doc.wearCount : 0,
    lastWornAt: doc.lastWornAt ? new Date(doc.lastWornAt) : null,
    price: typeof doc.price === "number" ? doc.price : null,
    inferred
  };
}
function toItemDTO(doc) {
  const plain = typeof doc?.toObject === "function" ? doc.toObject() : { ...doc };
  delete plain.embedding;
  delete plain.embeddingModel;
  delete plain.__v;
  return plain;
}

// backend/engine/context.ts
var EVENT_PRESETS = {
  "G\xFCndelik": { formality: [1, 3], activity: 2 },
  "Ofis": { formality: [3, 4], activity: 2 },
  "\u0130\u015F G\xF6r\xFC\u015Fmesi": { formality: [4, 5], activity: 1 },
  "Randevu": { formality: [2, 4], activity: 2 },
  "Parti": { formality: [2, 4], activity: 3 },
  "D\xFC\u011F\xFCn/Davet": { formality: [4, 5], activity: 2 },
  "Spor": { formality: [1, 1], activity: 5 },
  "Seyahat": { formality: [1, 3], activity: 3 },
  "Okul": { formality: [1, 3], activity: 2 }
};
var EVENT_ALIASES = [
  [["i\u015F g\xF6r\xFC\u015Fmesi", "m\xFClakat", "mulakat"], "\u0130\u015F G\xF6r\xFC\u015Fmesi"],
  [["d\xFC\u011F\xFCn", "davet", "ni\u015Fan", "k\u0131na", "gala"], "D\xFC\u011F\xFCn/Davet"],
  [["ofis", "toplant\u0131", "i\u015F yeri", "i\u015Fyeri", "business"], "Ofis"],
  [["randevu", "bulu\u015Fma", "date", "ak\u015Fam yeme\u011Fi"], "Randevu"],
  [["parti", "gece", "kul\xFCp", "konser", "do\u011Fum g\xFCn\xFC"], "Parti"],
  [["spor", "gym", "ko\u015Fu", "y\xFCr\xFCy\xFC\u015F", "antrenman", "fitness"], "Spor"],
  [["seyahat", "tatil", "u\xE7ak", "yolculuk", "gezi"], "Seyahat"],
  [["okul", "kamp\xFCs", "\xFCniversite", "ders"], "Okul"],
  [["g\xFCndelik", "g\xFCnl\xFCk", "casual"], "G\xFCndelik"]
];
function resolveEventKey(event) {
  const text2 = normalizeTr(event);
  if (!text2) return null;
  const direct = EVENTS.find((e) => normalizeTr(e) === text2);
  if (direct) return direct;
  for (const [aliases, key] of EVENT_ALIASES) {
    if (aliases.some((a) => text2.includes(a))) return key;
  }
  return null;
}
function tempBandFor(feelsLikeC) {
  if (feelsLikeC <= 3) return "freezing";
  if (feelsLikeC <= 10) return "cold";
  if (feelsLikeC <= 16) return "cool";
  if (feelsLikeC <= 22) return "mild";
  if (feelsLikeC <= 28) return "warm";
  return "hot";
}
var INSULATION = {
  hot: { min: 1, max: 2 },
  warm: { min: 2, max: 3 },
  mild: { min: 2, max: 5 },
  cool: { min: 4, max: 6 },
  cold: { min: 6, max: 8 },
  freezing: { min: 7, max: 10 }
};
var OUTERWEAR_NEED = {
  hot: "avoid",
  warm: "optional",
  mild: "optional",
  cool: "recommended",
  cold: "required",
  freezing: "required"
};
var MIN_OUTER_WARMTH = {
  hot: null,
  warm: null,
  mild: null,
  cool: 2,
  cold: 3,
  freezing: 4
};
var clamp = (v, min, max) => Math.min(max, Math.max(min, v));
var scale = (v, fallback) => typeof v === "number" && Number.isFinite(v) ? clamp(Math.round(v), 1, 5) : fallback;
function precipitationFor(weather) {
  if (SNOW_CODES.has(weather.weatherCode)) return "snow";
  if (RAIN_CODES.has(weather.weatherCode)) {
    return weather.temperatureC <= 1 ? "snow" : "rain";
  }
  if ((weather.precipitationProbability ?? 0) >= 60) return weather.temperatureC <= 1 ? "snow" : "rain";
  return "none";
}
function buildContext(input) {
  const eventKey = resolveEventKey(input.event);
  const preset = eventKey ? EVENT_PRESETS[eventKey] : EVENT_PRESETS["G\xFCndelik"];
  const override = input.eventOverride || null;
  let formalityMin = override?.formalityMin ? clamp(Math.round(override.formalityMin), 1, 5) : preset.formality[0];
  let formalityMax = override?.formalityMax ? clamp(Math.round(override.formalityMax), 1, 5) : preset.formality[1];
  if (formalityMin > formalityMax) [formalityMin, formalityMax] = [formalityMax, formalityMin];
  const legacyDressiness = typeof input.effort === "number" ? Math.ceil(clamp(input.effort, 1, 10) / 2) : 3;
  const dressiness = scale(input.dressiness, legacyDressiness);
  const target = Math.round((formalityMin + (formalityMax - formalityMin) * (dressiness - 1) / 4) * 10) / 10;
  const activity = scale(input.activity, override?.activity ? clamp(Math.round(override.activity), 1, 5) : preset.activity);
  const indoor = Boolean(override?.indoor);
  const ignoreWeather = Boolean(input.ignoreWeather);
  const weather = ignoreWeather ? null : input.weather;
  let tempBand = null;
  let precipitation = "none";
  let outerwear = "optional";
  let minOuterWarmth = null;
  let insulation = null;
  let needsWaterResistant = false;
  if (weather) {
    tempBand = tempBandFor(weather.feelsLikeC);
    precipitation = precipitationFor(weather);
    outerwear = OUTERWEAR_NEED[tempBand];
    minOuterWarmth = MIN_OUTER_WARMTH[tempBand];
    insulation = INSULATION[tempBand];
    needsWaterResistant = precipitation !== "none";
    if (precipitation !== "none" && outerwear === "optional") outerwear = "recommended";
    if (indoor && outerwear === "required") outerwear = "recommended";
  }
  const date = input.date || (weather?.time ? new Date(weather.time) : /* @__PURE__ */ new Date());
  return {
    event: eventKey || "\xD6zel",
    eventLabel: (input.event || "").trim() || "G\xFCndelik",
    formality: { min: formalityMin, max: formalityMax, target },
    dressiness,
    activity,
    mood: input.mood?.trim() || null,
    styleTags: (input.styleTags || []).filter((t) => typeof t === "string").slice(0, 10),
    personalContext: input.personalContext?.trim().slice(0, 1e3) || null,
    eventNotes: override?.notes?.trim().slice(0, 300) || null,
    indoor,
    weather,
    ignoreWeather,
    tempBand,
    precipitation,
    outerwear,
    minOuterWarmth,
    insulation,
    needsWaterResistant,
    season: seasonForDate(Number.isNaN(date.getTime()) ? /* @__PURE__ */ new Date() : date)
  };
}
function summarizeContext(ctx) {
  return {
    event: ctx.eventLabel,
    formalityMin: ctx.formality.min,
    formalityMax: ctx.formality.max,
    formalityTarget: ctx.formality.target,
    activity: ctx.activity,
    tempBand: ctx.tempBand,
    precipitation: ctx.precipitation,
    outerwear: ctx.outerwear,
    needsWaterResistant: ctx.needsWaterResistant,
    season: ctx.season
  };
}
var TEMP_BAND_LABELS = {
  freezing: "dondurucu so\u011Fuk",
  cold: "so\u011Fuk",
  cool: "serin",
  mild: "\u0131l\u0131k",
  warm: "s\u0131cak",
  hot: "\xE7ok s\u0131cak"
};

// backend/engine/candidates.ts
var DEFAULT_K = {
  top: 8,
  bottom: 8,
  onepiece: 6,
  outerwear: 6,
  shoes: 6,
  accessory: 4,
  makeup: 3
};
var clamp2 = (v) => Math.min(100, Math.max(0, v));
function itemFit(item, ctx, prefs, deps) {
  let score = 100;
  let excludedReason = null;
  const { min, max } = ctx.formality;
  if (item.category !== "makeup") {
    const distance = item.formality < min ? min - item.formality : item.formality > max ? item.formality - max : 0;
    score -= 20 * distance;
    if (distance >= 2) excludedReason = "resmiyet";
  }
  if (ctx.activity >= 4 && item.formality >= 4 && item.category !== "accessory") {
    score -= 30;
    excludedReason = excludedReason || "hareket";
  }
  const band = ctx.tempBand;
  if (band) {
    const coldBand = band === "cold" || band === "freezing";
    switch (item.category) {
      case "top":
      case "onepiece":
        if (band === "hot" && item.warmth >= 4) {
          score -= 35;
          excludedReason = excludedReason || "hava";
        }
        if (band === "warm" && item.warmth >= 4) score -= 20;
        if (band === "freezing" && item.warmth <= 1 && item.category === "onepiece") score -= 25;
        if (coldBand && item.warmth <= 1) score -= 10;
        break;
      case "bottom":
        if (band === "hot" && item.warmth >= 4) score -= 20;
        if (coldBand && item.warmth <= 1) {
          score -= 35;
          excludedReason = excludedReason || "hava";
        }
        break;
      case "outerwear":
        if (band === "hot" && item.warmth >= 3) {
          score -= 40;
          excludedReason = excludedReason || "hava";
        }
        if (band === "warm" && item.warmth >= 4) {
          score -= 30;
          excludedReason = excludedReason || "hava";
        }
        if (ctx.minOuterWarmth && item.warmth < ctx.minOuterWarmth) score -= 15 * (ctx.minOuterWarmth - item.warmth);
        if (ctx.needsWaterResistant && !item.waterResistant) score -= 12;
        break;
      case "accessory":
        if ((band === "warm" || band === "hot") && item.warmth >= 4) {
          score -= 40;
          excludedReason = excludedReason || "hava";
        }
        break;
      case "shoes":
        if (coldBand && item.warmth <= 1) {
          score -= 40;
          excludedReason = excludedReason || "hava";
        }
        if (band === "hot" && item.warmth >= 4) score -= 20;
        if (ctx.precipitation === "rain" && !item.waterResistant) score -= 10;
        if (ctx.precipitation === "snow" && (!item.waterResistant || item.warmth <= 2)) score -= 25;
        break;
    }
  }
  if (item.seasons.length && !item.seasons.includes(ctx.season) && item.category !== "accessory" && item.category !== "makeup") {
    score -= 8;
  }
  const aff = prefs?.affinities;
  if (aff) {
    const value = (aff.item[item.id] ?? 0) + 0.5 * (item.colorFamily ? aff.colorFamily[item.colorFamily] ?? 0 : 0) + 0.5 * (aff.style[item.style] ?? 0);
    score += 12 * Math.tanh(value / 4);
  }
  if (prefs?.dislikedColorFamilies.length && item.colorFamily && prefs.dislikedColorFamilies.includes(item.colorFamily)) {
    score -= 20;
  }
  const days = deps?.recentlyWorn?.get(item.id);
  if (days !== void 0 && days <= 2 && !deps?.protectedIds?.has(item.id)) score -= 15;
  return { item, score: clamp2(score), excludedReason };
}
var CATEGORY_NAMES = {
  top: "\xFCst giyim",
  bottom: "alt giyim",
  onepiece: "tek par\xE7a",
  outerwear: "d\u0131\u015F giyim",
  shoes: "ayakkab\u0131",
  accessory: "aksesuar",
  makeup: "makyaj"
};
function selectCandidates(items, ctx, options) {
  const warnings = [];
  const pool = { top: [], bottom: [], onepiece: [], outerwear: [], shoes: [], accessory: [], makeup: [] };
  const k = { ...DEFAULT_K, ...options.k || {} };
  const byCategory = /* @__PURE__ */ new Map();
  for (const item of items) {
    if (options.excluded.has(item.id) && !options.required.has(item.id)) continue;
    const scored = itemFit(item, ctx, options.prefs, options.deps);
    const list = byCategory.get(item.category) || [];
    list.push(scored);
    byCategory.set(item.category, list);
  }
  for (const [category, list] of byCategory) {
    const required = list.filter((s) => options.required.has(s.item.id));
    const allowed = list.filter((s) => !options.required.has(s.item.id) && !s.excludedReason);
    const blocked = list.filter((s) => !options.required.has(s.item.id) && s.excludedReason);
    let chosen = allowed.sort((a, b) => b.score - a.score).slice(0, k[category]);
    const structural = ["top", "bottom", "shoes", "onepiece"].includes(category) || category === "outerwear" && ctx.outerwear === "required";
    if (chosen.length === 0 && blocked.length > 0 && required.length === 0 && structural) {
      chosen = blocked.sort((a, b) => b.score - a.score).slice(0, k[category]);
      warnings.push(`Bu etkinlik ve havaya tam uyan ${CATEGORY_NAMES[category]} bulunamad\u0131; en yak\u0131n se\xE7enekler kullan\u0131ld\u0131.`);
    }
    for (const r of required) {
      if (r.excludedReason === "hava") warnings.push(`Zorunlu se\xE7ti\u011Fin "${r.item.name}" bu hava i\xE7in ideal de\u011Fil.`);
      if (r.excludedReason === "resmiyet") warnings.push(`Zorunlu se\xE7ti\u011Fin "${r.item.name}" etkinli\u011Fin resmiyetiyle tam uyu\u015Fmuyor.`);
    }
    pool[category] = [...required, ...chosen];
  }
  return { pool, warnings };
}

// backend/engine/builder.ts
import crypto2 from "crypto";

// backend/engine/scoring.ts
var WEIGHTS = {
  weather: 0.24,
  formality: 0.2,
  color: 0.2,
  style: 0.12,
  silhouette: 0.09,
  preference: 0.08,
  variety: 0.07,
  learned: 0.1
};
var MAIN_CATEGORIES = /* @__PURE__ */ new Set(["top", "bottom", "onepiece", "outerwear", "shoes"]);
var clamp3 = (v, min = 0, max = 100) => Math.min(max, Math.max(min, v));
var mean = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
function toSlots(items) {
  const slots = { accessories: [], makeup: [] };
  for (const item of items) {
    if (item.category === "top") slots.top = item;
    else if (item.category === "bottom") slots.bottom = item;
    else if (item.category === "onepiece") slots.onepiece = item;
    else if (item.category === "outerwear") slots.outer = item;
    else if (item.category === "shoes") slots.shoes = item;
    else if (item.category === "accessory") slots.accessories.push(item);
    else if (item.category === "makeup") slots.makeup.push(item);
  }
  return slots;
}
function weatherScore(items, ctx) {
  if (!ctx.weather || !ctx.tempBand || !ctx.insulation) return null;
  const s = toSlots(items);
  let score = 100;
  const upper = s.onepiece || s.top;
  const insulation = (upper?.warmth ?? 2) + (s.outer?.warmth ?? 0);
  if (insulation < ctx.insulation.min) score -= 16 * (ctx.insulation.min - insulation);
  else if (insulation > ctx.insulation.max) score -= 12 * (insulation - ctx.insulation.max);
  if (s.outer) {
    if (ctx.outerwear === "avoid") score -= 35;
    if (ctx.minOuterWarmth && s.outer.warmth < ctx.minOuterWarmth) score -= 15 * (ctx.minOuterWarmth - s.outer.warmth);
    if (ctx.needsWaterResistant && !s.outer.waterResistant) score -= 10;
  } else if (ctx.outerwear === "required") {
    score -= 35;
  } else if (ctx.outerwear === "recommended") {
    score -= 12;
  }
  const coldBand = ctx.tempBand === "cold" || ctx.tempBand === "freezing";
  if (s.bottom) {
    if (ctx.tempBand === "hot" && s.bottom.warmth >= 4) score -= 15;
    if (coldBand && s.bottom.warmth <= 1) score -= 25;
  }
  if (s.onepiece && ctx.tempBand === "freezing" && s.onepiece.warmth <= 2) score -= 10;
  if (s.shoes) {
    if (coldBand && s.shoes.warmth <= 1) score -= 30;
    if (ctx.tempBand === "hot" && s.shoes.warmth >= 4) score -= 15;
    if (ctx.precipitation === "rain" && !s.shoes.waterResistant) score -= 8;
    if (ctx.precipitation === "snow" && (!s.shoes.waterResistant || s.shoes.warmth <= 2)) score -= 20;
  }
  const offSeason = items.filter((i) => MAIN_CATEGORIES.has(i.category) && i.seasons.length > 0 && !i.seasons.includes(ctx.season)).length;
  score -= 4 * offSeason;
  return clamp3(score);
}
function formalityScore(items, ctx) {
  const main = items.filter((i) => MAIN_CATEGORIES.has(i.category));
  if (main.length === 0) return 50;
  const { min, max, target } = ctx.formality;
  const distances = main.map((i) => i.formality < min ? min - i.formality : i.formality > max ? i.formality - max : 0);
  const values = main.map((i) => i.formality);
  let penalty = mean(distances) * 22;
  penalty += Math.abs(mean(values) - target) * 8;
  penalty += Math.max(0, Math.max(...values) - Math.min(...values) - 1) * 10;
  if (ctx.activity >= 4) penalty += main.filter((i) => i.formality >= 4).length * 15;
  return clamp3(100 - penalty);
}
function hexToRgb(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}
function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function lightness(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  return (Math.max(...rgb) + Math.min(...rgb)) / 2 / 255;
}
var itemHex = (item) => item.colorHex || (item.colorFamily ? COLOR_FAMILY_HEX[item.colorFamily] : null);
var isNeutral = (family) => NEUTRAL_COLOR_FAMILIES.includes(family);
var pairKey = (a, b) => [a, b].sort((x, y) => x.localeCompare(y, "tr")).join("|");
var ACCENT_PAIR_SCORES = {
  [pairKey("mavi", "turuncu")]: 82,
  [pairKey("mor", "sar\u0131")]: 78,
  [pairKey("bordo", "ye\u015Fil")]: 80,
  [pairKey("pembe", "ye\u015Fil")]: 76,
  [pairKey("mavi", "pembe")]: 78,
  [pairKey("mavi", "sar\u0131")]: 74,
  [pairKey("bordo", "k\u0131rm\u0131z\u0131")]: 78,
  [pairKey("bordo", "pembe")]: 74,
  [pairKey("bordo", "sar\u0131")]: 76,
  [pairKey("mor", "pembe")]: 76,
  [pairKey("sar\u0131", "turuncu")]: 72,
  [pairKey("mavi", "ye\u015Fil")]: 72,
  [pairKey("mavi", "mor")]: 70,
  [pairKey("k\u0131rm\u0131z\u0131", "mavi")]: 70,
  [pairKey("turuncu", "ye\u015Fil")]: 66,
  [pairKey("pembe", "sar\u0131")]: 62,
  [pairKey("k\u0131rm\u0131z\u0131", "pembe")]: 56,
  [pairKey("pembe", "turuncu")]: 56,
  [pairKey("k\u0131rm\u0131z\u0131", "turuncu")]: 55,
  [pairKey("k\u0131rm\u0131z\u0131", "mor")]: 52,
  [pairKey("mor", "turuncu")]: 50,
  [pairKey("k\u0131rm\u0131z\u0131", "ye\u015Fil")]: 45
};
var COMPLEMENTARY_PAIRS = /* @__PURE__ */ new Set([
  pairKey("mavi", "turuncu"),
  pairKey("mor", "sar\u0131"),
  pairKey("k\u0131rm\u0131z\u0131", "ye\u015Fil"),
  pairKey("bordo", "ye\u015Fil")
]);
function colorScore(items, ctx, prefs) {
  const s = toSlots(items);
  const main = items.filter((i) => MAIN_CATEGORIES.has(i.category));
  const known = main.filter((i) => i.colorFamily);
  const accents = /* @__PURE__ */ new Set();
  for (const item of known) {
    if (!isNeutral(item.colorFamily)) accents.add(item.colorFamily);
  }
  const tags = new Set(ctx.styleTags);
  const neutralFamilies = new Set(known.filter((i) => isNeutral(i.colorFamily)).map((i) => i.colorFamily));
  let score;
  if (accents.size === 0) {
    score = 82;
    const upper = s.onepiece || s.top;
    const upperHex = upper ? itemHex(upper) : null;
    const lowerHex = s.bottom ? itemHex(s.bottom) : null;
    if (neutralFamilies.size >= 2 && upperHex && lowerHex && Math.abs(luminance(upperHex) - luminance(lowerHex)) >= 0.25) score += 6;
  } else if (accents.size === 1) {
    score = accents.has("\xE7ok renkli") ? 78 : 92;
  } else if (accents.size === 2) {
    const [a, b] = Array.from(accents);
    if (a === "\xE7ok renkli" || b === "\xE7ok renkli") score = 55;
    else score = ACCENT_PAIR_SCORES[pairKey(a, b)] ?? 62;
  } else {
    score = tags.has("Maximalist") ? 65 : 35;
  }
  const families = new Set(known.filter((i) => i.category !== "shoes").map((i) => i.colorFamily));
  if (tags.has("Monokromatik")) score += families.size <= 1 ? 10 : -10;
  if (tags.has("N\xF6tr Tonlar")) score += accents.size === 0 ? 10 : -10;
  if (tags.has("Tamamlay\u0131c\u0131")) {
    const pair = accents.size === 2 ? pairKey(...Array.from(accents)) : "";
    score += COMPLEMENTARY_PAIRS.has(pair) ? 12 : -4;
  }
  if (tags.has("Pastel")) {
    const accentItems = known.filter((i) => !isNeutral(i.colorFamily));
    const light = accentItems.filter((i) => lightness(itemHex(i)) >= 0.7).length;
    score += accentItems.length && light === accentItems.length ? 10 : -6;
  }
  if (tags.has("Kontrast")) {
    const upper = s.onepiece || s.top;
    const upperHex = upper ? itemHex(upper) : null;
    const lowerHex = s.bottom ? itemHex(s.bottom) : s.shoes ? itemHex(s.shoes) : null;
    if (upperHex && lowerHex) score += Math.abs(luminance(upperHex) - luminance(lowerHex)) >= 0.35 ? 10 : -5;
  }
  const patterned = main.filter((i) => i.pattern && i.pattern !== "d\xFCz" && i.pattern !== UNKNOWN || i.colorFamily === "\xE7ok renkli").length;
  if (patterned === 1) score += 4;
  else if (patterned === 2) score -= 12;
  else if (patterned >= 3) score -= 28;
  if (tags.has("Minimalist") && patterned >= 1) score -= 8;
  const accentAccessories = s.accessories.filter((a) => a.colorFamily && !isNeutral(a.colorFamily)).length;
  if (accentAccessories > 0 && accents.size >= 2) score -= 5;
  const leatherTones = ["siyah", "kahverengi"];
  const shoeTone = s.shoes && normalizeTr(s.shoes.material).includes("deri") ? s.shoes.colorFamily : null;
  if (shoeTone && leatherTones.includes(shoeTone)) {
    for (const accessory of s.accessories) {
      if (normalizeTr(accessory.subCategory).includes("kemer") && accessory.colorFamily && leatherTones.includes(accessory.colorFamily) && accessory.colorFamily !== shoeTone) {
        score -= ctx.formality.target >= 3 ? 8 : 4;
      }
    }
  }
  if (prefs) {
    const faceItems = [s.top, s.onepiece, s.outer].filter(Boolean);
    for (const item of faceItems) {
      if (!item.colorFamily) continue;
      if (prefs.bestColorFamilies.includes(item.colorFamily)) score += 3;
      if (prefs.avoidColorFamilies.includes(item.colorFamily)) score -= 8;
    }
    const disliked = items.filter((i) => i.colorFamily && prefs.dislikedColorFamilies.includes(i.colorFamily)).length;
    score -= disliked * 15;
  }
  const unknownShare = main.length ? (main.length - known.length) / main.length : 0;
  if (unknownShare > 0) score = score * (1 - unknownShare * 0.5) + 70 * unknownShare * 0.5;
  return clamp3(score);
}
var STYLE_COMPAT_PAIRS = [
  ["casual", "smart-casual", 0.8],
  ["casual", "streetwear", 0.8],
  ["casual", "sport", 0.6],
  ["casual", "bohemian", 0.7],
  ["casual", "classic", 0.6],
  ["casual", "elegant", 0.4],
  ["casual", "formal", 0.2],
  ["smart-casual", "classic", 0.9],
  ["smart-casual", "elegant", 0.7],
  ["smart-casual", "formal", 0.6],
  ["smart-casual", "streetwear", 0.5],
  ["smart-casual", "bohemian", 0.5],
  ["smart-casual", "sport", 0.3],
  ["formal", "elegant", 0.9],
  ["formal", "classic", 0.9],
  ["formal", "streetwear", 0.1],
  ["formal", "sport", 0.05],
  ["formal", "bohemian", 0.2],
  ["elegant", "classic", 0.85],
  ["elegant", "bohemian", 0.5],
  ["elegant", "streetwear", 0.2],
  ["elegant", "sport", 0.1],
  ["classic", "streetwear", 0.3],
  ["classic", "sport", 0.2],
  ["classic", "bohemian", 0.4],
  ["sport", "streetwear", 0.75],
  ["sport", "bohemian", 0.2],
  ["streetwear", "bohemian", 0.4]
];
var STYLE_COMPAT = new Map(STYLE_COMPAT_PAIRS.map(([a, b, v]) => [pairKey(a, b), v]));
function styleCompat(a, b) {
  if (a === b) return 1;
  return STYLE_COMPAT.get(pairKey(a, b)) ?? 0.6;
}
var TAG_STYLE_TARGETS = {
  "Sporty": ["sport", "streetwear"],
  "Streetwear": ["streetwear", "casual"],
  "Business Casual": ["smart-casual", "classic"],
  "Klasik": ["classic", "formal", "smart-casual"],
  "Boho": ["bohemian"],
  "Romantic": ["elegant", "bohemian"],
  "Preppy": ["classic", "smart-casual"],
  "Dark Academia": ["classic", "smart-casual"],
  "Vintage": ["classic", "bohemian"],
  "Y2K": ["streetwear", "casual"],
  "Minimalist": ["classic", "smart-casual", "casual"],
  "Maximalist": ["bohemian", "streetwear", "elegant"]
};
var MOOD_STYLE_TARGETS = {
  "Enerjik": ["sport", "streetwear", "casual"],
  "Romantik": ["elegant", "bohemian"],
  "Ciddi": ["formal", "classic", "smart-casual"],
  "Rahat": ["casual", "sport"],
  "Minimalist": ["classic", "smart-casual"]
};
var EVENT_STYLE_TARGETS = {
  "G\xFCndelik": ["casual", "smart-casual", "streetwear"],
  "Ofis": ["smart-casual", "classic", "formal"],
  "\u0130\u015F G\xF6r\xFC\u015Fmesi": ["formal", "classic", "smart-casual"],
  "Randevu": ["elegant", "smart-casual", "classic"],
  "Parti": ["elegant", "streetwear", "bohemian"],
  "D\xFC\u011F\xFCn/Davet": ["formal", "elegant", "classic"],
  "Spor": ["sport"],
  "Seyahat": ["casual", "smart-casual", "sport"],
  "Okul": ["casual", "streetwear", "sport"]
};
var EVENING_MATERIALS = ["saten", "ipek", "kadife", "deri", "payet", "simli", "dantel"];
function styleScore(items, ctx) {
  const main = items.filter((i) => MAIN_CATEGORIES.has(i.category));
  if (main.length < 2) return 70;
  const pairs = [];
  for (let i = 0; i < main.length; i++) {
    for (let j = i + 1; j < main.length; j++) pairs.push(styleCompat(main[i].style, main[j].style));
  }
  let score = 30 + 70 * mean(pairs);
  const eventTargets = EVENT_STYLE_TARGETS[ctx.event];
  if (eventTargets) {
    const garments = main.filter((i) => i.category !== "shoes");
    const share = garments.length ? garments.filter((i) => eventTargets.includes(i.style)).length / garments.length : 0;
    score += 12 * share - 4;
  }
  if (ctx.event === "Parti" || ctx.event === "D\xFC\u011F\xFCn/Davet" || ctx.event === "Randevu" && ctx.dressiness >= 4) {
    const eveningPiece = main.some((i) => i.category !== "shoes" && EVENING_MATERIALS.some((m) => normalizeTr(i.material).includes(m)));
    score += eveningPiece ? 6 : -4;
  }
  const targets = /* @__PURE__ */ new Set();
  for (const tag of ctx.styleTags) (TAG_STYLE_TARGETS[tag] || []).forEach((t) => targets.add(t));
  if (ctx.mood) (MOOD_STYLE_TARGETS[ctx.mood] || []).forEach((t) => targets.add(t));
  if (targets.size > 0) {
    const share = main.filter((i) => targets.has(i.style)).length / main.length;
    score += 18 * share - 6;
  }
  const embedded = main.filter((i) => i.embedding);
  if (embedded.length >= 2) {
    const sims = [];
    for (let i = 0; i < embedded.length; i++) {
      for (let j = i + 1; j < embedded.length; j++) {
        const sim = cosine(embedded[i].embedding, embedded[j].embedding);
        if (sim !== null) sims.push(sim);
      }
    }
    if (sims.length) {
      const coherence = clamp3((mean(sims) - 0.55) / 0.35, 0, 1);
      score = score * 0.75 + 100 * coherence * 0.25;
    }
  }
  return clamp3(score);
}
var VOLUME = { dar: 1, crop: 1.5, normal: 2, bol: 3, oversize: 4 };
function silhouetteScore(items, ctx, prefs) {
  const s = toSlots(items);
  const tags = new Set(ctx.styleTags);
  let score;
  if (s.onepiece) {
    score = 82;
    const outerVol = s.outer ? VOLUME[s.outer.fit] : void 0;
    const pieceVol = VOLUME[s.onepiece.fit];
    if (outerVol !== void 0 && pieceVol !== void 0 && outerVol >= 4 && pieceVol >= 3) score -= 8;
  } else if (s.top && s.bottom) {
    const vu = VOLUME[s.top.fit];
    const vl = VOLUME[s.bottom.fit];
    if (vu === void 0 || vl === void 0) score = 72;
    else if (vu >= 3 && vl >= 3) score = tags.has("Oversize") ? 76 : 58;
    else if (vu <= 1.5 && vl <= 1.5) score = 74;
    else if (Math.abs(vu - vl) >= 1) score = 90;
    else score = 80;
    if (s.top.fit === "crop" && vl !== void 0 && vl >= 2) score = Math.max(score, 88);
    if (tags.has("Oversize") && ((vu ?? 0) >= 3.5 || (vl ?? 0) >= 3.5)) score += 8;
    if (tags.has("Fitted") && (vu ?? 3) <= 2 && (vl ?? 3) <= 2) score += 8;
    if (tags.has("Crop & High-waist") && s.top.fit === "crop") score += 8;
  } else {
    score = 60;
  }
  if (tags.has("Katmanl\u0131")) score += s.outer || s.top?.layerRole === "mid" ? 6 : -4;
  if (prefs) {
    const garments = [s.top, s.bottom, s.onepiece, s.outer].filter(Boolean);
    const preferred = garments.filter((i) => prefs.preferredFits.includes(i.fit)).length;
    const avoided = garments.filter((i) => prefs.avoidFits.includes(i.fit)).length;
    score += Math.min(8, preferred * 4) - Math.min(20, avoided * 10);
  }
  return clamp3(score);
}
function preferenceScore(items, prefs) {
  const aff = prefs?.affinities;
  if (!aff) return null;
  const values = items.filter((i) => i.category !== "makeup").map((item) => {
    const attrs = [
      item.colorFamily ? aff.colorFamily[item.colorFamily] : void 0,
      aff.style[item.style],
      aff.fit[item.fit],
      aff.pattern[item.pattern]
    ].filter((v) => typeof v === "number");
    const itemAff = aff.item[item.id] ?? 0;
    return Math.tanh((itemAff + 0.7 * mean(attrs)) / 4);
  });
  return clamp3(50 + 45 * mean(values));
}
function varietyScore(items, deps) {
  const ids = new Set(items.map((i) => i.id));
  let penalty = 0;
  for (const recent of (deps.recentOutfits || []).slice(0, 20)) {
    if (!recent.length) continue;
    const overlap = recent.filter((id) => ids.has(id)).length / Math.max(ids.size, recent.length);
    if (overlap >= 0.999) penalty = Math.max(penalty, 60);
    else if (overlap >= 0.75) penalty = Math.max(penalty, 25);
  }
  let wornPenalty = 0;
  for (const id of ids) {
    if (deps.protectedIds?.has(id)) continue;
    const days = deps.recentlyWorn?.get(id);
    if (days !== void 0 && days <= 2) wornPenalty += 10;
  }
  return clamp3(100 - penalty - Math.min(30, wornPenalty));
}
function outfitFeatures(parts, items) {
  const main = items.filter((i) => MAIN_CATEGORIES.has(i.category));
  const patterned = main.filter((i) => i.pattern && i.pattern !== "d\xFCz" && i.pattern !== UNKNOWN).length;
  return [
    (parts.weather ?? 75) / 100,
    parts.formality / 100,
    parts.color / 100,
    parts.style / 100,
    parts.silhouette / 100,
    (parts.preference ?? 50) / 100,
    parts.variety / 100,
    items.length / 6,
    items.some((i) => i.category === "outerwear") ? 1 : 0,
    patterned / 3,
    mean(main.map((i) => i.formality)) / 5,
    mean(main.map((i) => i.warmth)) / 5
  ];
}
function scoreOutfit(items, ctx, deps = {}) {
  const parts = {
    weather: weatherScore(items, ctx),
    formality: formalityScore(items, ctx),
    color: colorScore(items, ctx, deps.prefs),
    style: styleScore(items, ctx),
    silhouette: silhouetteScore(items, ctx, deps.prefs),
    preference: preferenceScore(items, deps.prefs),
    variety: varietyScore(items, deps)
  };
  const learned = deps.learned ? clamp3(deps.learned(outfitFeatures(parts, items)) * 100) : null;
  let weighted = 0;
  let weightSum = 0;
  const add = (value, weight) => {
    if (value === null) return;
    weighted += value * weight;
    weightSum += weight;
  };
  add(parts.weather, WEIGHTS.weather);
  add(parts.formality, WEIGHTS.formality);
  add(parts.color, WEIGHTS.color);
  add(parts.style, WEIGHTS.style);
  add(parts.silhouette, WEIGHTS.silhouette);
  add(parts.preference, WEIGHTS.preference);
  add(parts.variety, WEIGHTS.variety);
  add(learned, WEIGHTS.learned);
  const round = (v) => v === null ? null : Math.round(v);
  return {
    weather: round(parts.weather),
    formality: Math.round(parts.formality),
    color: Math.round(parts.color),
    style: Math.round(parts.style),
    silhouette: Math.round(parts.silhouette),
    preference: round(parts.preference),
    variety: Math.round(parts.variety),
    learned: round(learned),
    total: Math.round(weightSum ? weighted / weightSum : 0)
  };
}

// backend/engine/builder.ts
var CATEGORY_ORDER = { outerwear: 0, top: 1, onepiece: 1, bottom: 2, shoes: 3, accessory: 4, makeup: 5 };
function outfitId(itemIds) {
  return crypto2.createHash("sha1").update([...itemIds].sort().join("|")).digest("hex").slice(0, 12);
}
function makeOutfit(items, ctx, deps) {
  const ordered = [...items].sort((a, b) => (CATEGORY_ORDER[a.category] ?? 9) - (CATEGORY_ORDER[b.category] ?? 9));
  const itemIds = ordered.map((i) => i.id);
  return { id: outfitId(itemIds), itemIds, items: ordered, breakdown: scoreOutfit(ordered, ctx, deps) };
}
var MAIN = /* @__PURE__ */ new Set(["top", "bottom", "onepiece", "outerwear", "shoes"]);
function similarity(a, b) {
  const aMain = a.items.filter((i) => MAIN.has(i.category)).map((i) => i.id);
  const bMain = new Set(b.items.filter((i) => MAIN.has(i.category)).map((i) => i.id));
  const shared = aMain.filter((id) => bMain.has(id)).length;
  return shared / Math.max(aMain.length, bMain.size, 1);
}
function pickDiverse(sorted, limit, maxSimilarity = 0.67) {
  const picked = [];
  for (const outfit of sorted) {
    if (picked.length >= limit) break;
    if (picked.every((p) => similarity(p, outfit) <= maxSimilarity)) picked.push(outfit);
  }
  for (const outfit of sorted) {
    if (picked.length >= limit) break;
    if (!picked.includes(outfit)) picked.push(outfit);
  }
  return picked;
}
function buildOutfits(pool, ctx, deps, options) {
  const warnings = [];
  const limit = options.limit ?? 10;
  const forced = (category) => pool[category].filter((s) => options.required.has(s.item.id)).map((s) => s.item);
  const forcedTop = forced("top");
  const forcedBottom = forced("bottom");
  const forcedOnepiece = forced("onepiece");
  const forcedOuter = forced("outerwear");
  const forcedShoes = forced("shoes");
  const forcedAccessories = forced("accessory").slice(0, 2);
  const forcedMakeup = forced("makeup").slice(0, 1);
  for (const [list, name] of [[forcedTop, "\xFCst"], [forcedBottom, "alt"], [forcedOnepiece, "tek par\xE7a"], [forcedOuter, "d\u0131\u015F giyim"], [forcedShoes, "ayakkab\u0131"]]) {
    if (list.length > 1) warnings.push(`Ayn\u0131 kombinde birden fazla ${name} zorunlu tutulamaz; ilki kullan\u0131ld\u0131.`);
  }
  const tops = forcedTop.length ? [forcedTop[0]] : pool.top.map((s) => s.item);
  const bottoms = forcedBottom.length ? [forcedBottom[0]] : pool.bottom.map((s) => s.item);
  const onepieces = forcedOnepiece.length ? [forcedOnepiece[0]] : pool.onepiece.map((s) => s.item);
  const shoes = forcedShoes.length ? [forcedShoes[0]] : pool.shoes.map((s) => s.item);
  const outers = pool.outerwear.map((s) => s.item).filter((o) => !ctx.ignoreWeather || o.warmth <= 3);
  let useSeparates = forcedOnepiece.length === 0;
  const useOnepiece = forcedTop.length === 0 && forcedBottom.length === 0;
  if (forcedOnepiece.length && (forcedTop.length || forcedBottom.length)) {
    warnings.push("Tek par\xE7a giysi ile \xFCst/alt ayn\u0131 anda zorunlu tutulamaz; \xFCst + alt kullan\u0131ld\u0131.");
    useSeparates = true;
  }
  if (shoes.length === 0) {
    return { outfits: [], warnings: [...warnings, "Kombin olu\u015Fturmak i\xE7in gard\u0131robuna en az bir ayakkab\u0131 eklemelisin."] };
  }
  let outerOptions;
  if (forcedOuter.length) outerOptions = [forcedOuter[0]];
  else if (ctx.outerwear === "avoid") outerOptions = [null];
  else if (ctx.outerwear === "required" && outers.length) outerOptions = outers;
  else outerOptions = [null, ...outers];
  if (ctx.outerwear === "required" && !forcedOuter.length && outers.length === 0) {
    warnings.push(options.ownsOuterwear ? "Hava so\u011Fuk ama bu etkinli\u011Fe uygun d\u0131\u015F giyim bulunamad\u0131." : "Hava so\u011Fuk; gard\u0131robuna d\u0131\u015F giyim (mont, kaban) eklersen \xF6neriler daha isabetli olur.");
  }
  const base = [];
  const pushCombo = (items) => {
    base.push(makeOutfit(items.filter(Boolean), ctx, deps));
  };
  for (const shoe of shoes) {
    for (const outer of outerOptions) {
      if (useSeparates) {
        for (const top of tops) {
          for (const bottom of bottoms) pushCombo([top, bottom, shoe, outer]);
        }
      }
      if (useOnepiece && (!useSeparates || forcedOnepiece.length === 0)) {
        for (const piece of onepieces) pushCombo([piece, shoe, outer]);
      }
    }
  }
  if (base.length === 0) {
    const missing = useSeparates && (tops.length === 0 || bottoms.length === 0) && onepieces.length === 0 ? "Kombin olu\u015Fturmak i\xE7in gard\u0131robunda en az bir \xFCst ve bir alt (ya da bir tek par\xE7a giysi) olmal\u0131." : "Se\xE7ilen zorunlu par\xE7alarla ge\xE7erli bir kombin olu\u015Fturulamad\u0131.";
    return { outfits: [], warnings: [...warnings, missing] };
  }
  base.sort((a, b) => b.breakdown.total - a.breakdown.total);
  const shortlist = base.slice(0, 40);
  const accessories = pool.accessory.map((s) => s.item).filter((a) => !forcedAccessories.includes(a));
  const makeupOptions = pool.makeup.map((s) => s.item).filter((m) => !forcedMakeup.includes(m));
  const tryMakeup = forcedMakeup.length === 0 && ctx.formality.target >= 3.5 && makeupOptions.length > 0;
  const finished = shortlist.map((outfit) => {
    let best = makeOutfit([...outfit.items, ...forcedAccessories, ...forcedMakeup], ctx, deps);
    if (forcedAccessories.length < 1 && accessories.length > 0) {
      const tolerance = ctx.formality.target >= 3 ? 1 : 0;
      let bestAccessory = null;
      for (const accessory of accessories) {
        const candidate = makeOutfit([...best.items, accessory], ctx, deps);
        if (!bestAccessory || candidate.breakdown.total > bestAccessory.breakdown.total) bestAccessory = candidate;
      }
      if (bestAccessory && bestAccessory.breakdown.total >= best.breakdown.total - tolerance) best = bestAccessory;
    }
    if (tryMakeup) {
      const withAccessory = best;
      for (const makeup of makeupOptions) {
        const candidate = makeOutfit([...withAccessory.items, makeup], ctx, deps);
        if (candidate.breakdown.total >= best.breakdown.total) best = candidate;
      }
    }
    return best;
  });
  finished.sort((a, b) => b.breakdown.total - a.breakdown.total);
  return { outfits: pickDiverse(finished, limit), warnings };
}

// backend/engine/validator.ts
var LIMITS = { top: 1, bottom: 1, onepiece: 1, outerwear: 1, shoes: 1, accessory: 2, makeup: 1 };
function validateOutfit(itemIds, byId, options = {}) {
  const violations = [];
  const seen = /* @__PURE__ */ new Set();
  const items = [];
  for (const id of itemIds) {
    if (seen.has(id)) {
      violations.push({ code: "duplicate_item", message: `Ayn\u0131 par\xE7a birden fazla kez se\xE7ilmi\u015F: ${id}`, itemId: id });
      continue;
    }
    seen.add(id);
    const item = byId.get(id);
    if (!item) {
      violations.push({ code: "unknown_item", message: `Gard\u0131ropta olmayan par\xE7a: ${id}`, itemId: id });
      continue;
    }
    items.push(item);
  }
  for (const id of options.excluded || []) {
    if (seen.has(id)) violations.push({ code: "excluded_item", message: `Yasaklanan par\xE7a kullan\u0131lm\u0131\u015F: ${id}`, itemId: id });
  }
  for (const id of options.required || []) {
    if (!seen.has(id)) violations.push({ code: "missing_required", message: `Zorunlu par\xE7a eksik: ${id}`, itemId: id });
  }
  const counts = {};
  for (const item of items) counts[item.category] = (counts[item.category] || 0) + 1;
  for (const [category, count] of Object.entries(counts)) {
    if (count > (LIMITS[category] ?? 1)) {
      violations.push({ code: "too_many", message: `"${category}" kategorisinden en fazla ${LIMITS[category] ?? 1} par\xE7a olabilir.` });
    }
  }
  const hasOnepiece = (counts.onepiece || 0) > 0;
  const hasTop = (counts.top || 0) > 0;
  const hasBottom = (counts.bottom || 0) > 0;
  if (hasOnepiece && (hasTop || hasBottom)) {
    violations.push({ code: "structure", message: "Tek par\xE7a giysiyle birlikte ayr\u0131ca \xFCst veya alt se\xE7ilmemeli." });
  } else if (!hasOnepiece && !(hasTop && hasBottom)) {
    violations.push({ code: "structure", message: "Kombinde bir \xFCst ve bir alt ya da bir tek par\xE7a giysi olmal\u0131." });
  }
  if (!counts.shoes) {
    violations.push({ code: "structure", message: "Kombinde ayakkab\u0131 olmal\u0131." });
  }
  const ctx = options.ctx;
  if (ctx?.weather && ctx.tempBand) {
    const outer = items.find((i) => i.category === "outerwear");
    const shoes = items.find((i) => i.category === "shoes");
    if (ctx.outerwear === "required" && !outer && options.ownsOuterwear) {
      violations.push({ code: "weather_outerwear_missing", message: `Hava ${ctx.weather.feelsLikeC}\xB0C hissediliyor; d\u0131\u015F giyim gerekli.` });
    }
    if (ctx.tempBand === "hot" && outer && outer.warmth >= 3) {
      violations.push({ code: "weather_outerwear_heavy", message: "\xC7ok s\u0131cak havada kal\u0131n d\u0131\u015F giyim se\xE7ilmi\u015F.", itemId: outer.id });
    }
    if ((ctx.tempBand === "freezing" || ctx.tempBand === "cold") && shoes && shoes.warmth <= 1) {
      violations.push({ code: "weather_shoes", message: "So\u011Fuk havada a\xE7\u0131k ayakkab\u0131 (sandalet/terlik) se\xE7ilmi\u015F.", itemId: shoes.id });
    }
  }
  return violations;
}

// backend/engine/explain.ts
var MAIN2 = /* @__PURE__ */ new Set(["top", "bottom", "onepiece", "outerwear", "shoes"]);
function accentsOf(items) {
  const set = /* @__PURE__ */ new Set();
  for (const item of items) {
    if (MAIN2.has(item.category) && item.colorFamily && !NEUTRAL_COLOR_FAMILIES.includes(item.colorFamily)) set.add(item.colorFamily);
  }
  return Array.from(set);
}
var capitalize = (s) => s.charAt(0).toLocaleUpperCase("tr-TR") + s.slice(1);
function deterministicTitle(outfit, ctx) {
  const accents = accentsOf(outfit.items);
  const families = new Set(outfit.items.filter((i) => MAIN2.has(i.category) && i.category !== "shoes" && i.colorFamily).map((i) => i.colorFamily));
  let palette;
  if (families.size === 1) palette = `Ton-s\xFCr-ton ${Array.from(families)[0]}`;
  else if (accents.length === 0) palette = "N\xF6tr ve dengeli";
  else if (accents.length === 1) palette = `${capitalize(accents[0])} vurgulu`;
  else palette = "Renkli ve iddial\u0131";
  return `${palette} ${ctx.eventLabel.toLocaleLowerCase("tr-TR")} kombini`.slice(0, 60);
}
function deterministicReason(outfit, ctx) {
  const s = toSlots(outfit.items);
  const sentences = [];
  if (ctx.weather) {
    const weather = `${ctx.weather.condition.toLocaleLowerCase("tr-TR")} ve hissedilen ${Math.round(ctx.weather.feelsLikeC)}\xB0C hava`;
    if (s.outer) {
      const role = ctx.needsWaterResistant && s.outer.waterResistant ? "ya\u011F\u0131\u015Fa kar\u015F\u0131 koruyor" : "s\u0131cak tutuyor";
      sentences.push(`${capitalize(weather)} i\xE7in ${s.outer.name} ${role}.`);
    } else if (ctx.tempBand === "hot" || ctx.tempBand === "warm") {
      sentences.push(`${capitalize(weather)} i\xE7in hafif ve tek katl\u0131 bir kombin.`);
    } else {
      sentences.push(`${capitalize(weather)} i\xE7in katmanlar dengeli tutuldu.`);
    }
  }
  const accents = accentsOf(outfit.items);
  if (accents.length === 0) sentences.push("N\xF6tr tonlar sakin ve birbiriyle kolayca uyum sa\u011Flayan bir palet olu\u015Fturuyor.");
  else if (accents.length === 1) sentences.push(`N\xF6tr bir zemin \xFCzerinde ${accents[0]} tek vurgu rengi olarak \xF6ne \xE7\u0131k\u0131yor.`);
  else sentences.push(`${capitalize(accents[0])} ve ${accents[1]} birlikte canl\u0131 bir renk dengesi kuruyor.`);
  if (s.top && s.bottom && s.top.fit !== "belirsiz" && s.bottom.fit !== "belirsiz" && s.top.fit !== s.bottom.fit) {
    sentences.push(`${FIT_LABELS[s.top.fit] || s.top.fit} \xFCst ile ${(FIT_LABELS[s.bottom.fit] || s.bottom.fit).toLocaleLowerCase("tr-TR")} alt sil\xFCeti dengeliyor.`);
  } else {
    const styles = Array.from(new Set(outfit.items.filter((i) => MAIN2.has(i.category)).map((i) => STYLE_LABELS[i.style] || i.style)));
    sentences.push(`${styles.slice(0, 2).join(" ve ")} \xE7izgideki par\xE7alar ${ctx.eventLabel.toLocaleLowerCase("tr-TR")} i\xE7in uygun resmiyette.`);
  }
  return sentences.join(" ");
}
function describeItemForPrompt(item, locked) {
  const attrs = [
    CATEGORY_LABELS[item.category] || item.category,
    item.subCategory,
    item.colorFamily ? `renk: ${item.colorFamily}` : null,
    item.material && item.material !== "belirsiz" ? `kuma\u015F: ${item.material}` : null,
    item.pattern && item.pattern !== "belirsiz" ? `desen: ${item.pattern}` : null,
    item.fit && item.fit !== "belirsiz" ? `kesim: ${item.fit}` : null,
    `stil: ${STYLE_LABELS[item.style] || item.style}`,
    `resmiyet ${item.formality}/5`,
    item.category !== "accessory" && item.category !== "makeup" ? `s\u0131cak tutma ${item.warmth}/5` : null,
    item.waterResistant ? "su ge\xE7irmez" : null
  ].filter(Boolean);
  return `${locked ? "\u{1F512} " : ""}[${item.id}] ${item.name} (${attrs.join(", ")})`;
}

// backend/engine/stylist.ts
var SYSTEM_INSTRUCTION = `Sen deneyimli bir ki\u015Fisel stilistsin ve kullan\u0131c\u0131yla T\xFCrk\xE7e konu\u015Fuyorsun.
Sana kullan\u0131c\u0131n\u0131n kendi gard\u0131robundan haz\u0131rlanm\u0131\u015F aday kombinler veriliyor. Adaylar hava, resmiyet ve temel renk kurallar\u0131 a\xE7\u0131s\u0131ndan \xF6nceden kontrol edildi ve puanland\u0131; puan yaln\u0131zca yol g\xF6sterir, son estetik karar senin.

G\xF6revin:
1. Ba\u011Flama, stil bilgisine ve kullan\u0131c\u0131n\u0131n tercihlerine g\xF6re en iyi kombinleri se\xE7ip en iyiden ba\u015Flayarak s\u0131rala. Se\xE7tiklerin birbirinden belirgin \u015Fekilde farkl\u0131 olsun.
2. Ger\xE7ekten iyile\u015Ftiriyorsa, se\xE7ti\u011Fin bir kombinde tek bir par\xE7ay\u0131 "de\u011Fi\u015Fiklik i\xE7in kullan\u0131labilecek par\xE7alar" listesindeki AYNI kategoriden bir par\xE7ayla de\u011Fi\u015Ftirebilirsin. De\u011Fi\u015Fiklik yoksa swapOutItemId ve swapInItemId bo\u015F metin olsun.
3. Her kombin i\xE7in en fazla 5 kelimelik bir ba\u015Fl\u0131k ve 2-3 c\xFCmlelik a\xE7\u0131klama yaz: neden bu etkinli\u011Fe ve havaya uydu\u011Fu, renk ve sil\xFCet dengesi. Kullan\u0131c\u0131ya do\u011Frudan hitap et.

Kurallar:
- Yaln\u0131zca verilen aday ve par\xE7a kimliklerini kullan.
- \u{1F512} i\u015Faretli par\xE7alar kullan\u0131c\u0131n\u0131n zorunlu tuttu\u011Fu par\xE7alard\u0131r; onlar\u0131 de\u011Fi\u015Ftirme.
- A\xE7\u0131klamalarda puanlardan, "aday" kelimesinden veya k\xF6\u015Feli parantez i\xE7indeki teknik kimliklerden bahsetme.`;
function contextBlock(ctx, preferenceSummary2) {
  const lines = [
    `- Etkinlik: ${ctx.eventLabel} (resmiyet hedefi ${ctx.formality.target}/5, aral\u0131k ${ctx.formality.min}-${ctx.formality.max}; hareket d\xFCzeyi ${ctx.activity}/5)`
  ];
  if (ctx.eventNotes) lines.push(`- Etkinlik notu: ${ctx.eventNotes}`);
  if (ctx.weather) {
    const w = ctx.weather;
    const precip = w.precipitationProbability !== null ? `, ya\u011F\u0131\u015F olas\u0131l\u0131\u011F\u0131 %${w.precipitationProbability}` : "";
    lines.push(`- Hava (${w.locationLabel}${w.isForecast ? `, ${w.time} tahmini` : ""}): ${w.condition}, ${w.temperatureC}\xB0C, hissedilen ${w.feelsLikeC}\xB0C${precip} \u2192 ${TEMP_BAND_LABELS[ctx.tempBand]}`);
  } else {
    lines.push(ctx.ignoreWeather ? "- Hava: dikkate al\u0131nm\u0131yor (kapal\u0131 mekan)" : "- Hava: bilgi al\u0131namad\u0131; mevsime uygun se\xE7");
  }
  if (ctx.indoor) lines.push("- Etkinlik kapal\u0131 mekanda");
  if (ctx.mood) lines.push(`- Ruh hali: ${ctx.mood}`);
  if (ctx.styleTags.length) lines.push(`- \u0130stenen stil: ${ctx.styleTags.join(", ")}`);
  if (ctx.personalContext) lines.push(`- Kullan\u0131c\u0131n\u0131n stil kimli\u011Fi (kullan\u0131c\u0131 yazd\u0131): """${ctx.personalContext}"""`);
  if (preferenceSummary2) lines.push(`- Ge\xE7mi\u015F geri bildirimlerden tercih \xF6zeti: ${preferenceSummary2}`);
  return lines.join("\n");
}
function buildPrompt(input, candidateIds, swapPool, maxPicks) {
  const sections = [];
  sections.push(`BA\u011ELAM:
${contextBlock(input.ctx, input.preferenceSummary)}`);
  if (input.rules.length) {
    sections.push(`ST\u0130L B\u0130LG\u0130S\u0130:
${input.rules.map((r, i) => `${i + 1}. ${r.title}: ${r.text}`).join("\n")}`);
  }
  if (input.examples.length) {
    sections.push(`BU BA\u011ELAMDA \u0130Y\u0130 \xC7ALI\u015EAN \xD6RNEK KOMB\u0130NLER (tarif, gard\u0131roptaki par\xE7alar de\u011Fil):
${input.examples.map((e) => `- ${e.outfit} \u2014 ${e.why}`).join("\n")}`);
  }
  if (input.personalExamples.length) {
    sections.push(`KULLANICININ DAHA \xD6NCE BE\u011EEND\u0130\u011E\u0130 / G\u0130YD\u0130\u011E\u0130 KOMB\u0130NLER:
${input.personalExamples.map((e) => `- ${e}`).join("\n")}`);
  }
  const candidateLines = input.candidates.map((outfit, i) => {
    const items = outfit.items.map((item) => `    ${describeItemForPrompt(item, input.protectedIds.has(item.id))}`).join("\n");
    return `${candidateIds[i]} (\xF6n puan ${outfit.breakdown.total}):
${items}`;
  });
  sections.push(`ADAY KOMB\u0130NLER:
${candidateLines.join("\n")}`);
  const byCategory = /* @__PURE__ */ new Map();
  for (const item of swapPool) {
    const list = byCategory.get(item.category) || [];
    list.push(item);
    byCategory.set(item.category, list);
  }
  const poolLines = Array.from(byCategory.entries()).map(([category, items]) => `${CATEGORY_LABELS[category] || category}:
${items.map((item) => `    ${describeItemForPrompt(item, false)}`).join("\n")}`);
  sections.push(`DE\u011E\u0130\u015E\u0130KL\u0130K \u0130\xC7\u0130N KULLANILAB\u0130LECEK PAR\xC7ALAR:
${poolLines.join("\n")}`);
  sections.push(`En fazla ${maxPicks} kombin se\xE7.`);
  return sections.join("\n\n");
}
function buildSchema(candidateIds, poolIds, maxPicks) {
  return {
    type: "object",
    properties: {
      picks: {
        type: "array",
        minItems: 1,
        maxItems: maxPicks,
        items: {
          type: "object",
          properties: {
            candidateId: { type: "string", enum: candidateIds },
            swapOutItemId: { type: "string", enum: ["", ...poolIds] },
            swapInItemId: { type: "string", enum: ["", ...poolIds] },
            title: { type: "string" },
            reason: { type: "string" }
          },
          required: ["candidateId", "swapOutItemId", "swapInItemId", "title", "reason"]
        }
      }
    },
    required: ["picks"]
  };
}
function evaluatePicks(raw, input, candidateIds, maxPicks) {
  const problems = [];
  const notes = [];
  const picks = [];
  const usedCandidates = /* @__PURE__ */ new Set();
  const usedOutfitIds = /* @__PURE__ */ new Set();
  const expected = Math.min(maxPicks, input.candidates.length);
  for (const pick2 of raw || []) {
    const index = candidateIds.indexOf(pick2.candidateId);
    if (index === -1) {
      problems.push(`Ge\xE7ersiz aday kimli\u011Fi: ${pick2.candidateId}`);
      continue;
    }
    if (usedCandidates.has(pick2.candidateId)) {
      problems.push(`${pick2.candidateId} birden fazla kez se\xE7ildi.`);
      continue;
    }
    const title = String(pick2.title || "").trim();
    const reason = String(pick2.reason || "").trim();
    if (!title || !reason) {
      problems.push(`${pick2.candidateId} i\xE7in ba\u015Fl\u0131k veya a\xE7\u0131klama bo\u015F.`);
      continue;
    }
    usedCandidates.add(pick2.candidateId);
    let outfit = input.candidates[index];
    let swapped = false;
    const out = pick2.swapOutItemId;
    const inn = pick2.swapInItemId;
    if (out && inn) {
      const outItem = input.byId.get(out);
      const inItem = input.byId.get(inn);
      const canSwap = outItem && inItem && outfit.itemIds.includes(out) && !outfit.itemIds.includes(inn) && outItem.category === inItem.category && !input.protectedIds.has(out);
      if (canSwap) {
        const newItems = outfit.items.map((i) => i.id === out ? inItem : i);
        const newIds = newItems.map((i) => i.id);
        const violations = validateOutfit(newIds, input.byId, { ctx: input.ctx });
        const breakdown = scoreOutfit(newItems, input.ctx, input.scoringDeps);
        if (violations.length === 0 && breakdown.total >= outfit.breakdown.total - 8) {
          outfit = { id: outfitId(newIds), itemIds: newIds, items: newItems, breakdown };
          swapped = true;
        } else {
          notes.push("Stilistin \xF6nerdi\u011Fi bir par\xE7a de\u011Fi\u015Fikli\u011Fi kurallar\u0131 kar\u015F\u0131lamad\u0131\u011F\u0131 i\xE7in uygulanmad\u0131.");
        }
      } else {
        notes.push("Stilistin \xF6nerdi\u011Fi bir par\xE7a de\u011Fi\u015Fikli\u011Fi ge\xE7ersiz oldu\u011Fu i\xE7in uygulanmad\u0131.");
      }
    }
    if (usedOutfitIds.has(outfit.id)) {
      problems.push(`${pick2.candidateId} ba\u015Fka bir se\xE7imle ayn\u0131 kombine d\xF6n\xFC\u015Ft\xFC.`);
      continue;
    }
    usedOutfitIds.add(outfit.id);
    picks.push({ outfit, title: title.slice(0, 60), reason: reason.slice(0, 700), swapped });
    if (picks.length >= maxPicks) break;
  }
  if (picks.length < expected) problems.push(`${expected} kombin bekleniyordu, ${picks.length} ge\xE7erli kombin geldi.`);
  return { picks, problems, notes };
}
function fallbackPicks(input, maxPicks, existing = []) {
  const picks = [...existing];
  const used = new Set(picks.map((p) => p.outfit.id));
  for (const outfit of input.candidates) {
    if (picks.length >= maxPicks) break;
    if (used.has(outfit.id)) continue;
    used.add(outfit.id);
    picks.push({ outfit, title: deterministicTitle(outfit, input.ctx), reason: deterministicReason(outfit, input.ctx), swapped: false });
  }
  return picks;
}
async function runStylist(input) {
  const maxPicks = input.maxPicks ?? 3;
  const warnings = [];
  if (input.candidates.length === 0) return { picks: [], model: null, usedFallback: true, warnings };
  const candidateIds = input.candidates.map((_, i) => `K${i + 1}`);
  const inCandidates = new Set(input.candidates.flatMap((c) => c.itemIds));
  const poolItems = Array.from(input.byId.values()).filter((i) => inCandidates.has(i.id));
  const schema = buildSchema(candidateIds, poolItems.map((i) => i.id), maxPicks);
  const prompt = buildPrompt(input, candidateIds, poolItems, maxPicks);
  let model = null;
  try {
    const first = await generateJson({
      task: "stylist",
      label: "stylist_pick",
      systemInstruction: SYSTEM_INSTRUCTION,
      contents: prompt,
      schema
    });
    model = first.info.model;
    let evaluation = evaluatePicks(first.data?.picks, input, candidateIds, maxPicks);
    if (evaluation.problems.length) {
      try {
        const repair = await generateJson({
          task: "stylist",
          label: "stylist_repair",
          systemInstruction: SYSTEM_INSTRUCTION,
          preferModel: model,
          totalBudgetMs: 2e4,
          contents: `${prompt}

\xD6NCEK\u0130 YANITIN \u015EU SORUNLARI \u0130\xC7ER\u0130YORDU, d\xFCzeltip yan\u0131t\u0131 ba\u015Ftan ver:
${evaluation.problems.map((p) => `- ${p}`).join("\n")}`,
          schema
        });
        model = repair.info.model;
        const repaired = evaluatePicks(repair.data?.picks, input, candidateIds, maxPicks);
        if (repaired.picks.length >= evaluation.picks.length) evaluation = repaired;
      } catch {
      }
    }
    warnings.push(...Array.from(new Set(evaluation.notes)));
    const complete = fallbackPicks(input, maxPicks, evaluation.picks);
    const usedFallback = evaluation.picks.length === 0;
    return { picks: complete, model, usedFallback, warnings };
  } catch (err) {
    const message = err instanceof AiError && err.code === "blocked" ? "AI stilist bu istek i\xE7in yan\u0131t \xFCretmedi; kombinler kural motoruyla se\xE7ildi." : "AI stilist \u015Fu an yan\u0131t veremedi; kombinler kural motoruyla se\xE7ildi ve a\xE7\u0131kland\u0131.";
    warnings.push(message);
    return { picks: fallbackPicks(input, maxPicks), model, usedFallback: true, warnings };
  }
}

// backend/engine/reranker.ts
var RERANKER_NAME = "outfit-reranker";
var sigmoid = (z) => 1 / (1 + Math.exp(-z));
function predict(model, features) {
  let z = model.bias;
  for (let i = 0; i < model.featureCount; i++) z += (model.weights[i] || 0) * (features[i] || 0);
  return sigmoid(z);
}
var cache = null;
async function loadReranker() {
  if (!cache || Date.now() - cache.loadedAt > 10 * 60 * 1e3) {
    try {
      const doc = await ModelArtifactModel.findOne({ name: RERANKER_NAME }).lean();
      cache = { model: doc?.payload || null, loadedAt: Date.now() };
    } catch {
      cache = { model: null, loadedAt: Date.now() };
    }
  }
  const model = cache.model;
  if (!model || !Array.isArray(model.weights)) return null;
  return (features) => features.length === model.featureCount ? predict(model, features) : 0.5;
}

// backend/engine/request.ts
var RequestError = class extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
};
var str = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : void 0;
var idList = (value, maxItems = 50) => Array.isArray(value) ? value.filter((v) => typeof v === "string" && v.length <= 100).slice(0, maxItems) : [];
function sanitizeLocation(value) {
  if (typeof value === "string") {
    const query = value.trim().slice(0, 100);
    return query ? { type: "text", query } : void 0;
  }
  if (!value || typeof value !== "object") return void 0;
  const v = value;
  if (v.type === "coords" && typeof v.lat === "number" && typeof v.lon === "number" && Number.isFinite(v.lat) && Number.isFinite(v.lon)) {
    if (Math.abs(v.lat) > 90 || Math.abs(v.lon) > 180) return void 0;
    return { type: "coords", lat: v.lat, lon: v.lon, label: str(v.label, 80) };
  }
  if (v.type === "place" && typeof v.province === "string" && v.province.trim()) {
    return { type: "place", province: v.province.trim().slice(0, 60), district: str(v.district, 60) || void 0 };
  }
  if (v.type === "text" && typeof v.query === "string" && v.query.trim()) {
    return { type: "text", query: v.query.trim().slice(0, 100) };
  }
  return void 0;
}
function sanitizeStylistRequest(raw) {
  if (!raw || typeof raw !== "object") throw new RequestError("Kombin iste\u011Fi eksik.");
  const r = raw;
  let dateTime;
  if (r.dateTime !== void 0 && r.dateTime !== null && r.dateTime !== "") {
    if (!isValidLocalDateTime(r.dateTime)) throw new RequestError("Tarih ve saat bi\xE7imi ge\xE7ersiz.");
    const now = localDateTime();
    const max = localDateTime(new Date(Date.now() + 15 * 864e5));
    if (r.dateTime.slice(0, 10) < now.slice(0, 10)) throw new RequestError("Ge\xE7mi\u015F bir tarih i\xE7in kombin planlanamaz.");
    if (r.dateTime > max) throw new RequestError("En fazla 15 g\xFCn sonras\u0131 i\xE7in planlama yap\u0131labilir.");
    dateTime = r.dateTime.slice(0, 13) <= now.slice(0, 13) ? void 0 : r.dateTime;
  }
  const num2 = (value) => typeof value === "number" && Number.isFinite(value) ? value : void 0;
  const mood = str(r.mood, 30);
  return {
    location: sanitizeLocation(r.location),
    dateTime,
    event: str(r.event, 60) || "G\xFCndelik",
    eventText: str(r.eventText, 300) || void 0,
    dressiness: num2(r.dressiness),
    activity: num2(r.activity),
    effort: num2(r.effort),
    mood: mood && MOODS.includes(mood) ? mood : void 0,
    styleTags: Array.isArray(r.styleTags) ? r.styleTags.filter((t) => typeof t === "string" && STYLE_TAGS.includes(t)).slice(0, 10) : [],
    personalContext: str(r.personalContext, 1e3) || void 0,
    ignoreWeather: r.ignoreWeather === true,
    requiredItems: idList(r.requiredItems),
    lockedItems: idList(r.lockedItems),
    excludedItems: idList(r.excludedItems, 100),
    recentOutfits: Array.isArray(r.recentOutfits) ? r.recentOutfits.filter(Array.isArray).slice(0, 10).map((o) => idList(o, 10)) : []
  };
}

// backend/engine/generate.ts
async function parseEventText(event, eventText) {
  const { data } = await generateJson({
    task: "light",
    label: "event_parse",
    contents: `Kullan\u0131c\u0131 bir kombin i\xE7in etkinli\u011Fini \u015F\xF6yle anlatt\u0131 (se\xE7ti\u011Fi tip: ${event}):
"""${eventText}"""

Bu etkinli\u011Fi yap\u0131land\u0131r. formalityMin/formalityMax 1 (spor) ile 5 (resmi gece) aras\u0131, activity 1 (oturarak) ile 5 (spor) aras\u0131. notes alan\u0131na k\u0131yafeti etkileyen \xF6nemli ayr\u0131nt\u0131lar\u0131 tek k\u0131sa c\xFCmleyle yaz (yoksa bo\u015F b\u0131rak).`,
    schema: {
      type: "object",
      properties: {
        eventKey: { type: "string", enum: [...EVENTS, "\xD6zel"] },
        formalityMin: { type: "integer", minimum: 1, maximum: 5 },
        formalityMax: { type: "integer", minimum: 1, maximum: 5 },
        activity: { type: "integer", minimum: 1, maximum: 5 },
        indoor: { type: "boolean" },
        notes: { type: "string" }
      },
      required: ["eventKey", "formalityMin", "formalityMax", "activity", "indoor", "notes"]
    }
  });
  return data;
}
async function loadWardrobe(userId) {
  const docs = await ItemModel.find({ userId }).select("+embedding").lean();
  const engineItems = docs.map(toEngineItem);
  return {
    docs,
    engineItems,
    byId: new Map(engineItems.map((i) => [i.id, i])),
    dtoById: new Map(docs.map((d) => [d.id, toItemDTO(d)]))
  };
}
function checkWardrobeCoverage(items) {
  const has = (c) => items.some((i) => i.category === c);
  const missing = [];
  if (!has("shoes")) missing.push("ayakkab\u0131");
  if (!has("onepiece") && !(has("top") && has("bottom"))) {
    if (!has("top")) missing.push("\xFCst giyim");
    if (!has("bottom")) missing.push("alt giyim (ya da bir elbise/tulum)");
  }
  return missing.length ? `Kombin olu\u015Fturmak i\xE7in gard\u0131robuna \u015Funlar\u0131 eklemelisin: ${missing.join(", ")}.` : null;
}
async function resolveWeather(user, request, useLastLocation) {
  if (request.ignoreWeather) return { weather: null, weatherError: null, resolved: null };
  let resolved = null;
  try {
    if (request.location) {
      resolved = await resolveLocation(request.location);
      if (!resolved) return { weather: null, weatherError: "Se\xE7ilen konum bulunamad\u0131; hava durumu kullan\u0131lmad\u0131.", resolved: null };
    } else if (useLastLocation && user?.lastLocation?.latitude !== void 0 && user?.lastLocation?.latitude !== null) {
      resolved = { latitude: user.lastLocation.latitude, longitude: user.lastLocation.longitude, label: user.lastLocation.label || "Son konum" };
    } else {
      return { weather: null, weatherError: "Konum se\xE7ilmedi\u011Fi i\xE7in hava durumu kullan\u0131lmad\u0131.", resolved: null };
    }
    const weather = await getWeather(resolved, request.dateTime);
    return { weather, weatherError: null, resolved };
  } catch (err) {
    const message = err instanceof WeatherError ? err.message : "Hava durumu servisine ula\u015F\u0131lamad\u0131.";
    return { weather: null, weatherError: message, resolved };
  }
}
async function personalExamplesFor(user, ctx, byId) {
  if (!hasConsent(user, "personalization")) return [];
  const [outfits, logs] = await Promise.all([
    OutfitModel.find({ userId: user._id }).sort({ createdAt: -1 }).limit(30).lean(),
    WearLogModel.find({ userId: user._id }).sort({ date: -1 }).limit(30).lean()
  ]);
  const describe = (ids) => ids.map((id) => byId.get(id)).filter(Boolean).map((i) => `${i.name}${i.colorFamily ? ` (${i.colorFamily})` : ""}`).join(" + ");
  const scored = [
    ...outfits.map((o) => ({ ids: o.items || [], event: o.context?.event, tempBand: o.context?.tempBand })),
    ...logs.map((l) => ({ ids: l.itemIds || [], event: void 0, tempBand: void 0 }))
  ].map((e) => ({ ...e, score: (e.event === ctx.eventLabel ? 2 : 0) + (ctx.tempBand && e.tempBand === ctx.tempBand ? 1 : 0) })).filter((e) => e.ids.length >= 2 && e.ids.every((id) => byId.has(id))).sort((a, b) => b.score - a.score);
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const e of scored) {
    const text2 = describe(e.ids);
    if (!text2 || seen.has(text2)) continue;
    seen.add(text2);
    result.push(text2);
    if (result.length >= 3) break;
  }
  return result;
}
async function runEngine(user, request, options, wardrobe) {
  const snapshot = wardrobe || await loadWardrobe(user._id);
  const coverage = checkWardrobeCoverage(snapshot.engineItems);
  if (coverage) throw new RequestError(coverage, 422);
  const warnings = [];
  const required = new Set([...request.requiredItems, ...request.lockedItems].filter((id) => snapshot.byId.has(id)));
  const excluded = new Set(request.excludedItems.filter((id) => snapshot.byId.has(id)));
  for (const id of required) {
    if (excluded.has(id)) {
      excluded.delete(id);
      warnings.push("Bir par\xE7a hem zorunlu hem hari\xE7 tutulmu\u015Ftu; zorunlu olarak kullan\u0131ld\u0131.");
    }
  }
  const weather = await resolveWeather(user, request, Boolean(options.useLastLocation));
  if (weather.resolved && request.location && request.location.type !== "text") {
    await UserModel.updateOne({ _id: user._id }, {
      $set: { lastLocation: { latitude: weather.resolved.latitude, longitude: weather.resolved.longitude, label: weather.resolved.label, updatedAt: /* @__PURE__ */ new Date() } }
    }).catch(() => void 0);
  }
  let eventOverride = null;
  if (options.mode === "full" && request.eventText) {
    try {
      const parsed = await parseEventText(request.event, request.eventText);
      if (parsed) eventOverride = { ...parsed };
    } catch {
      warnings.push("Etkinlik a\xE7\u0131klaman yorumlanamad\u0131; se\xE7ti\u011Fin etkinlik tipi kullan\u0131ld\u0131.");
      eventOverride = { notes: request.eventText };
    }
  }
  const ctx = buildContext({
    event: request.event,
    eventOverride,
    dressiness: request.dressiness,
    activity: request.activity,
    effort: request.effort,
    mood: request.mood,
    styleTags: request.styleTags,
    personalContext: request.personalContext,
    ignoreWeather: request.ignoreWeather,
    weather: weather.weather,
    date: request.dateTime ? new Date(request.dateTime) : void 0
  });
  const [prefs, recentShown, recentlyWorn, learned] = await Promise.all([
    loadPreferenceData(user),
    recentShownOutfits(user),
    recentlyWornMap(user._id),
    loadReranker()
  ]);
  const deps = {
    prefs,
    recentOutfits: recentShown.length ? recentShown : request.recentOutfits,
    recentlyWorn,
    protectedIds: required,
    learned
  };
  const { pool, warnings: candidateWarnings } = selectCandidates(snapshot.engineItems, ctx, { required, excluded, prefs, deps });
  const ownsOuterwear = snapshot.engineItems.some((i) => i.category === "outerwear");
  const built = buildOutfits(pool, ctx, deps, { required, limit: options.candidateLimit ?? 10, ownsOuterwear });
  warnings.push(...candidateWarnings, ...built.warnings);
  const candidates = built.outfits.filter((outfit) => validateOutfit(outfit.itemIds, snapshot.byId, { required, excluded }).length === 0);
  if (candidates.length === 0) {
    throw new RequestError(built.warnings[built.warnings.length - 1] || "Bu ko\u015Fullarla ge\xE7erli bir kombin olu\u015Fturulamad\u0131.", 422);
  }
  return { ctx, candidates, warnings, deps, wardrobe: snapshot, required, weather };
}
function toSuggestion(pick2, dtoById) {
  return {
    id: pick2.outfit.id,
    itemIds: pick2.outfit.itemIds,
    items: pick2.outfit.itemIds.map((id) => dtoById.get(id)).filter(Boolean),
    title: pick2.title,
    reason: pick2.reason,
    score: pick2.outfit.breakdown.total,
    breakdown: pick2.outfit.breakdown
  };
}
async function generateOutfitsForUser(user, rawRequest, options) {
  const request = sanitizeStylistRequest(rawRequest);
  const run = await runEngine(user, request, options);
  const { ctx, candidates, deps, wardrobe, required } = run;
  const warnings = [...run.warnings];
  const picksWanted = options.picks ?? 3;
  let picks;
  let model = null;
  let usedFallback = false;
  let rulesUsed = [];
  if (options.mode === "full") {
    const hasOnepiece = candidates.some((c) => c.items.some((i) => i.category === "onepiece"));
    let queryEmbedding = null;
    let ruleEmbeddings;
    const queryText = [ctx.personalContext, ctx.eventNotes].filter(Boolean).join("\n");
    if (queryText) {
      try {
        [queryEmbedding, ruleEmbeddings] = await Promise.all([getTextEmbedding(queryText, "style_query"), loadRuleEmbeddings()]);
      } catch {
        queryEmbedding = null;
      }
    }
    const rules = retrieveRules({ ctx, hasOnepiece, queryEmbedding, ruleEmbeddings });
    rulesUsed = rules.map((r) => r.id);
    const [summary, personalExamples] = await Promise.all([
      preferenceSummary(user),
      personalExamplesFor(user, ctx, wardrobe.byId)
    ]);
    const result = await runStylist({
      ctx,
      candidates,
      rules,
      examples: retrieveExamples(ctx),
      personalExamples,
      preferenceSummary: summary,
      protectedIds: required,
      byId: wardrobe.byId,
      scoringDeps: deps,
      maxPicks: picksWanted
    });
    picks = result.picks;
    model = result.model;
    usedFallback = result.usedFallback;
    warnings.push(...result.warnings);
  } else {
    picks = candidates.slice(0, picksWanted).map((outfit) => ({
      outfit,
      title: deterministicTitle(outfit, ctx),
      reason: deterministicReason(outfit, ctx),
      swapped: false
    }));
  }
  picks = picks.filter((p) => validateOutfit(p.outfit.itemIds, wardrobe.byId, { required }).length === 0);
  if (picks.length === 0) throw new RequestError("Ge\xE7erli bir kombin olu\u015Fturulamad\u0131.", 422);
  const outfits = picks.map((p) => toSuggestion(p, wardrobe.dtoById));
  const generationId = crypto3.randomUUID();
  const contextSummary = summarizeContext(ctx);
  await logShownOutfits(user, generationId, outfits.map((o) => o.itemIds), contextSummary).catch(() => void 0);
  return {
    generationId,
    outfits,
    weather: ctx.weather,
    weatherError: run.weather.weatherError,
    context: contextSummary,
    model,
    usedFallback,
    rulesUsed,
    warnings: Array.from(new Set(warnings)),
    selectedItems: outfits[0].itemIds,
    stylingReason: outfits[0].reason,
    compatibilityScore: outfits[0].score
  };
}

// backend/engine/capsule.ts
var SAMPLE_LIMIT = 6e4;
var neutralContext = () => buildContext({ event: "G\xFCndelik", ignoreWeather: true, weather: null });
function isWearable(items, ctx) {
  const main = items.filter((i) => i.category !== "accessory" && i.category !== "makeup");
  const formalities = main.map((i) => i.formality);
  if (Math.max(...formalities) - Math.min(...formalities) > 2) return false;
  return colorScore(items, ctx) >= 65 && styleScore(items, ctx) >= 60 && silhouetteScore(items, ctx) >= 60;
}
function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223 >>> 0;
    return state / 4294967296;
  };
}
function countWearableOutfits(items, extraFilter) {
  const ctx = neutralContext();
  const tops = items.filter((i) => i.category === "top");
  const bottoms = items.filter((i) => i.category === "bottom");
  const pieces = items.filter((i) => i.category === "onepiece");
  const shoes = items.filter((i) => i.category === "shoes");
  const separates = tops.length * bottoms.length * shoes.length;
  const onepieceCombos = pieces.length * shoes.length;
  const total = separates + onepieceCombos;
  if (total === 0) return { count: 0, total: 0, estimated: false };
  const check = (combo) => (!extraFilter || extraFilter(combo)) && isWearable(combo, ctx);
  if (total <= SAMPLE_LIMIT) {
    let count = 0;
    for (const shoe of shoes) {
      for (const top of tops) for (const bottom of bottoms) if (check([top, bottom, shoe])) count++;
      for (const piece of pieces) if (check([piece, shoe])) count++;
    }
    return { count, total, estimated: false };
  }
  const random = lcg(items.length * 7919 + total);
  let hits = 0;
  for (let n = 0; n < SAMPLE_LIMIT; n++) {
    const shoe = shoes[Math.floor(random() * shoes.length)];
    const useSeparate = random() * total < separates;
    const combo = useSeparate ? [tops[Math.floor(random() * tops.length)], bottoms[Math.floor(random() * bottoms.length)], shoe] : [pieces[Math.floor(random() * pieces.length)], shoe];
    if (check(combo)) hits++;
  }
  return { count: Math.round(hits / SAMPLE_LIMIT * total), total, estimated: true };
}
function contributionOf(candidate, items) {
  const ctx = neutralContext();
  const tops = items.filter((i) => i.category === "top");
  const bottoms = items.filter((i) => i.category === "bottom");
  const pieces = items.filter((i) => i.category === "onepiece");
  const shoes = items.filter((i) => i.category === "shoes");
  if (candidate.category === "top") {
    let count = 0;
    for (const bottom of bottoms) for (const shoe of shoes) if (isWearable([candidate, bottom, shoe], ctx)) count++;
    return count;
  }
  if (candidate.category === "bottom") {
    let count = 0;
    for (const top of tops) for (const shoe of shoes) if (isWearable([top, candidate, shoe], ctx)) count++;
    return count;
  }
  if (candidate.category === "onepiece") {
    return shoes.filter((shoe) => isWearable([candidate, shoe], ctx)).length;
  }
  if (candidate.category === "shoes") {
    let count = 0;
    for (const top of tops) for (const bottom of bottoms) if (isWearable([top, bottom, candidate], ctx)) count++;
    for (const piece of pieces) if (isWearable([piece, candidate], ctx)) count++;
    return count;
  }
  let pairs = 0;
  let checked = 0;
  outer: for (const shoe of shoes) {
    for (const top of tops) {
      for (const bottom of bottoms) {
        if (checked++ > 2e4) break outer;
        const base = [top, bottom, shoe];
        if (isWearable(base, ctx) && isWearable([...base, candidate], ctx) && Math.abs(candidate.formality - top.formality) <= 2) pairs++;
      }
    }
  }
  return pairs;
}
function summarize(items) {
  const countBy = (key) => items.reduce((acc, item) => {
    const k = key(item);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  return {
    kategoriler: countBy((i) => i.category),
    renkAileleri: countBy((i) => i.colorFamily || UNKNOWN),
    stiller: countBy((i) => i.style),
    resmiyet: countBy((i) => String(i.formality)),
    sicakTutma: countBy((i) => String(i.warmth)),
    mevsimler: countBy((i) => i.seasons.join("/")),
    mevcutTurler: Array.from(new Set(items.map((i) => `${i.category}: ${i.colorFamily || ""} ${i.subCategory}`))).slice(0, 120)
  };
}
var STAPLES = [
  { name: "Beyaz basic ti\u015F\xF6rt", category: "top", subCategory: "ti\u015F\xF6rt", colorFamily: "beyaz", material: "pamuk", pattern: "d\xFCz", fit: "normal", style: "casual", formality: 2, warmth: 2 },
  { name: "A\xE7\u0131k mavi g\xF6mlek", category: "top", subCategory: "g\xF6mlek", colorFamily: "mavi", material: "pamuk", pattern: "d\xFCz", fit: "normal", style: "smart-casual", formality: 4, warmth: 3 },
  { name: "Lacivert ince triko", category: "top", subCategory: "triko", colorFamily: "lacivert", material: "y\xFCn", pattern: "d\xFCz", fit: "normal", style: "smart-casual", formality: 3, warmth: 3 },
  { name: "Koyu mavi d\xFCz pa\xE7a jean", category: "bottom", subCategory: "jean", colorFamily: "lacivert", material: "denim", pattern: "d\xFCz", fit: "normal", style: "casual", formality: 2, warmth: 3 },
  { name: "Bej chino pantolon", category: "bottom", subCategory: "chino pantolon", colorFamily: "bej", material: "pamuk", pattern: "d\xFCz", fit: "normal", style: "smart-casual", formality: 3, warmth: 3 },
  { name: "Siyah kuma\u015F pantolon", category: "bottom", subCategory: "kuma\u015F pantolon", colorFamily: "siyah", material: "y\xFCn kar\u0131\u015F\u0131m", pattern: "d\xFCz", fit: "normal", style: "classic", formality: 4, warmth: 3 },
  { name: "Siyah midi elbise", category: "onepiece", subCategory: "elbise", colorFamily: "siyah", material: "krep", pattern: "d\xFCz", fit: "normal", style: "elegant", formality: 4, warmth: 2 },
  { name: "Beyaz deri sneaker", category: "shoes", subCategory: "sneaker", colorFamily: "beyaz", material: "deri", pattern: UNKNOWN, fit: UNKNOWN, style: "casual", formality: 2, warmth: 2 },
  { name: "Kahverengi deri loafer", category: "shoes", subCategory: "loafer", colorFamily: "kahverengi", material: "deri", pattern: UNKNOWN, fit: UNKNOWN, style: "classic", formality: 4, warmth: 2 },
  { name: "Siyah deri bot", category: "shoes", subCategory: "bot", colorFamily: "siyah", material: "deri", pattern: UNKNOWN, fit: UNKNOWN, style: "casual", formality: 3, warmth: 4 },
  { name: "Lacivert blazer", category: "outerwear", subCategory: "blazer", colorFamily: "lacivert", material: "y\xFCn kar\u0131\u015F\u0131m", pattern: "d\xFCz", fit: "normal", style: "smart-casual", formality: 4, warmth: 2 },
  { name: "Bej tren\xE7kot", category: "outerwear", subCategory: "tren\xE7kot", colorFamily: "bej", material: "gabardin", pattern: "d\xFCz", fit: "normal", style: "classic", formality: 4, warmth: 3 },
  { name: "Kahverengi deri kemer", category: "accessory", subCategory: "kemer", colorFamily: "kahverengi", material: "deri", pattern: UNKNOWN, fit: UNKNOWN, style: "classic", formality: 3, warmth: 1 }
];
function virtualItem(s, index) {
  return toEngineItem({
    id: `__virtual_${index}`,
    name: s.name,
    category: s.category,
    subCategory: s.subCategory,
    colorFamily: s.colorFamily,
    colorHex: s.colorHex,
    material: s.material,
    pattern: s.pattern,
    fit: s.fit,
    style: s.style,
    formality: s.formality,
    warmth: s.warmth
  });
}
function suggestionSchema(target) {
  return {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            category: { type: "string", enum: target === "any" ? CATEGORIES.filter((c) => c !== "makeup") : [target] },
            subCategory: { type: "string" },
            colorFamily: { type: "string", enum: [...COLOR_FAMILIES] },
            colorHex: { type: "string" },
            material: { type: "string" },
            pattern: { type: "string", enum: [...PATTERNS] },
            fit: { type: "string", enum: [...FITS] },
            style: { type: "string", enum: [...STYLES] },
            formality: { type: "integer", minimum: 1, maximum: 5 },
            warmth: { type: "integer", minimum: 1, maximum: 5 },
            layerRole: { type: "string", enum: [...LAYER_ROLES] },
            seasons: { type: "array", items: { type: "string", enum: [...SEASONS] } },
            reason: { type: "string" }
          },
          required: ["name", "category", "subCategory", "colorFamily", "colorHex", "material", "pattern", "fit", "style", "formality", "warmth", "layerRole", "seasons", "reason"]
        }
      }
    },
    required: ["suggestions"]
  };
}
async function analyzeCapsule(docs, target) {
  const items = docs.map(toEngineItem).filter((i) => i.category !== "makeup");
  if (items.length < 5) {
    return {
      insufficient: true,
      message: "Kaps\xFCl gard\u0131rop analizi i\xE7in dolab\u0131nda en az 5 par\xE7a olmal\u0131.",
      currentOutfitCount: 0,
      estimated: false,
      suggestions: [],
      model: null,
      usedFallback: false
    };
  }
  const current = countWearableOutfits(items);
  let model = null;
  let usedFallback = false;
  let raw = [];
  try {
    const targetText = target === "any" ? "herhangi bir kategoriden" : `yaln\u0131zca "${CATEGORY_LABELS[target]}" kategorisinden`;
    const { data, info } = await generateJson({
      task: "stylist",
      label: "capsule_suggest",
      systemInstruction: "Sen kaps\xFCl gard\u0131rop uzman\u0131 bir stilistsin. Kullan\u0131c\u0131n\u0131n gard\u0131robundaki bo\u015Fluklar\u0131 bulur, mevcut par\xE7alarla en \xE7ok kombin kurabilecek \xE7ok y\xF6nl\xFC par\xE7alar\u0131 \xF6nerirsin. T\xFCrk\xE7e yazars\u0131n.",
      contents: `GARDIROP \xD6ZET\u0130 (JSON):
${JSON.stringify(summarize(items))}

${targetText} gard\u0131roba eklendi\u011Finde mevcut par\xE7alarla en \xE7ok yeni kombin kurulmas\u0131n\u0131 sa\u011Flayacak 3-4 farkl\u0131 par\xE7a \xF6ner. Gard\u0131ropta zaten benzeri olan par\xE7alar\u0131 \xF6nerme. reason alan\u0131nda hangi mevcut par\xE7alarla nas\u0131l kombinlenece\u011Fini 2 c\xFCmleyle a\xE7\u0131kla.`,
      schema: suggestionSchema(target)
    });
    model = info.model;
    raw = (data?.suggestions || []).filter((s) => s && typeof s.name === "string" && (target === "any" || s.category === target));
  } catch {
    usedFallback = true;
  }
  if (raw.length === 0) {
    usedFallback = true;
    raw = STAPLES.filter((s) => target === "any" || s.category === target);
  }
  const evaluated = raw.slice(0, 13).map((s, index) => {
    const item = virtualItem(s, index);
    const gain = contributionOf(item, items);
    const gainType = ["top", "bottom", "onepiece", "shoes"].includes(item.category) ? "new_outfits" : "pairings";
    const reason = s.reason || (gainType === "new_outfits" ? `Mevcut par\xE7alar\u0131nla ${gain} yeni giyilebilir kombin olu\u015Fturuyor.` : `Mevcut ${gain} kombininle uyumlu bir tamamlay\u0131c\u0131 par\xE7a.`);
    return {
      name: String(s.name).slice(0, 80),
      category: item.category,
      subCategory: item.subCategory,
      colorFamily: item.colorFamily || UNKNOWN,
      colorHex: item.colorHex,
      material: item.material,
      pattern: item.pattern,
      fit: item.fit,
      style: item.style,
      formality: item.formality,
      warmth: item.warmth,
      reason: String(reason).slice(0, 400),
      gain,
      gainType
    };
  }).filter((s) => s.gain > 0).sort((a, b) => b.gain - a.gain).slice(0, 3);
  const best = evaluated[0];
  return {
    insufficient: false,
    currentOutfitCount: current.count,
    estimated: current.estimated,
    suggestions: evaluated,
    model,
    usedFallback,
    projectedOutfitCount: best ? current.count + (best.gainType === "new_outfits" ? best.gain : 0) : current.count,
    suggestedItem: best ? { name: best.name, category: best.category, reason: best.reason } : void 0
  };
}

// backend/engine/collab.ts
var pairKey2 = (a, b) => [a, b].sort((x, y) => x.localeCompare(y, "tr")).join("|");
var GOOD_ACCENT_PAIRS = /* @__PURE__ */ new Set([
  pairKey2("mavi", "turuncu"),
  pairKey2("mor", "sar\u0131"),
  pairKey2("bordo", "ye\u015Fil"),
  pairKey2("pembe", "ye\u015Fil"),
  pairKey2("mavi", "pembe"),
  pairKey2("bordo", "pembe"),
  pairKey2("mavi", "sar\u0131"),
  pairKey2("bordo", "k\u0131rm\u0131z\u0131")
]);
function dominant(outfit) {
  const garments = outfit.items.filter((i) => ["top", "bottom", "onepiece", "outerwear"].includes(i.category));
  const colors = /* @__PURE__ */ new Map();
  for (const item of garments) {
    if (!item.colorFamily) continue;
    const weight = item.category === "outerwear" ? 2 : 1;
    colors.set(item.colorFamily, (colors.get(item.colorFamily) || 0) + weight);
  }
  const color = Array.from(colors.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const main = garments.find((i) => i.category === "onepiece") || garments.find((i) => i.category === "top") || garments[0];
  const formality = garments.reduce((s, i) => s + i.formality, 0) / Math.max(1, garments.length);
  return { color, style: main?.style || "casual", formality };
}
function pairHarmony(a, b) {
  const da = dominant(a);
  const db = dominant(b);
  let color = 70;
  if (da.color && db.color) {
    const aNeutral = NEUTRAL_COLOR_FAMILIES.includes(da.color);
    const bNeutral = NEUTRAL_COLOR_FAMILIES.includes(db.color);
    if (da.color === db.color) color = 86;
    else if (aNeutral && bNeutral) color = 80;
    else if (aNeutral || bNeutral) color = 82;
    else color = GOOD_ACCENT_PAIRS.has(pairKey2(da.color, db.color)) ? 84 : 55;
  }
  const formality = Math.max(0, 100 - 22 * Math.abs(da.formality - db.formality));
  const style = 40 + 60 * styleCompat(da.style, db.style);
  return Math.round(0.45 * color + 0.35 * formality + 0.2 * style);
}
function rankPairs(mine, theirs, limit = 5) {
  const pairs = [];
  for (const m of mine) {
    for (const t of theirs) {
      const score = Math.round(0.5 * ((m.breakdown.total + t.breakdown.total) / 2) + 0.5 * pairHarmony(m, t));
      pairs.push({ mine: m, theirs: t, score });
    }
  }
  return pairs.sort((a, b) => b.score - a.score).slice(0, limit);
}
function harmonyLabel(pair) {
  const a = dominant(pair.mine).color;
  const b = dominant(pair.theirs).color;
  if (a && a === b) return `Ton-s\xFCr-ton ${a} uyumu`;
  if (a && b && NEUTRAL_COLOR_FAMILIES.includes(a) && NEUTRAL_COLOR_FAMILIES.includes(b)) return "N\xF6tr tonlarda sakin uyum";
  return "Dengeli renk e\u015Fle\u015Fmesi";
}
async function generateCollab(initiator, friend, rawRequest) {
  const request = sanitizeStylistRequest(rawRequest);
  const mineRun = await runEngine(initiator, { ...request, requiredItems: [], lockedItems: [], excludedItems: [] }, { mode: "deterministic", candidateLimit: 6 });
  const friendRun = await runEngine(
    { _id: friend._id },
    { ...request, location: void 0, requiredItems: [], lockedItems: [], excludedItems: [], recentOutfits: [] },
    { mode: "deterministic", candidateLimit: 6 }
  );
  const weather = mineRun.ctx.weather;
  const pairs = rankPairs(mineRun.candidates, friendRun.candidates, 5);
  const warnings = [...mineRun.warnings];
  let chosen = pairs[0];
  let reason = "";
  let label = harmonyLabel(chosen);
  let model = null;
  let usedFallback = false;
  try {
    const pairIds = pairs.map((_, i) => `P${i + 1}`);
    const describe = (outfit) => outfit.items.map((i) => `    ${describeItemForPrompt(i, false)}`).join("\n");
    const { data, info } = await generateJson({
      task: "stylist",
      label: "collab_pick",
      systemInstruction: "Sen iki ki\u015Filik kombin uyumunda uzman bir stilistsin. T\xFCrk\xE7e, samimi ve k\u0131sa yazars\u0131n. Teknik kimliklerden veya puanlardan bahsetmezsin.",
      contents: `Etkinlik: ${mineRun.ctx.eventLabel}. ${weather ? `Hava: ${weather.condition}, hissedilen ${weather.feelsLikeC}\xB0C.` : ""}

\u0130ki ki\u015Finin birlikte kat\u0131laca\u011F\u0131 etkinlik i\xE7in haz\u0131rlanm\u0131\u015F kombin \xE7iftleri:

${pairs.map((p, i) => `${pairIds[i]}:
  ${initiator.name || "Birinci ki\u015Fi"}:
${describe(p.mine)}
  ${friend.name || "\u0130kinci ki\u015Fi"}:
${describe(p.theirs)}`).join("\n\n")}

Birlikte en uyumlu g\xF6r\xFCnecek \xE7ifti se\xE7. styleHarmony: \xE7ifti \xF6zetleyen en fazla 5 kelimelik etiket. collabReason: iki kombinin neden birlikte uyumlu oldu\u011Funu 3 c\xFCmleyle a\xE7\u0131kla.`,
      schema: {
        type: "object",
        properties: {
          pairId: { type: "string", enum: pairIds },
          styleHarmony: { type: "string" },
          collabReason: { type: "string" }
        },
        required: ["pairId", "styleHarmony", "collabReason"]
      }
    });
    const index = pairIds.indexOf(data.pairId);
    if (index >= 0 && data.collabReason?.trim()) {
      chosen = pairs[index];
      reason = data.collabReason.trim().slice(0, 700);
      label = (data.styleHarmony || label).trim().slice(0, 60);
      model = info.model;
    } else {
      usedFallback = true;
    }
  } catch {
    usedFallback = true;
    warnings.push("AI stilist \u015Fu an yan\u0131t veremedi; \xE7ift kural motoruyla se\xE7ildi.");
  }
  if (!reason) {
    reason = `${label}: iki kombinin bask\u0131n renkleri ve resmiyet d\xFCzeyleri birbirine yak\u0131n, bu y\xFCzden yan yana dengeli g\xF6r\xFCn\xFCyor. Etkinlik (${mineRun.ctx.eventLabel.toLocaleLowerCase("tr-TR")}) i\xE7in ikisi de uygun seviyede.`;
  }
  return {
    myOutfit: chosen.mine.itemIds,
    friendOutfit: chosen.theirs.itemIds,
    myItems: chosen.mine.items,
    friendItems: chosen.theirs.items,
    compatibilityScore: chosen.score,
    collabReason: reason,
    styleHarmony: label,
    weather,
    model,
    usedFallback,
    warnings
  };
}

// backend/vision.ts
import { MediaResolution as MediaResolution2 } from "@google/genai";
import pngjs from "pngjs";
var { PNG } = pngjs;
var COLOR_FAMILY_OPTIONS = COLOR_FAMILIES;
var VISION_SCHEMA = {
  type: "object",
  properties: {
    isClothing: { type: "boolean" },
    name: { type: "string" },
    category: { type: "string", enum: [...CATEGORIES] },
    subCategory: { type: "string" },
    color: { type: "string" },
    colorFamily: { type: "string", enum: [...COLOR_FAMILIES] },
    colorHex: { type: "string" },
    secondaryColors: { type: "array", maxItems: 3, items: { type: "string", enum: [...COLOR_FAMILIES] } },
    material: { type: "string" },
    pattern: { type: "string", enum: [...PATTERNS] },
    fit: { type: "string", enum: [...FITS] },
    style: { type: "string", enum: [...STYLES] },
    formality: { type: "integer", minimum: 1, maximum: 5 },
    warmth: { type: "integer", minimum: 1, maximum: 5 },
    waterResistant: { type: "boolean" },
    layerRole: { type: "string", enum: [...LAYER_ROLES] },
    seasons: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", enum: [...SEASONS] } }
  },
  required: [
    "isClothing",
    "name",
    "category",
    "subCategory",
    "color",
    "colorFamily",
    "colorHex",
    "secondaryColors",
    "material",
    "pattern",
    "fit",
    "style",
    "formality",
    "warmth",
    "waterResistant",
    "layerRole",
    "seasons"
  ]
};
var VISION_PROMPT = `Bu foto\u011Fraftaki ana k\u0131yafet veya aksesuar\u0131 analiz et. Foto\u011Frafta k\u0131yafet, ayakkab\u0131, aksesuar veya makyaj \xFCr\xFCn\xFC yoksa isClothing=false yap.

Alanlar:
- name: k\u0131sa T\xFCrk\xE7e ad (\xF6r. "Lacivert slim fit g\xF6mlek")
- category: top (ti\u015F\xF6rt, g\xF6mlek, bluz, kazak, sweatshirt), bottom (pantolon, jean, etek, \u015Fort), onepiece (elbise, tulum), outerwear (mont, kaban, ceket, blazer, tren\xE7kot, ya\u011Fmurluk), shoes, accessory (\xE7anta, kemer, \u015Fapka, tak\u0131, atk\u0131), makeup
- subCategory: T\xFCrk\xE7e t\xFCr ad\u0131 (\xF6r. "g\xF6mlek", "kot pantolon", "chelsea bot")
- color: T\xFCrk\xE7e renk ad\u0131 (\xF6r. "a\xE7\u0131k mavi"); colorFamily: listedeki en yak\u0131n renk ailesi; colorHex: bask\u0131n rengin #RRGGBB kodu; secondaryColors: belirgin ikincil renk aileleri (yoksa bo\u015F liste)
- material: T\xFCrk\xE7e kuma\u015F/malzeme (\xF6r. "pamuk", "y\xFCn", "deri"); anla\u015F\u0131lm\u0131yorsa "belirsiz"
- pattern, fit: listeden; k\u0131yafet olmayan \xFCr\xFCnlerde veya anla\u015F\u0131lm\u0131yorsa "belirsiz"
- style: listeden en yak\u0131n stil
- formality: 1 (spor/ev) \u2026 3 (smart casual) \u2026 5 (resmi/gece)
- warmth: 1 (\xE7ok ince, yazl\u0131k) \u2026 3 (orta) \u2026 5 (\xE7ok kal\u0131n, k\u0131\u015Fl\u0131k)
- waterResistant: ya\u011Fmurda \u0131slanmay\u0131 \xF6nleyen bir malzeme mi (deri, naylon, su ge\xE7irmez kuma\u015F)
- layerRole: base (tek ba\u015F\u0131na/i\xE7 kat), mid (g\xF6mlek, h\u0131rka gibi ba\u015Fka bir \u015Feyin \xFCst\xFCne giyilebilen), outer (d\u0131\u015F katman), none (ayakkab\u0131, aksesuar, makyaj)
- seasons: uygun oldu\u011Fu mevsimler

Emin olmad\u0131\u011F\u0131n metin alanlar\u0131nda "belirsiz" kullan; g\xF6rmedi\u011Fin bir \xF6zelli\u011Fi uydurma.`;
var pick = (value, options, fallback) => typeof value === "string" && options.includes(value) ? value : fallback;
var scale2 = (value, fallback) => typeof value === "number" && Number.isFinite(value) ? Math.min(5, Math.max(1, Math.round(value))) : fallback;
var text = (value, max, fallback = "") => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
function normalizeVisionOutput(raw) {
  const category = pick(raw?.category, CATEGORIES, "top");
  const color = text(raw?.color, 40);
  let colorFamily = pick(raw?.colorFamily, COLOR_FAMILY_OPTIONS, "");
  if (!colorFamily) colorFamily = colorFamilyFromName(color) || "gri";
  const garment = ["top", "bottom", "onepiece", "outerwear"].includes(category);
  return {
    isClothing: raw?.isClothing !== false,
    name: text(raw?.name, 80, "Yeni par\xE7a"),
    category,
    subCategory: text(raw?.subCategory, 60, UNKNOWN),
    color: color || colorFamily,
    colorFamily,
    colorHex: isValidHex(raw?.colorHex) ? raw.colorHex.toUpperCase() : null,
    secondaryColors: Array.isArray(raw?.secondaryColors) ? Array.from(new Set(raw.secondaryColors.filter((c) => typeof c === "string" && COLOR_FAMILY_OPTIONS.includes(c) && c !== colorFamily))).slice(0, 3) : [],
    material: text(raw?.material, 60, UNKNOWN),
    pattern: garment ? pick(raw?.pattern, PATTERNS, UNKNOWN) : UNKNOWN,
    fit: garment ? pick(raw?.fit, FITS, UNKNOWN) : UNKNOWN,
    style: pick(raw?.style, STYLES, "casual"),
    formality: scale2(raw?.formality, 2),
    warmth: scale2(raw?.warmth, 3),
    waterResistant: raw?.waterResistant === true,
    layerRole: category === "outerwear" ? "outer" : ["shoes", "accessory", "makeup"].includes(category) ? "none" : pick(raw?.layerRole, LAYER_ROLES, "base"),
    seasons: Array.isArray(raw?.seasons) ? Array.from(new Set(raw.seasons.filter((s) => typeof s === "string" && SEASONS.includes(s)))) : []
  };
}
async function analyzeClothingImage(base64, mimeType) {
  const { data, info } = await generateJson({
    task: "vision",
    label: "vision_tag",
    contents: [{ inlineData: { mimeType, data: base64 } }, { text: VISION_PROMPT }],
    schema: VISION_SCHEMA,
    mediaResolution: MediaResolution2.MEDIA_RESOLUTION_MEDIUM
  });
  return { analysis: normalizeVisionOutput(data), model: info.model };
}
var ANALYSIS_FIELDS = [
  "subCategory",
  "color",
  "colorFamily",
  "colorHex",
  "secondaryColors",
  "material",
  "pattern",
  "fit",
  "style",
  "formality",
  "warmth",
  "waterResistant",
  "layerRole",
  "seasons"
];
var isEmptyValue = (value) => value === void 0 || value === null || value === "" || Array.isArray(value) && value.length === 0;
function applyAnalysisToItem(doc, analysis, options = {}) {
  if (isEmptyValue(doc.name)) doc.name = analysis.name;
  if (isEmptyValue(doc.category)) doc.category = analysis.category;
  for (const field of ANALYSIS_FIELDS) {
    if (options.overwrite || isEmptyValue(doc[field])) doc[field] = analysis[field];
  }
  doc.weatherMatch = deriveWeatherMatch(doc);
  doc.aiAnalyzed = true;
}
function itemNeedsEnrichment(doc) {
  return missingFields(doc).length > 0;
}

// server.ts
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const userId = req.user?.id || "public";
    const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const originalNameClean = file.originalname.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_\-.]/g, "");
    const cleanPublicId = originalNameClean.replace(/\.[^/.]+$/, "");
    return {
      folder: `digital_wardrobe/${userId}`,
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      public_id: `${cleanPublicId}_${uniqueId}`
    };
  }
});
var upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });
var FALLBACK_JWT_SECRET = "Hnc3Mxz9wO3WfpYRs4LTgme8bZXbsBAcknOunOfIPGsMqg3kqyjg08CHJBKp/olM";
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim().length >= 32) {
    return secret.trim();
  }
  return FALLBACK_JWT_SECRET;
}
var JWT_SECRET = getJwtSecret();
var LEGACY_OWNER_EMAIL = "samet@aura.com";
async function runMigration() {
  try {
    const usersWithoutUsername = await UserModel.find({ username: { $exists: false } });
    for (const u of usersWithoutUsername) {
      const emailPrefix = u.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      const uniqueSuffix = Math.random().toString(36).slice(2, 6);
      u.username = `${emailPrefix}_${uniqueSuffix}`;
      await u.save();
      console.log(`[Migration] ${u.email} kullan\u0131c\u0131s\u0131na default kullan\u0131c\u0131 ad\u0131 (${u.username}) tan\u0131mland\u0131.`);
    }
    const usersWithoutPrivacy = await UserModel.find({ isPrivate: { $exists: false } });
    if (usersWithoutPrivacy.length > 0) {
      await UserModel.updateMany({ isPrivate: { $exists: false } }, { $set: { isPrivate: false } });
      console.log(`[Migration] ${usersWithoutPrivacy.length} kullan\u0131c\u0131n\u0131n gizlilik ayar\u0131 varsay\u0131lan (false) yap\u0131ld\u0131.`);
    }
    const itemsWithoutUser = await ItemModel.find({ userId: { $exists: false } });
    const outfitsWithoutUser = await OutfitModel.find({ userId: { $exists: false } });
    if (itemsWithoutUser.length === 0 && outfitsWithoutUser.length === 0) return;
    const legacyOwner = await UserModel.findOne({ email: LEGACY_OWNER_EMAIL });
    if (!legacyOwner) {
      console.warn(`[Migration] ${LEGACY_OWNER_EMAIL} hesab\u0131 bulunamad\u0131; sahipsiz kay\u0131tlar ba\u011Flanmadan b\u0131rak\u0131ld\u0131.`);
      return;
    }
    if (itemsWithoutUser.length > 0) {
      console.log(`[Migration] ${itemsWithoutUser.length} adet sahipsiz gard\u0131rop \xF6\u011Fesi ${LEGACY_OWNER_EMAIL} hesab\u0131na ba\u011Flan\u0131yor...`);
      await ItemModel.updateMany({ userId: { $exists: false } }, { $set: { userId: legacyOwner._id } });
      console.log("[Migration] Gard\u0131rop \xF6\u011Feleri ba\u015Far\u0131yla g\xFCncellendi.");
    }
    if (outfitsWithoutUser.length > 0) {
      console.log(`[Migration] ${outfitsWithoutUser.length} adet sahipsiz kombin ${LEGACY_OWNER_EMAIL} hesab\u0131na ba\u011Flan\u0131yor...`);
      await OutfitModel.updateMany({ userId: { $exists: false } }, { $set: { userId: legacyOwner._id } });
      console.log("[Migration] Kombinler ba\u015Far\u0131yla g\xFCncellendi.");
    }
  } catch (err) {
    console.error("[Migration] Hata olu\u015Ftu:", err);
  }
}
setOnFirstConnect(runMigration);
connectToDatabase().catch((err) => console.error("[MongoDB] \u0130lk ba\u011Flant\u0131 hatas\u0131:", err));
async function analyzeImageData(base64, mimeType) {
  try {
    const { analysis } = await analyzeClothingImage(base64, mimeType);
    return analysis;
  } catch (err) {
    console.error("[Vision] Analiz hatas\u0131:", err);
    return null;
  }
}
async function analyzeImageUrl(url) {
  try {
    const downloaded = await downloadOwnImage(url);
    if (!downloaded) return null;
    return analyzeImageData(downloaded.base64, downloaded.mimeType);
  } catch (e) {
    console.error("[Vision] Foto\u011Fraf indirilirken hata:", e);
    return null;
  }
}
var app = express();
var PORT = 3e3;
var allowedOrigins = [
  process.env.APP_URL,
  "https://samethabali.github.io",
  "https://aura-mobile.expo.app",
  "exp://aura-mobile.expo.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8081",
  "exp://localhost:8081"
];
app.use(cors({
  origin: function(origin, callback) {
    const isVercel = origin && origin.endsWith(".vercel.app");
    const isLocalIp = origin && (origin.startsWith("http://192.168.") || origin.startsWith("exp://192.168.") || origin.startsWith("http://172.") || origin.startsWith("exp://172.") || origin.startsWith("http://10.") || origin.startsWith("exp://10."));
    if (!origin || allowedOrigins.includes(origin) || isVercel || isLocalIp) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Engellenen origin: ${origin}`);
      callback(null, false);
    }
  }
}));
app.use(express.json({ limit: "20mb" }));
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    console.error("[MongoDB Middleware] Ba\u011Flant\u0131 kurulamad\u0131:", err);
    res.status(500).json({ error: "Veritaban\u0131 ba\u011Flant\u0131s\u0131 kurulamad\u0131. L\xFCtfen daha sonra tekrar deneyin." });
  }
});
app.use((req, res, next) => {
  console.log(`[Server] ${req.method} ${req.url}`);
  next();
});
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Eri\u015Fim engellendi. Token eksik." });
  }
  jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Ge\xE7ersiz veya s\xFCresi dolmu\u015F token." });
    }
    req.user = user;
    next();
  });
}
var MINUTE = 60 * 1e3;
var HOUR = 60 * MINUTE;
var RATE_LIMITS = {
  register: { max: 10, windowMs: HOUR },
  // IP başına
  login: { max: 10, windowMs: 15 * MINUTE },
  // IP + e-posta başına
  generateOutfit: { max: 60, windowMs: HOUR },
  // Kullanıcı başına (aşağıdakilerin hepsi)
  analyzeImage: { max: 60, windowMs: HOUR },
  upload: { max: 60, windowMs: HOUR },
  capsuleAnalysis: { max: 20, windowMs: HOUR },
  collabGenerate: { max: 20, windowMs: HOUR },
  enrich: { max: 5, windowMs: HOUR }
};
function getClientIp(req) {
  const realIp = req.headers["x-real-ip"];
  if (process.env.VERCEL && typeof realIp === "string" && realIp) return realIp;
  return req.socket.remoteAddress || "unknown";
}
async function incrementRateCounter(key, expiresAt) {
  const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt } };
  const options = { upsert: true, returnDocument: "after" };
  try {
    return await RateLimitModel.findOneAndUpdate({ key }, update, options);
  } catch (err) {
    if (err?.code === 11e3) return await RateLimitModel.findOneAndUpdate({ key }, update, options);
    throw err;
  }
}
function rateLimit(bucket, limit, getIdentity) {
  return async (req, res, next) => {
    const windowStart = Math.floor(Date.now() / limit.windowMs) * limit.windowMs;
    const windowEnd = windowStart + limit.windowMs;
    try {
      const counter = await incrementRateCounter(`${bucket}:${getIdentity(req)}:${windowStart}`, new Date(windowEnd));
      if (counter.count > limit.max) {
        const retryAfterSec = Math.ceil((windowEnd - Date.now()) / 1e3);
        res.setHeader("Retry-After", String(retryAfterSec));
        return res.status(429).json({ error: `\xC7ok fazla istek g\xF6nderdin. L\xFCtfen ${Math.ceil(retryAfterSec / 60)} dakika sonra tekrar dene.` });
      }
      next();
    } catch (err) {
      console.error(`[RateLimit] ${bucket} sayac\u0131 g\xFCncellenemedi:`, err);
      res.status(503).json({ error: "\u0130stek \u015Fu an i\u015Flenemiyor. L\xFCtfen biraz sonra tekrar dene." });
    }
  };
}
var byUser = (req) => req.user.id;
var byIp = (req) => getClientIp(req);
var byIpAndEmail = (req) => `${getClientIp(req)}:${String(req.body?.email || "").trim().toLowerCase()}`;
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  app.get("/api/debug-models", async (_req, res) => {
    try {
      res.json({
        stylist: modelsFor("stylist"),
        vision: modelsFor("vision"),
        light: modelsFor("light")
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
app.post("/api/auth/register", rateLimit("register", RATE_LIMITS.register, byIp), async (req, res) => {
  try {
    let { email, password, name, username } = req.body;
    if (!email || !password || !name || !username) {
      return res.status(400).json({ error: "L\xFCtfen t\xFCm alanlar\u0131 doldurun." });
    }
    email = String(email).trim().toLowerCase();
    password = String(password).trim();
    name = String(name).trim();
    const cleanUsername = String(username).trim().toLowerCase().replace(/\s+/g, "");
    if (!email || !password || !name || !cleanUsername) {
      return res.status(400).json({ error: "L\xFCtfen t\xFCm alanlar\u0131 ge\xE7erli de\u011Ferlerle doldurun." });
    }
    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: "Kullan\u0131c\u0131 ad\u0131 en az 3 karakter olmal\u0131d\u0131r." });
    }
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Bu e-posta adresi zaten kullan\u0131mda." });
    }
    const existingUsername = await UserModel.findOne({ username: cleanUsername });
    if (existingUsername) {
      return res.status(400).json({ error: "Bu kullan\u0131c\u0131 ad\u0131 zaten al\u0131nm\u0131\u015F." });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new UserModel({
      email: email.toLowerCase(),
      username: cleanUsername,
      passwordHash,
      name,
      createdAt: /* @__PURE__ */ new Date()
    });
    await newUser.save();
    const token = jwt.sign(
      { id: newUser._id.toString(), email: newUser.email, username: newUser.username, name: newUser.name, isPrivate: false },
      JWT_SECRET,
      { expiresIn: "30d" }
    );
    res.json({
      success: true,
      token,
      user: {
        id: newUser._id.toString(),
        email: newUser.email,
        username: newUser.username,
        name: newUser.name,
        isPrivate: false
      }
    });
  } catch (err) {
    console.error("[Register] Hata:", err);
    res.status(500).json({ error: "Kay\u0131t i\u015Flemi ba\u015Far\u0131s\u0131z oldu." });
  }
});
app.post("/api/auth/login", rateLimit("login", RATE_LIMITS.login, byIpAndEmail), async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "E-posta ve \u015Fifre gereklidir." });
    }
    email = String(email).trim().toLowerCase();
    password = String(password).trim();
    if (!email || !password) {
      return res.status(400).json({ error: "E-posta ve \u015Fifre bo\u015F b\u0131rak\u0131lamaz." });
    }
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Hatal\u0131 e-posta veya \u015Fifre." });
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Hatal\u0131 e-posta veya \u015Fifre." });
    }
    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, username: user.username || "", name: user.name, isPrivate: user.isPrivate || false },
      JWT_SECRET,
      { expiresIn: "30d" }
    );
    res.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username || "",
        name: user.name,
        isPrivate: user.isPrivate || false
      }
    });
  } catch (err) {
    console.error("[Login] Hata:", err);
    res.status(500).json({ error: "Giri\u015F i\u015Flemi ba\u015Far\u0131s\u0131z oldu." });
  }
});
app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const user = await UserModel.findOne({ _id: req.user.id });
    if (!user) return res.status(404).json({ error: "Kullan\u0131c\u0131 bulunamad\u0131." });
    res.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username || "",
        name: user.name,
        isPrivate: user.isPrivate || false
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatas\u0131." });
  }
});
app.put("/api/auth/profile", authenticateToken, async (req, res) => {
  try {
    const { email, username, name, password, isPrivate } = req.body;
    const user = await UserModel.findOne({ _id: req.user.id });
    if (!user) return res.status(404).json({ error: "Kullan\u0131c\u0131 bulunamad\u0131." });
    if (email && email.toLowerCase() !== user.email) {
      const existingEmail = await UserModel.findOne({ email: email.toLowerCase() });
      if (existingEmail) return res.status(400).json({ error: "Bu e-posta zaten kullan\u0131mda." });
      user.email = email.toLowerCase();
    }
    if (username && username.trim().toLowerCase() !== user.username) {
      const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, "");
      if (cleanUsername.length < 3) return res.status(400).json({ error: "Kullan\u0131c\u0131 ad\u0131 en az 3 karakter olmal\u0131d\u0131r." });
      const existingUsername = await UserModel.findOne({ username: cleanUsername });
      if (existingUsername) return res.status(400).json({ error: "Bu kullan\u0131c\u0131 ad\u0131 zaten al\u0131nm\u0131\u015F." });
      user.username = cleanUsername;
    }
    if (name) {
      user.name = name;
    }
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: "\u015Eifre en az 6 karakter olmal\u0131d\u0131r." });
      user.passwordHash = await bcrypt.hash(password, 10);
    }
    if (typeof isPrivate === "boolean") {
      user.isPrivate = isPrivate;
    }
    await user.save();
    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, username: user.username, name: user.name, isPrivate: user.isPrivate },
      JWT_SECRET,
      { expiresIn: "30d" }
    );
    res.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        name: user.name,
        isPrivate: user.isPrivate
      }
    });
  } catch (err) {
    console.error("[Profile Update] Hata:", err);
    res.status(500).json({ error: "Profil g\xFCncellenemedi." });
  }
});
app.delete("/api/auth/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const items = await ItemModel.find({ userId });
    const publicIds = items.map((item) => getOwnedPublicId(item.imagePath, userId)).filter(Boolean);
    if (publicIds.length > 0) {
      console.log(`[Account Delete] ${publicIds.length} adet g\xF6rsel Cloudinary'den siliniyor...`);
      try {
        await cloudinary.api.delete_resources(publicIds);
      } catch (cloudinaryErr) {
        console.error("[Account Delete] Cloudinary g\xF6rselleri silinirken hata:", cloudinaryErr);
      }
    }
    await ItemModel.deleteMany({ userId });
    await OutfitModel.deleteMany({ userId });
    await deletePersonalizationData(userId);
    await UserModel.deleteOne({ _id: userId });
    console.log(`[Account Delete] ${req.user.email} hesab\u0131 ve t\xFCm verileri silindi.`);
    res.json({ success: true, message: "Hesab\u0131n\u0131z ve t\xFCm verileriniz ba\u015Far\u0131yla silindi." });
  } catch (err) {
    console.error("[Account Delete] Hata:", err);
    res.status(500).json({ error: "Hesap silme i\u015Flemi ba\u015Far\u0131s\u0131z oldu." });
  }
});
app.get("/api/users/explore", authenticateToken, async (req, res) => {
  try {
    const users = await UserModel.find({
      _id: { $ne: req.user.id },
      isPrivate: { $ne: true }
    }).select("-passwordHash").sort({ createdAt: -1 });
    const exploreProfiles = await Promise.all(users.map(async (u) => {
      const itemCount = await ItemModel.countDocuments({ userId: u._id });
      return {
        id: u._id.toString(),
        name: u.name,
        username: u.username,
        createdAt: u.createdAt,
        itemCount
      };
    }));
    res.json({ success: true, profiles: exploreProfiles });
  } catch (err) {
    console.error("[Explore] Error:", err);
    res.status(500).json({ error: "Ke\u015Ffet profilleri al\u0131namad\u0131." });
  }
});
app.get("/api/users/explore/:userId/wardrobe", authenticateToken, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const targetUser = await UserModel.findOne({ _id: targetUserId });
    if (!targetUser) {
      return res.status(404).json({ error: "Kullan\u0131c\u0131 bulunamad\u0131." });
    }
    if (targetUser.isPrivate) {
      return res.status(403).json({ error: "Bu profil gizlidir ve gard\u0131robuna eri\u015Filemez." });
    }
    const items = await ItemModel.find({ userId: targetUserId }).limit(200).sort({ _id: -1 });
    res.json({
      success: true,
      user: {
        id: targetUser._id.toString(),
        name: targetUser.name,
        username: targetUser.username
      },
      items
    });
  } catch (err) {
    console.error("[Explore Wardrobe] Error:", err);
    res.status(500).json({ error: "Gard\u0131rop verileri al\u0131namad\u0131." });
  }
});
app.post("/api/collab/generate", authenticateToken, rateLimit("collab", RATE_LIMITS.collabGenerate, byUser), async (req, res) => {
  try {
    const { friendUserId, event, effort, mood, ignoreWeather, location } = req.body;
    if (!friendUserId) return res.status(400).json({ error: "Arkada\u015F ID'si gereklidir." });
    const initiator = await UserModel.findOne({ _id: req.user.id });
    if (!initiator) return res.status(404).json({ error: "Kullan\u0131c\u0131 bulunamad\u0131." });
    const friend = await UserModel.findOne({ _id: friendUserId });
    if (!friend) return res.status(404).json({ error: "Arkada\u015F bulunamad\u0131." });
    if (friend.isPrivate) {
      return res.status(403).json({ error: "Bu kullan\u0131c\u0131n\u0131n profili gizlidir." });
    }
    const collabResult = await generateCollab(initiator, friend, {
      event,
      effort,
      mood,
      ignoreWeather,
      location
    });
    const collabId = `collab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const session = new CollabSessionModel({
      id: collabId,
      initiatorId: initiator._id,
      initiatorName: initiator.name,
      friendId: friend._id,
      friendName: friend.name,
      event: event || "G\xFCndelik",
      effort: effort || 5,
      mood: mood || "Rahat",
      myOutfit: collabResult.myOutfit,
      friendOutfit: collabResult.friendOutfit,
      compatibilityScore: collabResult.compatibilityScore,
      collabReason: collabResult.collabReason,
      styleHarmony: collabResult.styleHarmony,
      seenByFriend: false,
      createdAt: /* @__PURE__ */ new Date()
    });
    await session.save();
    console.log(`[Collab] ${initiator.name} + ${friend.name} \u2192 ${collabId} (Uyum: %${collabResult.compatibilityScore})`);
    res.json({
      success: true,
      collabId,
      session,
      myOutfit: collabResult.myOutfit,
      friendOutfit: collabResult.friendOutfit,
      myItems: collabResult.myItems,
      friendItems: collabResult.friendItems,
      compatibilityScore: collabResult.compatibilityScore,
      collabReason: collabResult.collabReason,
      styleHarmony: collabResult.styleHarmony,
      friendName: friend.name,
      initiatorName: initiator.name,
      weather: collabResult.weather,
      warnings: collabResult.warnings
    });
  } catch (err) {
    console.error("[Collab Generate] Hata:", err);
    res.status(err?.status || 500).json({ error: "Beraber kombin olu\u015Fturulamad\u0131.", details: err instanceof Error ? err.message : "Unknown" });
  }
});
app.get("/api/collab/inbox", authenticateToken, async (req, res) => {
  try {
    const sessions = await CollabSessionModel.find({ friendId: req.user.id }).sort({ createdAt: -1 }).limit(20);
    const unreadCount = sessions.filter((s) => !s.seenByFriend).length;
    res.json({
      success: true,
      sessions: sessions.map((s) => ({
        id: s.id,
        initiatorId: s.initiatorId?.toString(),
        initiatorName: s.initiatorName,
        friendId: s.friendId?.toString(),
        friendName: s.friendName,
        event: s.event,
        effort: s.effort,
        mood: s.mood,
        myOutfit: s.myOutfit,
        friendOutfit: s.friendOutfit,
        compatibilityScore: s.compatibilityScore,
        collabReason: s.collabReason,
        styleHarmony: s.styleHarmony,
        seenByFriend: s.seenByFriend,
        createdAt: s.createdAt
      })),
      unreadCount
    });
  } catch (err) {
    console.error("[Collab Inbox] Hata:", err);
    res.status(500).json({ error: "Collab bildirimleri al\u0131namad\u0131." });
  }
});
app.patch("/api/collab/:id/seen", authenticateToken, async (req, res) => {
  try {
    const session = await CollabSessionModel.findOne({ id: req.params.id });
    if (!session) return res.status(404).json({ error: "Collab bulunamad\u0131." });
    if (session.friendId?.toString() !== req.user.id) {
      return res.status(403).json({ error: "Bu i\u015Flem i\xE7in yetkiniz yok." });
    }
    session.seenByFriend = true;
    await session.save();
    res.json({ success: true });
  } catch (err) {
    console.error("[Collab Seen] Hata:", err);
    res.status(500).json({ error: "G\xFCncelleme ba\u015Far\u0131s\u0131z." });
  }
});
app.get("/api/collab/sent", authenticateToken, async (req, res) => {
  try {
    const sessions = await CollabSessionModel.find({ initiatorId: req.user.id }).sort({ createdAt: -1 }).limit(20);
    res.json({
      success: true,
      sessions: sessions.map((s) => ({
        id: s.id,
        initiatorId: s.initiatorId?.toString(),
        initiatorName: s.initiatorName,
        friendId: s.friendId?.toString(),
        friendName: s.friendName,
        event: s.event,
        effort: s.effort,
        mood: s.mood,
        myOutfit: s.myOutfit,
        friendOutfit: s.friendOutfit,
        compatibilityScore: s.compatibilityScore,
        collabReason: s.collabReason,
        styleHarmony: s.styleHarmony,
        seenByFriend: s.seenByFriend,
        createdAt: s.createdAt
      }))
    });
  } catch (err) {
    console.error("[Collab Sent] Hata:", err);
    res.status(500).json({ error: "G\xF6nderilen collab'lar al\u0131namad\u0131." });
  }
});
app.get("/api/wardrobe", authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const total = await ItemModel.countDocuments({ userId: req.user.id });
    const items = await ItemModel.find({ userId: req.user.id }).skip(skip).limit(limit).sort({ _id: -1 });
    res.json({
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.get("/api/health", (_req, res) => res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() }));
app.post("/api/wardrobe/scan", authenticateToken, async (_req, res) => {
  res.json({ success: true, added: 0, message: "Tarama art\u0131k desteklenmiyor (Bulut tabanl\u0131)" });
});
app.post("/api/wardrobe/enrich", authenticateToken, rateLimit("enrich", RATE_LIMITS.enrich, byUser), async (req, res) => {
  try {
    const items = await ItemModel.find({ userId: req.user.id });
    const targets = items.filter(itemNeedsEnrichment);
    if (targets.length === 0) {
      return res.json({ success: true, enriched: 0, message: "T\xFCm \xF6\u011Feler zaten eksiksiz." });
    }
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}

`);
    sendEvent({ type: "start", total: targets.length });
    let enriched = 0;
    let failed = 0;
    for (const item of targets) {
      sendEvent({ type: "progress", current: enriched + failed + 1, total: targets.length, name: item.name });
      try {
        const downloaded = item.imagePath ? await downloadOwnImage(item.imagePath) : null;
        if (downloaded) {
          const { analysis } = await analyzeClothingImage(downloaded.base64, downloaded.mimeType);
          applyAnalysisToItem(item, analysis);
          item.enrichAttemptedAt = /* @__PURE__ */ new Date();
          await item.save();
          enriched++;
          sendEvent({ type: "item_done", id: item.id, name: item.name, category: item.category, color: item.color });
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    sendEvent({ type: "done", enriched, failed, message: `${enriched} \xF6\u011Fe tamamland\u0131, ${failed} ba\u015Far\u0131s\u0131z.` });
    res.end();
  } catch (err) {
    console.error("[Enrich] Hata:", err);
    res.status(500).json({ error: "Zenginle\u015Ftirme ba\u015Far\u0131s\u0131z" });
  }
});
app.post("/api/analyze-image-base64", authenticateToken, rateLimit("analyze", RATE_LIMITS.analyzeImage, byUser), async (req, res) => {
  try {
    const { base64, mimeType } = req.body;
    if (!base64 || !mimeType) return res.status(400).json({ error: "base64 ve mimeType gerekli" });
    const { analysis, model } = await analyzeClothingImage(base64, mimeType);
    res.json({ success: true, analysis, ...analysis, model });
  } catch (err) {
    console.error("[Vision Base64] Hata:", err);
    res.status(err?.status || 500).json({ error: "Analiz hatas\u0131", details: err instanceof Error ? err.message : "Unknown" });
  }
});
app.get("/api/capsule-analysis", authenticateToken, rateLimit("capsule", RATE_LIMITS.capsuleAnalysis, byUser), async (req, res) => {
  try {
    const targetCategory = req.query.category || "any";
    const docs = await ItemModel.find({ userId: req.user.id });
    if (docs.length < 5) {
      return res.json({
        insufficient: true,
        message: "Kaps\xFCl gard\u0131rop sim\xFClasyonu yapabilmek i\xE7in dolab\u0131nda en az 5 adet k\u0131yafet bulunmal\u0131d\u0131r. L\xFCtfen biraz daha k\u0131yafet ekle!"
      });
    }
    const items = docs.map(toEngineItem);
    const result = await analyzeCapsule(items, targetCategory);
    res.json(result);
  } catch (err) {
    console.error("[Server] Capsule Analysis Error:", err);
    res.status(500).json({ error: "Kaps\xFCl gard\u0131rop analizi olu\u015Fturulamad\u0131", details: err instanceof Error ? err.message : "Unknown" });
  }
});
app.post("/api/generate-outfit", authenticateToken, rateLimit("generate", RATE_LIMITS.generateOutfit, byUser), async (req, res) => {
  try {
    const rawRequest = req.body.request || req.body;
    const user = await UserModel.findOne({ _id: req.user.id });
    if (!user) return res.status(404).json({ error: "Kullan\u0131c\u0131 bulunamad\u0131" });
    const result = await generateOutfitsForUser(user, rawRequest, { mode: "full" });
    res.json(result);
  } catch (err) {
    console.error("[Server] Generate Outfit Error:", err);
    const status = err?.status || (err?.message?.includes("gard\u0131robuna") ? 422 : 500);
    res.status(status).json({
      error: err?.message || "Kombin olu\u015Fturulamad\u0131",
      details: err instanceof Error ? err.message : "Unknown"
    });
  }
});
app.post("/api/feedback", authenticateToken, async (req, res) => {
  try {
    const { type, generationId, itemIds, itemId, reason, note, context } = req.body;
    if (!type) return res.status(400).json({ error: "type gerekli" });
    const user = await UserModel.findOne({ _id: req.user.id });
    if (!user) return res.status(404).json({ error: "Kullan\u0131c\u0131 bulunamad\u0131" });
    const event = new FeedbackEventModel({
      userId: req.user.id,
      type,
      generationId,
      itemIds,
      itemId,
      reason,
      note,
      context,
      createdAt: /* @__PURE__ */ new Date()
    });
    await event.save();
    if (type === "worn" && Array.isArray(itemIds) && itemIds.length > 0) {
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const wearLog = new WearLogModel({
        userId: req.user.id,
        date: todayStr,
        itemIds,
        source: "suggestion",
        createdAt: /* @__PURE__ */ new Date()
      });
      await wearLog.save();
      await ItemModel.updateMany(
        { id: { $in: itemIds }, userId: req.user.id },
        { $inc: { wearCount: 1 }, $set: { lastWornAt: /* @__PURE__ */ new Date() } }
      );
    }
    res.json({ success: true, eventId: event._id });
  } catch (err) {
    console.error("[Feedback] Hata:", err);
    res.status(500).json({ error: "Geri bildirim kaydedilemedi" });
  }
});
app.post("/api/auth/consents", authenticateToken, async (req, res) => {
  try {
    const { personalization } = req.body;
    const update = {
      "consents.updatedAt": /* @__PURE__ */ new Date()
    };
    if (personalization !== void 0) {
      update["consents.personalization"] = {
        granted: Boolean(personalization),
        at: /* @__PURE__ */ new Date()
      };
    }
    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: req.user.id },
      { $set: update },
      { returnDocument: "after" }
    );
    res.json({ success: true, consents: updatedUser?.consents });
  } catch (err) {
    console.error("[Consents] Hata:", err);
    res.status(500).json({ error: "R\u0131za ayarlar\u0131 kaydedilemedi" });
  }
});
app.post("/api/wardrobe/upload", authenticateToken, rateLimit("upload", RATE_LIMITS.upload, byUser), upload.single("image"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Dosya eksik" });
    const rawUrl = file.path;
    const imagePath = rawUrl.replace("/upload/", "/upload/f_auto,q_auto,w_1200/");
    const itemData = JSON.parse(req.body.itemData || "{}");
    const autoAnalyze = req.body.autoAnalyze === "true" || !itemData.category;
    let analysis = null;
    if (autoAnalyze) {
      console.log("[Upload] Gemini Vision analizi ba\u015Fl\u0131yor...");
      analysis = await analyzeImageUrl(imagePath);
    }
    const newItem = new ItemModel({
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: req.user.id,
      // Eklendi!
      name: itemData.name || analysis?.name || file.originalname,
      category: itemData.category || analysis?.category || "top",
      subCategory: itemData.subCategory || analysis?.subCategory || "",
      color: itemData.color || analysis?.color || "",
      material: itemData.material || analysis?.material || "",
      style: itemData.style || analysis?.style || "",
      pattern: itemData.pattern || analysis?.pattern || "",
      fit: itemData.fit || analysis?.fit || "",
      weatherMatch: itemData.weatherMatch || analysis?.weatherMatch || ["sunny", "cloudy"],
      imagePath,
      attributes: itemData.attributes || {},
      aiAnalyzed: !!analysis
    });
    await newItem.save();
    console.log(`[Upload] \u2713 ${newItem.name} (${newItem.category}) eklendi.`);
    res.json({ success: true, item: newItem });
  } catch (err) {
    console.error("[Upload] Hata:", err);
    res.status(500).json({ error: "Y\xFCkleme ba\u015Far\u0131s\u0131z", details: err instanceof Error ? err.message : "Unknown" });
  }
});
app.delete("/api/wardrobe/:id", authenticateToken, async (req, res) => {
  try {
    const item = await ItemModel.findOne({ id: req.params.id, userId: req.user.id });
    if (!item) {
      return res.status(404).json({ error: "\xD6\u011Fe bulunamad\u0131" });
    }
    const publicId = getOwnedPublicId(item.imagePath, req.user.id);
    if (publicId) {
      console.log(`[Cloudinary] G\xF6rsel siliniyor: ${publicId}`);
      await cloudinary.uploader.destroy(publicId);
    }
    await ItemModel.deleteOne({ id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch (err) {
    console.error("[Delete] Hata:", err);
    res.status(500).json({ error: "Silme ba\u015Far\u0131s\u0131z" });
  }
});
function pickStringFields(body, fields, update) {
  for (const [field, maxLength] of Object.entries(fields)) {
    const value = body?.[field];
    if (value === void 0 || value === null) continue;
    if (typeof value !== "string" || value.length > maxLength) return `Ge\xE7ersiz alan: ${field}`;
    update[field] = value;
  }
  return null;
}
function isStringArray(value, maxItems, maxLength) {
  return Array.isArray(value) && value.length <= maxItems && value.every((v) => typeof v === "string" && v.length <= maxLength);
}
function pickItemUpdate(body) {
  const update = {};
  const error = pickStringFields(body, {
    name: 200,
    category: 50,
    subCategory: 100,
    color: 100,
    material: 100,
    style: 50,
    pattern: 100,
    fit: 50
  }, update);
  if (error) return { error };
  if (body?.weatherMatch !== void 0 && body?.weatherMatch !== null) {
    if (!isStringArray(body.weatherMatch, 10, 30)) return { error: "Ge\xE7ersiz alan: weatherMatch" };
    update.weatherMatch = body.weatherMatch;
  }
  return { update };
}
function pickOutfitUpdate(body) {
  const update = {};
  const error = pickStringFields(body, { name: 200, stylingReason: 2e3 }, update);
  if (error) return { error };
  if (body?.items !== void 0 && body?.items !== null) {
    if (!isStringArray(body.items, 50, 100)) return { error: "Ge\xE7ersiz alan: items" };
    update.items = body.items;
  }
  return { update };
}
app.put("/api/wardrobe/:id", authenticateToken, async (req, res) => {
  try {
    const picked = pickItemUpdate(req.body);
    if ("error" in picked) return res.status(400).json({ error: picked.error });
    const updated = await ItemModel.findOneAndUpdate(
      { id: req.params.id, userId: req.user.id },
      { $set: picked.update },
      { returnDocument: "after" }
    );
    if (!updated) return res.status(404).json({ error: "Bulunamad\u0131" });
    res.json({ success: true, item: updated });
  } catch {
    res.status(500).json({ error: "G\xFCncelleme ba\u015Far\u0131s\u0131z" });
  }
});
app.get("/api/outfits", authenticateToken, async (req, res) => {
  try {
    const outfits = await OutfitModel.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ outfits });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.post("/api/outfits", authenticateToken, async (req, res) => {
  try {
    const newOutfit = new OutfitModel({
      id: `outfit_${Date.now()}`,
      userId: req.user.id,
      // Eklendi!
      name: req.body.name || "Yeni Kombin",
      items: req.body.items || [],
      stylingReason: req.body.stylingReason || "",
      compatibilityScore: req.body.compatibilityScore || 0,
      createdAt: /* @__PURE__ */ new Date()
    });
    await newOutfit.save();
    res.json({ success: true, outfit: newOutfit });
  } catch {
    res.status(500).json({ error: "Kombin kaydetme ba\u015Far\u0131s\u0131z" });
  }
});
app.delete("/api/outfits/:id", authenticateToken, async (req, res) => {
  try {
    await OutfitModel.deleteOne({ id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Silme ba\u015Far\u0131s\u0131z" });
  }
});
app.put("/api/outfits/:id", authenticateToken, async (req, res) => {
  try {
    const picked = pickOutfitUpdate(req.body);
    if ("error" in picked) return res.status(400).json({ error: picked.error });
    const updated = await OutfitModel.findOneAndUpdate(
      { id: req.params.id, userId: req.user.id },
      { $set: picked.update },
      { returnDocument: "after" }
    );
    if (!updated) return res.status(404).json({ error: "Bulunamad\u0131" });
    res.json({ success: true, outfit: updated });
  } catch {
    res.status(500).json({ error: "G\xFCncelleme ba\u015Far\u0131s\u0131z" });
  }
});
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  import("vite").then(({ createServer }) => {
    createServer({ server: { middlewareMode: true }, appType: "spa" }).then((vite) => {
      app.use(vite.middlewares);
      app.listen(PORT, "0.0.0.0", () => console.log(`[Local] Server running on http://localhost:${PORT}`));
    });
  });
}
var server_default = app;
export {
  server_default as default
};
