import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Calendar, SlidersHorizontal, Zap, Smile, ChevronRight, Loader2 } from 'lucide-react';
import { StylistRequest, WardrobeItem } from '../types';

interface OutfitPlannerProps {
  items: WardrobeItem[];
  onGenerate: (request: StylistRequest) => void;
  isGenerating: boolean;
}

export default function OutfitPlanner({ items, onGenerate, isGenerating }: OutfitPlannerProps) {
  const [showFilters, setShowFilters] = React.useState(false);
  const [formData, setFormData] = React.useState<StylistRequest>({
    location: '',
    event: '',
    effort: 5,
    mood: '',
    ignoreWeather: false,
    requiredItems: []
  });

  const locations = ['Ankara', 'İstanbul', 'İzmir', 'London', 'Paris', 'Berlin'];
  const events = ['Gündelik', 'İş Görüşmesi', 'Randevu', 'Parti', 'Düğün/Davet', 'Spor'];
  const moods = ['Enerjik', 'Minimalist', 'Romantik', 'Ciddi', 'Rahat'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(formData);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-8">
        <div className="flex items-center space-x-2 text-indigo-600 mb-2">
          <Zap className="w-5 h-5 fill-current" />
          <span className="text-xs font-bold uppercase tracking-widest">AI Karar Motoru</span>
        </div>
        <h3 className="text-xl font-medium text-gray-900">Kombin Oluştur</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 flex-grow">
        {/* Zorunlu Alanlar */}
        <div className="space-y-4">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Zorunlu Alanlar</label>
          <div className="space-y-3">
            <div className="relative">
              <select
                required
                className="w-full appearance-none bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              >
                <option value="">Konum Seçiniz</option>
                {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>

            <div className="relative">
              <select
                required
                className="w-full appearance-none bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                value={formData.event}
                onChange={(e) => setFormData({ ...formData, event: e.target.value })}
              >
                <option value="">Etkinlik Tipi</option>
                {events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Detaylı Filtre */}
        <div className="pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="w-full flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-widest hover:text-black mb-6"
          >
            <span>Detaylı Filtreler</span>
            <SlidersHorizontal className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-90' : ''}`} />
          </button>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-6 pb-2">
                  <div className="space-y-3">
                    <div className="flex justify-between text-[11px] text-gray-400 font-bold uppercase">
                      <span>Beklenen Efor</span>
                      <span className="text-black">{formData.effort * 10}%</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-black"
                      value={formData.effort}
                      onChange={(e) => setFormData({ ...formData, effort: parseInt(e.target.value) })}
                    />
                  </div>

                  <div className="space-y-3">
                    <p className="text-[11px] text-gray-400 font-bold uppercase">Ruh Hali</p>
                    <div className="flex flex-wrap gap-2">
                      {moods.map((m) => (
                        <span
                          key={m}
                          onClick={() => setFormData({ ...formData, mood: m })}
                          className={`px-3 py-1 rounded-full text-[10px] font-medium cursor-pointer transition-colors ${
                            formData.mood === m
                              ? 'bg-black text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="ignoreWeather"
                      checked={formData.ignoreWeather}
                      onChange={(e) => setFormData({ ...formData, ignoreWeather: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="ignoreWeather" className="text-xs font-medium text-gray-700">Hava durumunu yoksay (Kapalı mekan)</label>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[11px] text-gray-400 font-bold uppercase">Zorunlu Parçalar</p>
                    <div className="max-h-32 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2 bg-gray-50">
                      {items.map(item => (
                        <label key={item.id} className="flex items-center space-x-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={formData.requiredItems?.includes(item.id)}
                            onChange={(e) => {
                              const req = formData.requiredItems || [];
                              if (e.target.checked) setFormData({ ...formData, requiredItems: [...req, item.id] });
                              else setFormData({ ...formData, requiredItems: req.filter(id => id !== item.id) });
                            }}
                            className="w-3.5 h-3.5 rounded text-indigo-600"
                          />
                          <span className="text-xs text-gray-700 truncate">{item.name}</span>
                        </label>
                      ))}
                      {items.length === 0 && <span className="text-xs text-gray-400">Gardırop boş</span>}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          type="submit"
          disabled={!formData.location || !formData.event || isGenerating}
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 mt-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analiz Ediliyor...</span>
            </>
          ) : (
            <>
              <span>Kombini Analiz Et</span>
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
