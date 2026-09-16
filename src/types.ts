import type { WardrobeItemDTO, StylistRequest as SharedStylistRequest, ContextSummary } from '../shared/api';
import type { Category as SharedCategory } from '../shared/wardrobe';

export type Category = SharedCategory;

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  isPrivate?: boolean;
  createdAt?: string;
}

/** Sunucunun döndürdüğü parça (yeni alanlar eski kayıtlarda boş olabilir). */
export interface WardrobeItem extends Omit<WardrobeItemDTO, 'category' | 'material' | 'attributes'> {
  category: Category;
  material?: string;
  attributes: Record<string, any>;
}

export interface SavedOutfit {
  id: string;
  userId?: string;
  name: string;
  items: string[]; // Parça kimlikleri
  stylingReason: string;
  compatibilityScore: number;
  source?: 'ai' | 'manual' | 'daily' | 'trip';
  context?: ContextSummary | null;
  createdAt: string;
}

export interface WardrobeMetadata {
  items: WardrobeItem[];
  outfits?: SavedOutfit[];
}

export interface StylistRequest extends SharedStylistRequest {
  additionalFilters?: Record<string, any>;
}

// ─── Collab (Beraber Kombin) ────────────────────────────────────────────────

export interface CollabResult {
  collabId: string;
  myOutfit: string[];        // Başlatanın parça kimlikleri
  friendOutfit: string[];    // Arkadaşın parça kimlikleri
  myItems?: WardrobeItem[];
  friendItems?: WardrobeItem[];
  compatibilityScore: number;
  collabReason: string;      // AI açıklama metni
  styleHarmony: string;      // Kısa stil etiketi (ör: "Renk Bloklaması")
  warnings?: string[];
}

export interface CollabSession {
  id: string;
  initiatorId: string;
  initiatorName: string;
  friendId: string;
  friendName: string;
  event: string;
  myOutfit: string[];
  friendOutfit: string[];
  compatibilityScore: number;
  collabReason: string;
  styleHarmony: string;
  seenByFriend: boolean;
  createdAt: string;
}

export interface ExploreProfile {
  id: string;
  name: string;
  username: string;
  createdAt: string;
  itemCount: number;
}

