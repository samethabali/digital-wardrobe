// Web arayüzü ile backend arasındaki istek/yanıt tipleri.
import type { Category, FeedbackReason } from './wardrobe';

export interface WardrobeItemDTO {
  id: string;
  userId?: string;
  name: string;
  category: Category | string;
  subCategory: string;
  color: string;
  colorFamily?: string | null;
  colorHex?: string | null;
  secondaryColors?: string[];
  material?: string;
  style: string;
  pattern?: string;
  fit?: string;
  formality?: number | null;
  warmth?: number | null;
  waterResistant?: boolean | null;
  layerRole?: string | null;
  seasons?: string[];
  weatherMatch: string[];
  price?: number | null;
  imagePath: string;
  cutoutImagePath?: string | null;
  attributes: Record<string, any>;
  aiAnalyzed?: boolean;
  wearCount?: number;
  lastWornAt?: string | null;
  createdAt?: string;
}

export type LocationInput =
  | { type: 'coords'; lat: number; lon: number; label?: string }
  | { type: 'place'; province: string; district?: string }
  | { type: 'text'; query: string };

export interface WeatherSnapshot {
  locationLabel: string;
  latitude: number;
  longitude: number;
  /** Tahminin ait olduğu yerel zaman (YYYY-MM-DDTHH:mm) */
  time: string;
  isForecast: boolean;
  temperatureC: number;
  feelsLikeC: number;
  minC: number | null;
  maxC: number | null;
  precipitationProbability: number | null;
  weatherCode: number;
  condition: string;
  windKmh: number | null;
}

export type TempBand = 'freezing' | 'cold' | 'cool' | 'mild' | 'warm' | 'hot';

export interface StylistRequest {
  location?: LocationInput | string;
  /** Yerel tarih-saat (YYYY-MM-DDTHH:mm). Boşsa şu an kullanılır. */
  dateTime?: string;
  event: string;
  /** Serbest metin etkinlik açıklaması (ör. "akşam çatı katında doğum günü") */
  eventText?: string;
  /** Özen / şıklık düzeyi (1-5) */
  dressiness?: number;
  /** Fiziksel hareket düzeyi (1-5) */
  activity?: number;
  /** Eski istemciler için: 1-10 efor */
  effort?: number;
  mood?: string;
  styleTags?: string[];
  personalContext?: string;
  ignoreWeather?: boolean;
  requiredItems?: string[];
  lockedItems?: string[];
  excludedItems?: string[];
  recentOutfits?: string[][];
}

export interface ScoreBreakdown {
  weather: number | null;
  formality: number;
  color: number;
  style: number;
  silhouette: number;
  preference: number | null;
  variety: number;
  learned: number | null;
  total: number;
}

export interface OutfitSuggestion {
  id: string;
  itemIds: string[];
  items: WardrobeItemDTO[];
  title: string;
  reason: string;
  score: number;
  breakdown: ScoreBreakdown;
}

export interface ContextSummary {
  event: string;
  formalityMin: number;
  formalityMax: number;
  formalityTarget: number;
  activity: number;
  tempBand: TempBand | null;
  precipitation: 'none' | 'rain' | 'snow';
  outerwear: 'required' | 'recommended' | 'optional' | 'avoid';
  needsWaterResistant: boolean;
  season: string;
}

export interface GenerateOutfitResponse {
  generationId: string;
  outfits: OutfitSuggestion[];
  weather: WeatherSnapshot | null;
  weatherError: string | null;
  context: ContextSummary;
  model: string | null;
  usedFallback: boolean;
  rulesUsed: string[];
  warnings: string[];
  // Eski istemciler (mobil) için ilk kombinin özeti
  selectedItems: string[];
  stylingReason: string;
  compatibilityScore: number;
}

export interface FeedbackPayload {
  type: 'saved' | 'replaced' | 'rerolled' | 'worn' | 'liked' | 'disliked';
  generationId?: string;
  itemIds: string[];
  itemId?: string;
  reason?: FeedbackReason;
  note?: string;
}

export interface Consents {
  personalization: boolean;
  personalColor: boolean;
  push: boolean;
  noticeVersion: string | null;
  updatedAt: string | null;
}

export interface PersonalColorResult {
  season: string;
  undertone: string;
  contrast: string;
  bestColorFamilies: string[];
  avoidColorFamilies: string[];
  note: string;
  analyzedAt: string;
}

export interface StyleProfile {
  preferredFits: string[];
  avoidFits: string[];
  dislikedColorFamilies: string[];
  notes: string;
  personalColor: PersonalColorResult | null;
  preferenceSummary: string | null;
}
