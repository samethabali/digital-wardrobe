import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shirt, Trash2 } from 'lucide-react';
import { WardrobeItem, Category } from '../types';
import { CATEGORY_LABELS } from '../constants/wardrobe';

interface WardrobeGridProps {
  items: WardrobeItem[];
  onDelete?: (id: string) => void;
  onClickItem?: (item: WardrobeItem) => void;
  isSelectionMode?: boolean;
  selectedItems?: string[];
  onSelectItem?: (id: string) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

const WEATHER_EMOJI: Record<string, string> = {
  sunny: '☀️', cloudy: '☁️', rainy: '🌧️', snowy: '❄️', hot: '🔥', cold: '🌨️'
};

export default React.memo(function WardrobeGrid({
  items,
  onDelete,
  onClickItem,
  isSelectionMode = false,
  selectedItems = [],
  onSelectItem,
  hasMore = false,
  onLoadMore
}: WardrobeGridProps) {
  const [filter, setFilter] = React.useState<Category | 'all'>('all');

  const handleItemClick = (item: WardrobeItem) => {
    if (isSelectionMode && onSelectItem) {
      onSelectItem(item.id);
    } else {
      onClickItem?.(item);
    }
  };

  const filteredItems = React.useMemo(() =>
    filter === 'all' ? items : items.filter(item => item.category === filter),
    [items, filter]);

  const categories: (Category | 'all')[] = ['all', 'top', 'bottom', 'outerwear', 'shoes', 'makeup', 'accessory'];

  return (
    <div id="wardrobe-section" className="space-y-6">
      {/* Kategori Filtreleri — mobilde yatay kaydırılabilir */}
      <div className="overflow-x-auto -mx-1 px-1 pb-1 no-scrollbar">
        <div className="flex gap-1 bg-secondary p-1 rounded-xl w-max min-w-full sm:w-fit transition-colors">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`flex-shrink-0 px-3 sm:px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${filter === cat ? 'bg-primary text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              {CATEGORY_LABELS[cat] || cat}
              {cat !== 'all' && (
                <span className="ml-1 text-[10px] opacity-50">
                  {items.filter(i => i.category === cat).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-secondary opacity-50">
          <Shirt className="w-12 h-12 mb-3" />
          <p className="text-sm font-medium">Bu kategoride kıyafet yok</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item) => {
              const isSelected = selectedItems.includes(item.id);
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className={`group relative border rounded-2xl p-3 md:p-4 transition-all cursor-pointer ${isSelectionMode && isSelected
                      ? 'ring-2 ring-indigo-500 shadow-md bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 scale-[1.02]'
                      : 'bg-secondary border-border-color shadow-sm hover:shadow-md'
                    }`}
                  onClick={() => handleItemClick(item)}
                >
                  {/* Seçim İkonu */}
                  {isSelectionMode && (
                    <div className={`absolute top-3 left-3 w-5 h-5 rounded-full border-2 z-10 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-secondary border-border-color'
                      }`}>
                      {isSelected && <div className="w-2 h-2 bg-text-primary rounded-full" />}
                    </div>
                  )}

                  {/* Silme Butonu */}
                  {onDelete && !isSelectionMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                      className="absolute top-3 right-3 p-1.5 bg-secondary border border-border-color rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 z-10 shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-text-secondary hover:text-red-500" />
                    </button>
                  )}

                  {/* Görsel */}
                  <div className="aspect-[3/4] bg-primary rounded-xl mb-3 flex items-center justify-center overflow-hidden relative transition-colors">
                    <img
                      src={item.imagePath}
                      alt={item.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-contain mix-blend-normal dark:opacity-90 group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <Shirt className="w-12 h-12 text-text-secondary/10 group-hover:scale-110 transition-transform absolute -z-10" />
                    <div className="absolute inset-0 bg-black/5 pointer-events-none" />

                  </div>

                  {/* Bilgiler */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-text-secondary uppercase tracking-tight">
                      {CATEGORY_LABELS[item.category] || item.category}
                    </p>
                    <h3 className="text-sm font-medium text-text-primary truncate">{item.name}</h3>
                    {(item.style || item.color) && (
                      <p className="text-[11px] text-text-secondary">
                        {item.color && <span className="mr-1">#{item.color.replace(/\s/g, '')}</span>}
                        {item.style && <span>#{item.style === 'casual' ? 'Günlük' : item.style === 'formal' ? 'Resmi' : item.style === 'sport' ? 'Spor' : item.style === 'elegant' ? 'Zarif' : item.style === 'bohemian' ? 'Bohem' : item.style}</span>}
                      </p>
                    )}
                    {item.weatherMatch?.length > 0 && (
                      <div className="flex gap-0.5 mt-1">
                        {item.weatherMatch.map(w => {
                          const weatherLabels: Record<string, string> = {
                            sunny: 'Güneşli', cloudy: 'Bulutlu', rainy: 'Yağmurlu',
                            snowy: 'Karlı', hot: 'Sıcak', cold: 'Soğuk'
                          };
                          return (
                            <span key={w} title={weatherLabels[w] || w} className="text-[12px]">
                              {WEATHER_EMOJI[w] || w}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination Load More */}
      {hasMore && filteredItems.length > 0 && (
        <div className="flex justify-center mt-8 pb-4">
          <button
            onClick={onLoadMore}
            className="px-6 py-2 bg-secondary hover:bg-primary border border-border-color text-text-secondary rounded-full font-medium text-sm transition-all shadow-sm"
          >
            Daha Fazla Yükle
          </button>
        </div>
      )}
    </div>
  );
});
