export type Category = 'top' | 'bottom' | 'shoes' | 'makeup' | 'accessory';

export interface WardrobeItem {
  id: string;
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
  additionalFilters?: Record<string, any>;
}
