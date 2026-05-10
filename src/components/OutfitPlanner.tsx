import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Calendar, SlidersHorizontal, Zap, Smile, ChevronRight, Loader2, Navigation, ChevronDown, ChevronUp, Fingerprint, Check } from 'lucide-react';
import { StylistRequest, WardrobeItem } from '../types';
import { STYLE_TAG_GROUPS } from '../constants/wardrobe';

interface OutfitPlannerProps {
  items: WardrobeItem[];
  onGenerate: (request: StylistRequest) => void;
  isGenerating: boolean;
  generationStatus: string;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function OutfitPlanner({ items, onGenerate, isGenerating, generationStatus, onNotify }: OutfitPlannerProps) {
  const [showFilters, setShowFilters] = React.useState(false);
  const [isQuickMode, setIsQuickMode] = React.useState(true);
  const [formData, setFormData] = React.useState<StylistRequest>({
    location: '',
    event: 'Gündelik',
    effort: 5,
    mood: 'Rahat',
    ignoreWeather: false,
    requiredItems: [],
    styleTags: []
  });

  const [expandedSections, setExpandedSections] = React.useState({
    styles: false,
    items: false
  });

  const [provinces, setProvinces] = React.useState<any[]>([]);
  const [districts, setDistricts] = React.useState<any[]>([]);
  const [selectedProvince, setSelectedProvince] = React.useState('');
  const [selectedDistrict, setSelectedDistrict] = React.useState('');
  const [isLocating, setIsLocating] = React.useState(false);
  const [autoLocation, setAutoLocation] = React.useState<string | null>(null);

  const events = ['Gündelik', 'İş Görüşmesi', 'Randevu', 'Parti', 'Düğün/Davet', 'Spor'];
  const moods = ['Enerjik', 'Minimalist', 'Romantik', 'Ciddi', 'Rahat'];

  // İlleri API'den çek
  React.useEffect(() => {
    fetch('https://turkiyeapi.dev/api/v1/provinces')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'OK') {
          const sorted = data.data.sort((a: any, b: any) => a.name.localeCompare(b.name, 'tr'));
          setProvinces(sorted);
        }
      })
      .catch(console.error);
  }, []);

  // İl değiştiğinde ilçeleri güncelle
  React.useEffect(() => {
    if (selectedProvince) {
      const prov = provinces.find(p => p.name === selectedProvince);
      if (prov) {
        const sortedD = [...prov.districts].sort((a: any, b: any) => a.name.localeCompare(b.name, 'tr'));
        setDistricts(sortedD);
      } else {
        setDistricts([]);
      }
    } else {
      setDistricts([]);
    }
  }, [selectedProvince, provinces]);

  // İl veya ilçe değiştiğinde formData'yı güncelle
  React.useEffect(() => {
    if (autoLocation) return; // Otomatik konum set edilmişse, manuel seçimler formData'yı ezmesin
    
    if (selectedProvince && selectedDistrict) {
      setFormData(prev => ({ ...prev, location: `${selectedProvince}, ${selectedDistrict}` }));
    } else if (selectedProvince) {
      setFormData(prev => ({ ...prev, location: selectedProvince }));
    } else {
      setFormData(prev => ({ ...prev, location: '' }));
    }
  }, [selectedProvince, selectedDistrict, autoLocation]);

  const handleCurrentLocation = (autoSubmit?: boolean) => {
    if (!navigator.geolocation) {
      onNotify('Tarayıcınız konum özelliğini desteklemiyor.', 'error');
      return;
    }
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=tr`);
          const data = await res.json();
          
          let province = data.principalSubdivision || data.city || '';
          let district = data.locality || '';
          
          // Virgüller ve boşlukları temizleyerek formatla
          const locationStr = [province, district].filter(Boolean).join(', ');
          
          if (locationStr) {
            setAutoLocation(locationStr);
            setFormData(prev => ({ ...prev, location: locationStr }));
            setSelectedProvince('');
            setSelectedDistrict('');
            if (autoSubmit) {
              onGenerate({ 
                ...formData, 
                location: locationStr, 
                event: 'Gündelik', 
                effort: 5, 
                mood: 'Rahat', 
                ignoreWeather: false 
              });
            }
          } else {
            onNotify('Konum bilgisi anlaşılamadı.', 'error');
          }
        } catch (e) {
          onNotify('Konum çözümlenemedi.', 'error');
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        onNotify('Konum alınamadı. Lütfen izinleri kontrol edin.', 'error');
        setIsLocating(false);
      }
    );
  };

  const handleQuickGenerate = () => {
    if (autoLocation) {
      onGenerate({ 
        ...formData, 
        event: 'Gündelik', 
        effort: 5, 
        mood: 'Rahat', 
        ignoreWeather: false 
      });
    } else {
      // Önce konumu al, başarılı olursa hemen gönder
      handleCurrentLocation(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(formData);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <div className="flex items-center space-x-2 text-indigo-600 mb-2">
            <Zap className="w-5 h-5 fill-current" />
            <span className="text-xs font-bold uppercase tracking-widest">AI Karar Motoru</span>
          </div>
          <h3 className="text-xl font-medium text-primary">Kombin Oluştur</h3>
        </div>
        {!isQuickMode && (
          <button 
            type="button" 
            onClick={() => setIsQuickMode(true)} 
            className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            HIZLI MOD
          </button>
        )}
      </div>

      {isQuickMode ? (
        <div className="flex-grow flex flex-col items-center justify-center space-y-6 text-center">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/10 dark:to-purple-900/10 p-8 rounded-3xl w-full border border-indigo-100/50 dark:border-indigo-500/10 relative overflow-hidden shadow-sm"
          >
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
             <Zap className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
             <h4 className="text-lg font-bold text-primary mb-2">Tek Tıkla Kombin</h4>
             <p className="text-sm text-text-secondary mb-6 px-4">
               İş, okul veya gündelik kullanım için hızlıca en uygun kombini bul. 
               {autoLocation ? (
                 <span className="block mt-2 font-medium text-indigo-600 dark:text-indigo-400">Konum: {autoLocation}</span>
               ) : (
                 <span className="block mt-2 text-text-secondary/60">Konumun otomatik bulunacak.</span>
               )}
             </p>
             
             <button
               onClick={handleQuickGenerate}
               disabled={isLocating || isGenerating}
               className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold text-sm shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
             >
               {isLocating || isGenerating ? (
                 <div className="flex flex-col items-center">
                   <div className="flex items-center gap-2">
                     <Loader2 className="w-4 h-4 animate-spin" />
                     <span>{isLocating ? 'Konum Bulunuyor...' : 'Analiz Ediliyor...'}</span>
                   </div>
                   {generationStatus && !isLocating && (
                     <span className="text-[10px] opacity-70 mt-1 font-normal">{generationStatus}</span>
                   )}
                 </div>
               ) : (
                 <>
                   <span>Bana Kombin Öner</span>
                   <ChevronRight className="w-4 h-4" />
                 </>
               )}
             </button>
          </motion.div>
          
          <button 
             onClick={() => setIsQuickMode(false)}
             className="text-xs font-bold text-text-secondary hover:text-text-primary uppercase tracking-widest flex items-center space-x-1 transition-colors"
          >
             <SlidersHorizontal className="w-3 h-3" />
             <span>Ayarları Değiştir</span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8 flex-grow">
          {/* Zorunlu Alanlar */}
          <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Zorunlu Alanlar</label>
                <button 
                  type="button" 
                  onClick={() => handleCurrentLocation(false)}
                  disabled={isLocating}
                  className="flex items-center space-x-1 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-800 transition-colors disabled:opacity-50"
                >
                  {isLocating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                  <span>Konumumu Bul</span>
                </button>
              </div>
              <div className="space-y-3">
                {autoLocation ? (
                  <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-500/20 rounded-xl px-4 py-3">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <MapPin className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                      <div className="flex flex-col truncate">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Otomatik Konum</span>
                        <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 truncate">{autoLocation}</span>
                      </div>
                    </div>
                  <button 
                    type="button" 
                    onClick={() => {
                      setAutoLocation(null);
                      setFormData(prev => ({ ...prev, location: '' }));
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 ml-2"
                  >
                    İPTAL
                  </button>
                </div>
              ) : (
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <select
                      required={!autoLocation}
                      className="w-full appearance-none bg-primary border border-border-color rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 text-text-primary transition-colors"
                      value={selectedProvince}
                      onChange={(e) => {
                        setSelectedProvince(e.target.value);
                        setSelectedDistrict('');
                      }}
                    >
                      <option value="">İl Seçiniz</option>
                      {provinces.map(prov => <option key={prov.id} value={prov.name}>{prov.name}</option>)}
                    </select>
                  </div>

                  <div className="relative flex-1">
                    <select
                      required={!autoLocation && selectedProvince !== ''}
                      disabled={!selectedProvince || districts.length === 0}
                      className="w-full appearance-none bg-primary border border-border-color rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-50 text-text-primary transition-colors"
                      value={selectedDistrict}
                      onChange={(e) => setSelectedDistrict(e.target.value)}
                    >
                      <option value="">İlçe Seçiniz</option>
                      {districts.map(dist => <option key={dist.id} value={dist.name}>{dist.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

                <div className="relative">
                  <select
                    required
                    className="w-full appearance-none bg-primary border border-border-color rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 text-text-primary transition-colors"
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
          <div className="pt-4 border-t border-border-color">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex justify-between items-center text-xs font-bold text-text-secondary uppercase tracking-widest hover:text-text-primary mb-6 transition-colors"
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
                      <div className="flex justify-between text-[11px] text-text-secondary font-bold uppercase">
                        <span>Beklenen Efor</span>
                        <span className="text-text-primary">{formData.effort * 10}%</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        className="w-full h-1 bg-primary border border-border-color rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        value={formData.effort}
                        onChange={(e) => setFormData({ ...formData, effort: parseInt(e.target.value) })}
                      />
                    </div>

                    <div className="space-y-3">
                      <p className="text-[11px] text-text-secondary font-bold uppercase">Ruh Hali</p>
                      <div className="flex flex-wrap gap-2">
                        {moods.map((m) => (
                          <span
                            key={m}
                            onClick={() => setFormData({ ...formData, mood: m })}
                            className={`px-3 py-1 rounded-full text-[10px] font-medium cursor-pointer transition-all ${
                              formData.mood === m
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                : 'bg-primary border border-border-color text-text-secondary hover:border-indigo-200'
                            }`}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>


                    {/* Stil Tercihleri (Toggleable) */}
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setExpandedSections(prev => ({ ...prev, styles: !prev.styles }))}
                        className="w-full flex justify-between items-center text-[11px] text-text-secondary font-bold uppercase tracking-wider hover:text-text-primary group transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Fingerprint className="w-3 h-3 text-text-secondary group-hover:text-indigo-600" />
                          <span>Stil Tercihleri</span>
                        </div>
                        {expandedSections.styles ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      
                      <AnimatePresence>
                        {expandedSections.styles && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-4 pt-1 pb-2">
                              {STYLE_TAG_GROUPS.map(group => (
                                <div key={group.label} className="space-y-2">
                                  <p className="text-[9px] font-black text-text-secondary opacity-50 uppercase tracking-widest pl-1">{group.label}</p>
                                  <div className="flex flex-wrap gap-2">
                                    {group.tags.map((tag) => {
                                      const isSelected = formData.styleTags?.includes(tag);
                                      return (
                                        <span
                                          key={tag}
                                          onClick={() => {
                                            const currentTags = formData.styleTags || [];
                                            const newTags = isSelected
                                              ? currentTags.filter(t => t !== tag)
                                              : [...currentTags, tag];
                                            setFormData({ ...formData, styleTags: newTags });
                                          }}
                                          className={`px-3 py-1.5 rounded-xl text-[10px] font-medium cursor-pointer transition-all border ${
                                            isSelected
                                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                              : 'bg-secondary border-border-color text-text-secondary hover:border-indigo-200 hover:text-indigo-600'
                                          }`}
                                        >
                                          {tag}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="flex items-center space-x-2 py-2">
                      <input
                        type="checkbox"
                        id="ignoreWeather"
                        checked={formData.ignoreWeather}
                        onChange={(e) => setFormData({ ...formData, ignoreWeather: e.target.checked })}
                        className="w-4 h-4 rounded border-border-color text-indigo-600 focus:ring-indigo-500 cursor-pointer bg-primary"
                      />
                      <label htmlFor="ignoreWeather" className="text-xs font-medium text-text-primary cursor-pointer select-none">Hava durumunu yoksay (Kapalı mekan)</label>
                    </div>

                    {/* Zorunlu Parçalar (Kategorize Edilmiş) */}
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setExpandedSections(prev => ({ ...prev, items: !prev.items }))}
                        className="w-full flex justify-between items-center text-[11px] text-text-secondary font-bold uppercase tracking-wider hover:text-text-primary group transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Zap className="w-3 h-3 text-text-secondary group-hover:text-amber-500" />
                          <span>Zorunlu Parçalar ({formData.requiredItems?.length || 0})</span>
                        </div>
                        {expandedSections.items ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      <AnimatePresence>
                        {expandedSections.items && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-4 pt-1 pb-2">
                              {['top', 'bottom', 'outerwear', 'shoes', 'accessory', 'makeup'].map(cat => {
                                const catItems = items.filter(i => i.category === cat);
                                if (catItems.length === 0) return null;
                                
                                const catLabels: Record<string, string> = {
                                  top: 'Üst Giyim', bottom: 'Alt Giyim', outerwear: 'Dış Giyim',
                                  shoes: 'Ayakkabı', accessory: 'Aksesuar', makeup: 'Makyaj'
                                };

                                return (
                                  <div key={cat} className="space-y-2">
                                    <p className="text-[9px] font-black text-text-secondary opacity-50 uppercase tracking-widest pl-1">{catLabels[cat]}</p>
                                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                      {catItems.map(item => {
                                        const isSelected = formData.requiredItems?.includes(item.id);
                                        return (
                                          <div
                                            key={item.id}
                                            onClick={() => {
                                              const req = formData.requiredItems || [];
                                              if (!isSelected) setFormData({ ...formData, requiredItems: [...req, item.id] });
                                              else setFormData({ ...formData, requiredItems: req.filter(id => id !== item.id) });
                                            }}
                                            className="w-16 shrink-0 cursor-pointer relative group"
                                          >
                                            <div className={`aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all ${isSelected ? 'border-indigo-600 shadow-md' : 'border-transparent group-hover:border-indigo-200'}`}>
                                              <img src={item.imagePath} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async" />
                                              {isSelected && (
                                                <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center">
                                                  <div className="bg-indigo-600 text-white rounded-full p-1 shadow-sm">
                                                    <Check className="w-3 h-3" />
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                            <p className="text-[9px] text-center mt-1 text-text-secondary truncate">{item.name}</p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                              {items.length === 0 && (
                                <div className="text-center py-4 bg-primary/50 rounded-xl border border-dashed border-border-color">
                                  <span className="text-xs text-text-secondary opacity-50">Gardırop henüz boş</span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="submit"
            disabled={!formData.location || !formData.event || isGenerating}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold text-sm shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 mt-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analiz Ediliyor...</span>
                </div>
                {generationStatus && (
                  <span className="text-[10px] opacity-70 mt-0.5 font-normal">{generationStatus}</span>
                )}
              </div>
            ) : (
              <>
                <span>Kombini Analiz Et</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
