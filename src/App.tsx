import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import WardrobeGrid from './components/WardrobeGrid';
import OutfitPlanner from './components/OutfitPlanner';
import AddItemModal from './components/AddItemModal';
import ItemDetailModal from './components/ItemDetailModal';
import { WardrobeItem, StylistRequest, SavedOutfit } from './types';
import { generateOutfit } from './services/stylistService';
import { Sparkles, Plus, RefreshCw, Wand2, CheckCircle2, Save, Trash2, Menu, X, Zap } from 'lucide-react';

export default function App() {
  const [items, setItems] = React.useState<WardrobeItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<'koleksiyon' | 'kombinlerim' | 'istatistikler'>('koleksiyon');
  const [selectedItem, setSelectedItem] = React.useState<WardrobeItem | null>(null);
  const [savedOutfits, setSavedOutfits] = React.useState<SavedOutfit[]>([]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [isScanning, setIsScanning] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [mobilePlannerOpen, setMobilePlannerOpen] = React.useState(false);
  const [enrichState, setEnrichState] = React.useState<{
    running: boolean;
    total: number;
    current: number;
    currentName: string;
    enriched: number;
    done: boolean;
    message: string;
  }>({ running: false, total: 0, current: 0, currentName: '', enriched: 0, done: false, message: '' });
  const [result, setResult] = React.useState<{
    selectedItems: string[];
    stylingReason: string;
    compatibilityScore: number;
  } | null>(null);

  const fetchWardrobe = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/wardrobe');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setItems(data.items || []);
    } catch (error) {
      console.error('Failed to fetch wardrobe:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchOutfits = async () => {
    try {
      const response = await fetch('/api/outfits');
      if (response.ok) {
        const data = await response.json();
        setSavedOutfits(data.outfits || []);
      }
    } catch (e) {
      console.error('Failed to fetch outfits:', e);
    }
  };

  React.useEffect(() => { 
    fetchWardrobe(); 
    fetchOutfits();
  }, []);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/wardrobe/scan', { method: 'POST' });
      const data = await res.json();
      if (data.added > 0) await fetchWardrobe();
      alert(data.message || 'Tarama tamamlandı.');
    } catch {
      alert('Tarama başarısız.');
    } finally {
      setIsScanning(false);
    }
  };

  const missingCount = items.filter(i => !i.color || !i.style || !(i as any).subCategory).length;

  const handleEnrich = () => {
    setEnrichState({ running: true, total: 0, current: 0, currentName: '', enriched: 0, done: false, message: '' });

    fetch('/api/wardrobe/enrich', { method: 'POST' })
      .then(res => {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        const pump = (): Promise<void> => reader.read().then(({ done, value }) => {
          if (done) { fetchWardrobe(); return; }
          const text = decoder.decode(value);
          const lines = text.split('\n').filter(l => l.startsWith('data:'));
          for (const line of lines) {
            try {
              const event = JSON.parse(line.slice(5));
              if (event.type === 'start')    setEnrichState(p => ({ ...p, total: event.total }));
              if (event.type === 'progress') setEnrichState(p => ({ ...p, current: event.current, currentName: event.name }));
              if (event.type === 'item_done')setEnrichState(p => ({ ...p, enriched: p.enriched + 1 }));
              if (event.type === 'done')     setEnrichState(p => ({ ...p, running: false, done: true, message: event.message }));
            } catch {}
          }
          return pump();
        });
        return pump();
      })
      .catch(() => setEnrichState(p => ({ ...p, running: false, message: 'Hata oluştu.' })));
  };

  const handleItemAdded = async () => {
    setShowAddModal(false);
    await fetchWardrobe();
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Bu kıyafeti silmek istediğinize emin misiniz?')) return;
    try {
      await fetch(`/api/wardrobe/${id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.id !== id));
    } catch {
      alert('Silme başarısız.');
    }
  };

  const handleGenerate = async (request: StylistRequest) => {
    setIsGenerating(true);
    setResult(null);
    try {
      const outfit = await generateOutfit(items, request);
      setResult(outfit);
      document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth' });
    } catch (error: any) {
      const msg = error.message?.includes('429') || error.message?.includes('kota')
        ? '⚠️ Gemini API kota sınırına ulaşıldı. Birkaç dakika bekleyip tekrar deneyin.'
        : `Kombin oluşturulamadı: ${error.message}`;
      alert(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedItemsDetails = result
    ? items.filter(item => result.selectedItems.includes(item.id))
    : [];

  return (
    <div className="flex flex-col md:flex-row w-full h-screen bg-[#F9FAFB] overflow-hidden">
      {/* Mobil Header */}
      <div className="md:hidden flex items-center justify-between bg-white border-b border-gray-200 p-4 shrink-0 z-20">
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-gray-600 hover:text-gray-900 transition-colors">
          <Menu className="w-6 h-6" />
        </button>
        <div className="font-bold text-gray-900 tracking-wider">ANTIGRAVITY</div>
        <button onClick={() => setMobilePlannerOpen(true)} className="p-2 -mr-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
          <Zap className="w-5 h-5 fill-current" />
        </button>
      </div>

      {/* Sol Sidebar */}
      <aside className={`fixed md:relative inset-y-0 left-0 z-40 w-72 md:w-64 border-r border-gray-200 bg-white flex flex-col p-6 shrink-0 h-full transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-xs font-bold tracking-[0.2em] uppercase text-gray-400 mb-1">Antigravity</h1>
            <p className="text-lg font-semibold text-gray-900">Digital Wardrobe</p>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden p-2 text-gray-400 hover:text-gray-900 bg-gray-50 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="space-y-4 flex-grow">
          <div 
            onClick={() => { setActiveTab('koleksiyon'); setMobileMenuOpen(false); }}
            className={`flex items-center space-x-3 cursor-pointer pl-4 transition-colors ${activeTab === 'koleksiyon' ? 'text-gray-900 font-medium relative -ml-4' : 'text-gray-400 hover:text-gray-900'}`}
          >
            {activeTab === 'koleksiyon' && <div className="absolute left-0 w-1.5 h-6 bg-black rounded-r-full" />}
            <span>Koleksiyon</span>
          </div>
          <div 
            onClick={() => { setActiveTab('kombinlerim'); setMobileMenuOpen(false); }}
            className={`flex items-center space-x-3 cursor-pointer pl-4 transition-colors ${activeTab === 'kombinlerim' ? 'text-gray-900 font-medium relative -ml-4' : 'text-gray-400 hover:text-gray-900'}`}
          >
            {activeTab === 'kombinlerim' && <div className="absolute left-0 w-1.5 h-6 bg-black rounded-r-full" />}
            <span>Kombinlerim</span>
          </div>
          <div 
            onClick={() => { setActiveTab('istatistikler'); setMobileMenuOpen(false); }}
            className={`flex items-center space-x-3 cursor-pointer pl-4 transition-colors ${activeTab === 'istatistikler' ? 'text-gray-900 font-medium relative -ml-4' : 'text-gray-400 hover:text-gray-900'}`}
          >
            {activeTab === 'istatistikler' && <div className="absolute left-0 w-1.5 h-6 bg-black rounded-r-full" />}
            <span>İstatistikler</span>
          </div>
        </nav>

        <div className="pt-6 border-t border-gray-100 space-y-3">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">Durum</p>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-gray-600">Local Cache Aktif</span>
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="text-xs text-gray-600">Vision AI Aktif</span>
            </div>
            {missingCount > 0 && !enrichState.done && (
              <div className="flex items-center space-x-2 mt-1">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-xs text-amber-600 font-medium">{missingCount} eksik bilgi var</span>
              </div>
            )}
            {enrichState.done && (
              <div className="flex items-center space-x-2 mt-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span className="text-xs text-green-600 font-medium">Tümü tamamlandı!</span>
              </div>
            )}
          </div>

          {/* Enrich progress bar */}
          {enrichState.running && (
            <div className="bg-indigo-50 rounded-xl p-3 space-y-2">
              <div className="flex justify-between text-[11px] text-indigo-600 font-medium">
                <span>Analiz ediliyor...</span>
                <span>{enrichState.current}/{enrichState.total}</span>
              </div>
              <div className="w-full bg-indigo-100 rounded-full h-1.5">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: enrichState.total ? `${(enrichState.current / enrichState.total) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-[10px] text-indigo-400 truncate">{enrichState.currentName}</p>
            </div>
          )}

          {missingCount > 0 && !enrichState.running && (
            <button
              onClick={handleEnrich}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5" />
              {missingCount} öğeyi AI ile Tamamla
            </button>
          )}

          <button
            onClick={handleScan}
            disabled={isScanning}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Taranıyor...' : 'Dolabı Tara'}
          </button>
        </div>
      </aside>
      
      {/* Sol Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Ana İçerik */}
      <main className="flex-1 flex flex-col p-4 md:p-8 overflow-hidden h-full z-10 relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 shrink-0 gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-light text-gray-900 mb-1">Gardırop</h2>
            <p className="text-xs md:text-sm text-gray-500">
              {loading ? 'Yükleniyor...' : `${items.length} parça · Bulut Veritabanı`}
            </p>
          </div>
          <div className="flex space-x-2">
            {activeTab === 'koleksiyon' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white rounded-xl text-sm font-medium shadow-lg shadow-black/10 hover:bg-gray-900 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Yeni Ekle
              </button>
            )}
          </div>
        </div>

        <div className="flex-grow overflow-y-auto pr-1 md:pr-2 custom-scrollbar pb-20 md:pb-0">
          {activeTab === 'koleksiyon' ? (
            <>
          {/* AI Sonuç Bölümü */}
          <AnimatePresence>
            {result && (
              <motion.section
                id="result-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-8 md:mb-12 bg-indigo-50 border border-indigo-100 rounded-3xl p-4 md:p-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 p-2 rounded-lg">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-indigo-900">AI Tavsiyesi</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-white px-4 py-2 rounded-full border border-indigo-200">
                      <span className="text-sm font-bold text-indigo-600">%{result.compatibilityScore} Uyum</span>
                    </div>
                    <button
                      onClick={() => setResult(null)}
                      className="text-xs text-indigo-400 hover:text-indigo-600"
                    >Kapat</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  {selectedItemsDetails.map(item => (
                    <div key={item.id} className="bg-white p-3 rounded-2xl border border-indigo-100 shadow-sm">
                      <div className="aspect-square bg-gray-50 rounded-xl mb-3 overflow-hidden">
                        <img src={item.imagePath} alt={item.name} className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                      <p className="text-xs font-bold text-indigo-400 uppercase tracking-tighter">{item.category}</p>
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white/50 backdrop-blur-sm p-6 rounded-2xl border border-white/50 mb-6">
                  <p className="text-sm text-indigo-900 leading-relaxed italic">"{result.stylingReason}"</p>
                </div>

                <div className="flex justify-end border-t border-indigo-100 pt-4 mt-2">
                  <button
                    onClick={async () => {
                      const name = prompt('Kombin için bir isim girin:', 'Favori Kombinim');
                      if (!name) return;
                      try {
                        const res = await fetch('/api/outfits', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name,
                            items: result.selectedItems,
                            stylingReason: result.stylingReason,
                            compatibilityScore: result.compatibilityScore
                          })
                        });
                        if (res.ok) {
                          alert('Kombin kaydedildi!');
                          fetchOutfits();
                        } else throw new Error();
                      } catch {
                        alert('Kombin kaydedilemedi');
                      }
                    }}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
                  >
                    <Save className="w-4 h-4" />
                    Kombini Kaydet
                  </button>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-gray-100 border-t-black rounded-full animate-spin" />
            </div>
          ) : (
            <WardrobeGrid items={items} onDelete={handleDeleteItem} onClickItem={setSelectedItem} />
          )}
          </>
          ) : activeTab === 'kombinlerim' ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {savedOutfits.length === 0 ? (
                <div className="col-span-full py-20 text-center text-gray-400">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Henüz kaydedilmiş kombin yok</p>
                </div>
              ) : (
                savedOutfits.map(outfit => (
                  <div key={outfit.id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{outfit.name}</h3>
                        <p className="text-xs text-gray-400">{new Date(outfit.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">%{outfit.compatibilityScore} Uyum</span>
                        <button 
                          onClick={async () => {
                            if (!confirm('Silmek istediğinize emin misiniz?')) return;
                            await fetch(`/api/outfits/${outfit.id}`, { method: 'DELETE' });
                            fetchOutfits();
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3 mb-4 overflow-x-auto pb-2 custom-scrollbar">
                      {outfit.items.map(itemId => {
                        const item = items.find(i => i.id === itemId);
                        if (!item) return null;
                        return (
                          <div key={itemId} className="w-20 shrink-0 group relative cursor-pointer" onClick={() => setSelectedItem(item)}>
                            <div className="aspect-square bg-gray-50 rounded-xl mb-1 overflow-hidden border border-gray-100 group-hover:border-indigo-200 transition-colors">
                              <img src={item.imagePath} alt={item.name} className="w-full h-full object-cover" />
                            </div>
                            <p className="text-[10px] text-center text-gray-500 truncate">{item.name}</p>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl italic">"{outfit.stylingReason}"</p>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="py-20 text-center text-gray-400">Yakında...</div>
          )}
        </div>
      </main>

      {/* Sağ Sidebar */}
      <section className={`fixed md:relative inset-y-0 right-0 z-40 w-full sm:w-80 md:w-80 bg-white border-l border-gray-200 p-6 md:p-8 flex flex-col h-full shrink-0 transform transition-transform duration-300 ease-in-out ${mobilePlannerOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
        <div className="flex justify-between items-center mb-6 md:hidden">
          <div className="flex items-center gap-2 text-indigo-600">
            <Zap className="w-5 h-5 fill-current" />
            <span className="font-bold uppercase tracking-wider text-sm">Karar Motoru</span>
          </div>
          <button onClick={() => setMobilePlannerOpen(false)} className="p-2 text-gray-400 hover:text-gray-900 bg-gray-50 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mb-8 overflow-y-auto flex-grow custom-scrollbar space-y-8 pr-1">
          <OutfitPlanner items={items} onGenerate={(req) => { handleGenerate(req); setMobilePlannerOpen(false); }} isGenerating={isGenerating} />
        </div>
      </section>

      {/* Sağ Sidebar Backdrop */}
      {mobilePlannerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden" onClick={() => setMobilePlannerOpen(false)} />
      )}

      {/* Yeni Kıyafet Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddItemModal
            onClose={() => setShowAddModal(false)}
            onAdded={handleItemAdded}
          />
        )}
        {selectedItem && (
          <ItemDetailModal
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onUpdate={(updatedItem) => {
              setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
              setSelectedItem(updatedItem);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
