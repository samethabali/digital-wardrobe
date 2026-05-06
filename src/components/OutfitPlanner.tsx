import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Calendar, SlidersHorizontal, Zap, Smile, ChevronRight, Loader2, Navigation } from 'lucide-react';
import { StylistRequest, WardrobeItem } from '../types';

interface OutfitPlannerProps {
  items: WardrobeItem[];
  onGenerate: (request: StylistRequest) => void;
  isGenerating: boolean;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function OutfitPlanner({ items, onGenerate, isGenerating, onNotify }: OutfitPlannerProps) {
  const [showFilters, setShowFilters] = React.useState(false);
  const [isQuickMode, setIsQuickMode] = React.useState(true);
  const [formData, setFormData] = React.useState<StylistRequest>({
    location: '',
    event: 'Gündelik',
    effort: 5,
    mood: 'Rahat',
    ignoreWeather: false,
    requiredItems: []
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
          <h3 className="text-xl font-medium text-gray-900">Kombin Oluştur</h3>
        </div>
        {!isQuickMode && (
          <button 
            type="button" 
            onClick={() => setIsQuickMode(true)} 
            className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
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
            className="bg-gradient-to-br from-indigo-50 to-purple-50 p-8 rounded-3xl w-full border border-indigo-100/50 relative overflow-hidden shadow-sm"
          >
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
             <Zap className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
             <h4 className="text-lg font-bold text-gray-900 mb-2">Tek Tıkla Kombin</h4>
             <p className="text-sm text-gray-500 mb-6 px-4">
               İş, okul veya gündelik kullanım için hızlıca en uygun kombini bul. 
               {autoLocation ? (
                 <span className="block mt-2 font-medium text-indigo-600">Konum: {autoLocation}</span>
               ) : (
                 <span className="block mt-2 text-gray-400">Konumun otomatik bulunacak.</span>
               )}
             </p>
             
             <button
               onClick={handleQuickGenerate}
               disabled={isLocating || isGenerating}
               className="w-full py-4 bg-black text-white rounded-2xl font-semibold text-sm shadow-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
             >
               {isLocating || isGenerating ? (
                 <>
                   <Loader2 className="w-4 h-4 animate-spin" />
                   <span>{isLocating ? 'Konum Bulunuyor...' : 'Analiz Ediliyor...'}</span>
                 </>
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
             className="text-xs font-bold text-gray-400 hover:text-black uppercase tracking-widest flex items-center space-x-1"
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
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Zorunlu Alanlar</label>
              <button 
                type="button" 
                onClick={() => handleCurrentLocation(false)}
                disabled={isLocating}
                className="flex items-center space-x-1 text-xs text-indigo-600 font-semibold hover:text-indigo-800 transition-colors disabled:opacity-50"
              >
                {isLocating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                <span>Konumumu Bul</span>
              </button>
            </div>
            <div className="space-y-3">
              {autoLocation ? (
                <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <MapPin className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                    <div className="flex flex-col truncate">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Otomatik Konum</span>
                      <span className="text-sm font-semibold text-indigo-900 truncate">{autoLocation}</span>
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
                      className="w-full appearance-none bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
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
                      className="w-full appearance-none bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 disabled:opacity-50"
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
      )}
    </div>
  );
}
