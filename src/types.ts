export type Category = 'top' | 'bottom' | 'outerwear' | 'shoes' | 'makeup' | 'accessory';

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  isPrivate?: boolean;
  createdAt: string;
}

export interface WardrobeItem {
  id: string;
  userId?: string; // Belongs to a user
  name: string;
  category: Category;
  subCategory: string;
  color: string;
  material?: string;
  style: string;
  pattern?: string; // e.g., düz, çizgili, kareli, çiçekli
  fit?: string;     // e.g., dar, normal, bol, oversize
  weatherMatch: string[];
  imagePath: string;
  attributes: Record<string, any>;
  aiAnalyzed?: boolean;
}

export interface SavedOutfit {
  id: string;
  userId?: string; // Belongs to a user
  name: string;
  items: string[]; // List of item IDs
  stylingReason: string;
  compatibilityScore: number;
  createdAt: string;
}

export interface WardrobeMetadata {
  items: WardrobeItem[];
  outfits?: SavedOutfit[];
}

export interface StylistRequest {
  location: string;
  event: string;
  effort?: number; // 1-10
  mood?: string;
  requiredItems?: string[]; // Must include item IDs
  excludedItems?: string[]; // Must NOT include item IDs
  ignoreWeather?: boolean;  // If true, don't consider weather match
  personalContext?: string; // Global style identity from sidebar
  styleTags?: string[];     // Selected style tags from planner
  additionalFilters?: Record<string, any>;
  recentOutfits?: string[][]; // Son 3 kombinin parça ID'leri (tekrar engelleme için)
}

