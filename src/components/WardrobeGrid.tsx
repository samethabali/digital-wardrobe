import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shirt, Trash2 } from 'lucide-react';
import { WardrobeItem, Category } from '../types';

interface WardrobeGridProps {
  items: WardrobeItem[];
  onDelete?: (id: string) => void;
  onClickItem?: (item: WardrobeItem) => void;
  isSelectionMode?: boolean;
  selectedItems?: string[];
  onSelectItem?: (id: string) => void;
}

const WEATHER_EMOJI: Record<string, string> = {
  sunny: '☀️', cloudy: '☁️', rainy: '🌧️', snowy: '❄️', hot: '🔥', cold: '🌨️'
};

export default function WardrobeGrid({ 
  items, 
  onDelete, 
  onClickItem, 
  isSelectionMode = false, 
  selectedItems = [], 
  onSelectItem 
}: WardrobeGridProps) {
  const [filter, setFilter] = React.useState<Category | 'all'>('all');

  const handleItemClick = (item: WardrobeItem) => {
    if (isSelectionMode && onSelectItem) {
      onSelectItem(item.id);
    } else {
      onClickItem?.(item);
    }
  };

  const filteredItems = filter === 'all'
    ? items
    : items.filter(item => item.category === filter);

  // Kategorileri dinamik olarak mevcut itemlardan üret + sabit liste
  const categories: (Category | 'all')[] = ['all', 'top', 'bottom', 'shoes', 'makeup', 'accessory'];

  return (
    <div id="wardrobe-section" className="space-y-6">
      {/* Kategori Filtreleri */}
      <div className="flex flex-wrap gap-1 bg-gray-100/50 p-1 rounded-xl w-fit">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              filter === cat ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {cat}
            {cat !== 'all' && (
              <span className="ml-1 text-[10px] opacity-50">
                {items.filter(i => i.category === cat).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-300">
          <Shirt className="w-12 h-12 mb-3" />
          <p className="text-sm">Bu kategoride kıyafet yok</p>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item) => {
              const isSelected = selectedItems.includes(item.id);
              return (
                <motion.div
                  layout
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`group relative border rounded-2xl p-4 transition-all cursor-pointer ${
                    isSelectionMode && isSelected
                      ? 'ring-2 ring-indigo-500 shadow-md bg-indigo-50/50 border-indigo-200 scale-[1.02]'
                      : 'bg-white border-gray-100 shadow-sm hover:shadow-md'
                  }`}
                  onClick={() => handleItemClick(item)}
                >
                  {/* Seçim İkonu */}
                  {isSelectionMode && (
                    <div className={`absolute top-3 left-3 w-5 h-5 rounded-full border-2 z-10 flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-200'
                    }`}>
                      {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                  )}

                  {/* Silme Butonu */}
                  {onDelete && !isSelectionMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                      className="absolute top-3 right-3 p-1.5 bg-white border border-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:border-red-200 z-10 shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                    </button>
                  )}

                  {/* Görsel */}
                  <div className="aspect-[3/4] bg-gray-50 rounded-xl mb-3 flex items-center justify-center overflow-hidden relative">
                    <img
                      src={item.imagePath}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <Shirt className="w-12 h-12 text-gray-200 group-hover:scale-110 transition-transform absolute" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />

                    {/* AI rozeti */}
                    {item.aiAnalyzed && (
                      <div className="absolute top-2 right-2 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                        AI
                      </div>
                    )}
                  </div>

                  {/* Bilgiler */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-tight">{item.category}</p>
                    <h3 className="text-sm font-medium text-gray-900 truncate">{item.name}</h3>
                    {(item.style || item.color) && (
                      <p className="text-[11px] text-gray-400">
                        {item.color && <span className="mr-1">#{item.color.replace(/\s/g, '')}</span>}
                        {item.style && <span>#{item.style}</span>}
                      </p>
                    )}
                    {item.weatherMatch?.length > 0 && (
                      <div className="flex gap-0.5 mt-1">
                        {item.weatherMatch.map(w => (
                          <span key={w} title={w} className="text-[12px]">{WEATHER_EMOJI[w] || w}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
