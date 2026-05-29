import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Register from './components/Register';
import AccountSettings from './components/AccountSettings';
import Explore from './components/Explore';
import StatsDashboard from './components/StatsDashboard';
import { motion, AnimatePresence } from 'motion/react';
import WardrobeGrid from './components/WardrobeGrid';
import OutfitPlanner from './components/OutfitPlanner';
import AddItemModal from './components/AddItemModal';
import ItemDetailModal from './components/ItemDetailModal';
import { useNotification } from './contexts/NotificationContext';
import { useWardrobe } from './contexts/WardrobeContext';
import { WardrobeItem, StylistRequest, SavedOutfit } from './types';
import { generateOutfit } from './services/stylistService';
import { CATEGORY_LABELS } from './constants/wardrobe';
import { Sparkles, Plus, RefreshCw, Wand2, CheckCircle2, Save, Trash2, Menu, X, Zap, AlertCircle, Fingerprint, ChevronDown, ChevronUp, Shirt, LayoutGrid, BarChart2, Lock, Unlock, Sun, Moon, Edit3, Eye, EyeOff, LogOut, User } from 'lucide-react';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

function Dashboard() {
  const { user, logout } = useAuth();
  const { notify, ask, askConfirm } = useNotification();
  const { items, loading, page, hasMore, missingCount, enrichState, fetchWardrobe, handleEnrich, handleDeleteItem, setItems } = useWardrobe();
  const [activeTab, setActiveTab] = React.useState<'koleksiyon' | 'kombinlerim' | 'istatistikler' | 'hesap' | 'kesfet'>('koleksiyon');
  const [selectedItem, setSelectedItem] = React.useState<WardrobeItem | null>(null);
  const [savedOutfits, setSavedOutfits] = React.useState<SavedOutfit[]>([]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generationStatus, setGenerationStatus] = React.useState('');
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [mobilePlannerOpen, setMobilePlannerOpen] = React.useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false);

  const [result, setResult] = React.useState<{
    selectedItems: string[];
    stylingReason: string;
    compatibilityScore: number;
  } | null>(null);
  const [isResultVisible, setIsResultVisible] = React.useState(true);
  const [lastRequest, setLastRequest] = React.useState<StylistRequest | null>(null);
  const [lockedItems, setLockedItems] = React.useState<string[]>([]);
  const [recentOutfitsHistory, setRecentOutfitsHistory] = React.useState<string[][]>([]);
  const [isSelectionMode, setIsSelectionMode] = React.useState(false);
  const [selectedForOutfit, setSelectedForOutfit] = React.useState<string[]>([]);

  // Koyu Mod (Dark Mode)
  const [darkMode, setDarkMode] = React.useState(() => {
    return localStorage.getItem('aura_dark_mode') === 'true';
  });

  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('aura_dark_mode', darkMode.toString());
  }, [darkMode]);


  // Kişisel Bağlam (Stil Kimliği)
  const [personalContext, setPersonalContext] = React.useState(() => {
    return localStorage.getItem('aura_personal_context') || '';
  });
  const [showContextInput, setShowContextInput] = React.useState(false);

  // Uçuştaki kombin isteğini iptal etmek için ref — paralel istek yarışını önler
  const generateControllerRef = React.useRef<AbortController | null>(null);



  const fetchOutfits = async () => {
    try {
      const token = localStorage.getItem('aura_token');
      const response = await fetch('/api/outfits', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSavedOutfits(data.outfits || []);
      }
    } catch (e) {
      console.error('Failed to fetch outfits:', e);
    }
  };

  React.useEffect(() => {
    if (user) {
      fetchOutfits();
    }
  }, [user]);

  const handleItemAdded = async () => {
    setShowAddModal(false);
    await fetchWardrobe();
  };



  const handleGenerate = async (request: StylistRequest) => {
    // Önceki isteği iptal et (kullanıcı hızlı davrandıysa)
    generateControllerRef.current?.abort();
    const controller = new AbortController();
    generateControllerRef.current = controller;

    // İstek parametrelerinin değişip değişmediğini kontrol et (yenilemelerde geçmişi koruruz, yeni aramalarda temizleriz)
    const isRequestChanged = !!(lastRequest && (
      lastRequest.location !== request.location ||
      lastRequest.event !== request.event ||
      lastRequest.mood !== request.mood ||
      JSON.stringify(lastRequest.styleTags) !== JSON.stringify(request.styleTags)
    ));

    let currentHistory = recentOutfitsHistory;
    if (isRequestChanged) {
      currentHistory = [];
      setRecentOutfitsHistory([]);
    }

    const fullRequest: StylistRequest = {
      ...request,
      personalContext: personalContext.trim() || undefined,
      recentOutfits: currentHistory
    };

    setLastRequest(fullRequest);
    setIsGenerating(true);
    setResult(null);
    setGenerationStatus('Konum ve hava durumu analiz ediliyor...');
    try {
      const outfit = await generateOutfit(items, fullRequest, controller.signal);
      if (controller.signal.aborted) return;
      setGenerationStatus('Kombin detaylandırılıyor...');
      setResult(outfit);
      setIsResultVisible(true);

      // Son üretilen kombinin parçalarını geçmişe ekle (tekrarlanmasını önlemek için)
      if (outfit && outfit.selectedItems && outfit.selectedItems.length > 0) {
        setRecentOutfitsHistory(prev => {
          const base = isRequestChanged ? [] : prev;
          const next = [...base, outfit.selectedItems];
          if (next.length > 3) return next.slice(next.length - 3);
          return next;
        });
      }

      setTimeout(() => {
        document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error: any) {
      if (error?.name === 'AbortError') return; // Yeni istek başlatıldı, sessizce çık
      const msg = error.message?.includes('429') || error.message?.includes('kota')
        ? 'Gemini API kota sınırına ulaşıldı. Lütfen bekleyin.'
        : `Kombin oluşturulamadı: ${error.message}`;
      notify(msg, 'error');
    } finally {
      // Sadece bu controller hala aktifse (iptal edilmediyse) spinner'i kapat
      if (!controller.signal.aborted) {
        setIsGenerating(false);
        setGenerationStatus('');
      }
    }
  };

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedForOutfit([]);
    if (!isSelectionMode) setActiveTab('koleksiyon');
  };

  const handleItemSelect = (id: string) => {
    setSelectedForOutfit(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSaveManualOutfit = async () => {
    if (selectedForOutfit.length === 0) return;
    const name = await ask('Manuel Kombin İsmi', 'Benim Kombinim');
    if (!name) return;
    try {
      const token = localStorage.getItem('aura_token');
      const res = await fetch('/api/outfits', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          items: selectedForOutfit,
          stylingReason: 'Kullanıcı tarafından manuel oluşturuldu.',
          compatibilityScore: 100
        })
      });
      if (res.ok) {
        notify('Kombin başarıyla kaydedildi!', 'success');
        setIsSelectionMode(false);
        setSelectedForOutfit([]);
        fetchOutfits();
        setActiveTab('kombinlerim');
      } else throw new Error();
    } catch {
      notify('Kombin kaydedilemedi.', 'error');
    }
  };

  const selectedItemsDetails = React.useMemo(() =>
    result ? items.filter(item => result.selectedItems.includes(item.id)) : [],
    [result, items]);

  const handleReplaceItem = (itemId: string) => {
    if (!lastRequest || !result) return;

    // Değişmesini istemediğimiz (kalan) parçaları requiredItems'a ekle
    const itemsToKeep = result.selectedItems.filter(id => id !== itemId);
    const newRequired = Array.from(new Set([...(lastRequest.requiredItems || []), ...itemsToKeep]));

    // Değişmesini istediğimiz parçayı excludedItems'a ekle
    const newRequest = {
      ...lastRequest,
      excludedItems: [...(lastRequest.excludedItems || []), itemId],
      requiredItems: newRequired
    };

    handleGenerate(newRequest);
  };

  const handleReroll = () => {
    if (lastRequest) handleGenerate(lastRequest);
  };

  const handleEditOutfit = async (outfit: SavedOutfit) => {
    try {
      const newName = await ask('Kombin İsmi', outfit.name);
      if (newName === null) return;

      const newReason = await ask('Kombin Açıklaması', outfit.stylingReason);
      if (newReason === null) return;

      const token = localStorage.getItem('aura_token');
      const res = await fetch(`/api/outfits/${outfit.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          name: newName || outfit.name, 
          stylingReason: newReason || outfit.stylingReason 
        })
      });
      
      if (res.ok) {
        notify('Kombin başarıyla güncellendi.', 'success');
        fetchOutfits();
      } else {
        notify('Güncelleme sırasında bir hata oluştu.', 'error');
      }
    } catch (err) {
      console.error('Edit error:', err);
      notify('İşlem başarısız.', 'error');
    }
  };

  const [targetOutfitId, setTargetOutfitId] = React.useState<string | null>(null);

  const handleAddItemToOutfit = (outfitId: string) => {
    setTargetOutfitId(outfitId);
    setIsSelectionMode(true);
    setSelectedForOutfit([]);
    setActiveTab('koleksiyon');
    notify('Kombine eklemek istediğiniz parçaları seçin.', 'info');
  };

  // handleSaveManualOutfit'i sarmalayan yeni fonksiyon
  const handleSaveManualOutfitExtended = async () => {
    if (targetOutfitId) {
      // Mevcut kombine ekle
      const outfit = savedOutfits.find(o => o.id === targetOutfitId);
      if (!outfit) return;
      
      const updatedItems = [...new Set([...outfit.items, ...selectedForOutfit])];
      
      try {
        const token = localStorage.getItem('aura_token');
        const res = await fetch(`/api/outfits/${targetOutfitId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ items: updatedItems })
        });
        if (res.ok) {
          notify('Parçalar kombine eklendi.', 'success');
          setTargetOutfitId(null);
          setIsSelectionMode(false);
          setSelectedForOutfit([]);
          setActiveTab('kombinlerim');
          fetchOutfits();
        }
      } catch {
        notify('Ekleme başarısız.', 'error');
      }
    } else {
      // Normal manuel kayıt fonksiyonunu çağır
      handleSaveManualOutfit();
    }
  };

  return (
    <div className={`flex flex-col md:flex-row w-full h-screen bg-primary overflow-hidden transition-colors duration-300`}>
      {/* Mobil Header (İnce) */}
      <div className="md:hidden flex items-center justify-between bg-secondary border-b border-border-color px-5 py-3 shrink-0 z-20 shadow-sm transition-colors">
        <div className="font-black text-primary tracking-widest text-lg">AURA</div>
        <div className="flex items-center gap-3">
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-text-secondary hover:text-text-primary bg-primary rounded-xl transition-all">
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          {user && (
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              title="Menüyü Aç"
              className="p-2 text-text-secondary hover:text-text-primary bg-primary rounded-xl transition-all flex items-center justify-center shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          {missingCount > 0 && !enrichState.done && (
            <div className="flex items-center space-x-1.5 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">{missingCount} eksik</span>
            </div>
          )}
        </div>
      </div>

      {/* Sol Sidebar (Sadece Masaüstü) */}
      <aside className={`hidden md:flex flex-col w-64 border-r border-border-color bg-secondary p-6 shrink-0 h-full transition-colors`}>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-xs font-bold tracking-[0.2em] uppercase text-text-secondary mb-1">Aura</h1>
            <p className="text-lg font-semibold text-primary">Akıllı Gardırop</p>
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-text-secondary hover:text-text-primary hover:bg-primary rounded-xl transition-all">
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <nav className="space-y-4 flex-grow">
          <div
            onClick={() => setActiveTab('koleksiyon')}
            className={`flex items-center space-x-3 cursor-pointer pl-4 transition-colors ${activeTab === 'koleksiyon' ? 'text-primary font-medium relative -ml-4' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {activeTab === 'koleksiyon' && <div className="absolute left-0 w-1.5 h-6 bg-indigo-600 rounded-r-full" />}
            <span>Koleksiyon</span>
          </div>
          <div
            onClick={() => setActiveTab('kombinlerim')}
            className={`flex items-center space-x-3 cursor-pointer pl-4 transition-colors ${activeTab === 'kombinlerim' ? 'text-primary font-medium relative -ml-4' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {activeTab === 'kombinlerim' && <div className="absolute left-0 w-1.5 h-6 bg-indigo-600 rounded-r-full" />}
            <span>Kombinlerim</span>
          </div>
          <div
            onClick={() => setActiveTab('istatistikler')}
            className={`flex items-center space-x-3 cursor-pointer pl-4 transition-colors ${activeTab === 'istatistikler' ? 'text-primary font-medium relative -ml-4' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {activeTab === 'istatistikler' && <div className="absolute left-0 w-1.5 h-6 bg-indigo-600 rounded-r-full" />}
            <span>İstatistikler</span>
          </div>
          <div
            onClick={() => setActiveTab('kesfet')}
            className={`flex items-center space-x-3 cursor-pointer pl-4 transition-colors ${activeTab === 'kesfet' ? 'text-primary font-medium relative -ml-4' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {activeTab === 'kesfet' && <div className="absolute left-0 w-1.5 h-6 bg-indigo-600 rounded-r-full" />}
            <span>Keşfet</span>
          </div>
          <div
            onClick={() => setActiveTab('hesap')}
            className={`flex items-center space-x-3 cursor-pointer pl-4 transition-colors ${activeTab === 'hesap' ? 'text-primary font-medium relative -ml-4' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {activeTab === 'hesap' && <div className="absolute left-0 w-1.5 h-6 bg-indigo-600 rounded-r-full" />}
            <span>Hesap Ayarları</span>
          </div>

          <div className="pt-4 mt-4 border-t border-border-color">
            <button
              onClick={handleToggleSelectionMode}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${isSelectionMode
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-primary text-text-secondary hover:text-text-primary border border-border-color'
                }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles className={`w-4 h-4 ${isSelectionMode ? 'text-white' : 'text-indigo-600'}`} />
                <span className="text-xs font-bold uppercase tracking-wider">Manuel Kombin</span>
              </div>
              {isSelectionMode && <X className="w-4 h-4" />}
            </button>

            {/* Stil Kimliği (Kişisel Bağlam) Bölümü */}
            <div className="mt-3">
              <button
                onClick={() => setShowContextInput(!showContextInput)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${showContextInput
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'bg-secondary border border-border-color text-text-secondary hover:border-text-primary'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <Fingerprint className={`w-4 h-4 ${showContextInput ? 'text-white' : 'text-gray-400'}`} />
                  <span className="text-xs font-bold uppercase tracking-wider">Stil Kimliğim</span>
                </div>
                {showContextInput ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <AnimatePresence>
                {showContextInput && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2 pb-1">
                      <textarea
                        value={personalContext}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPersonalContext(val);
                          localStorage.setItem('aura_personal_context', val);
                        }}
                        placeholder="Örn: Genelde monokromatik giyinirim, minimalist ve oversize kesimleri tercih ederim..."
                        className="w-full h-32 p-3 text-xs bg-primary border border-border-color rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 resize-none placeholder:text-text-secondary/50 text-text-primary leading-relaxed transition-colors"
                      />
                      <p className="mt-2 text-[10px] text-text-secondary px-1 italic">
                        * Bu metin tüm AI önerilerini etkiler.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </nav>

        <div className="pt-6 border-t border-border-color space-y-3">
          <div className="bg-primary/50 rounded-xl p-4 transition-colors">
            <p className="text-[11px] uppercase tracking-wider text-text-secondary mb-2 font-bold">Durum</p>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-text-secondary">Yerel Önbellek Aktif</span>
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="text-xs text-text-secondary">Vision AI Aktif</span>
            </div>
            {missingCount > 0 && !enrichState.done && (
              <div className="flex items-center space-x-2 mt-1">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{missingCount} eksik bilgi var</span>
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
            onClick={() => fetchWardrobe()}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-primary rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Yenileniyor...' : 'Gardırobu Yenile'}
          </button>

          {/* User Session Row */}
          {user && (
            <div className="pt-4 mt-2 border-t border-border-color/50 flex items-center justify-between overflow-hidden shrink-0">
              <div 
                onClick={() => setActiveTab('hesap')}
                className="flex items-center gap-2 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-black shrink-0 shadow-md shadow-indigo-500/10">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col overflow-hidden text-left">
                  <span className="text-xs font-semibold text-text-primary truncate">{user.name}</span>
                  <span className="text-[10px] text-text-secondary truncate">{user.email}</span>
                </div>
              </div>
              <button
                onClick={logout}
                title="Çıkış Yap"
                className="p-2 text-text-secondary hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Ana İçerik */}
      <main className="flex-1 flex flex-col p-4 pb-24 md:pb-8 md:p-8 overflow-hidden h-full z-10 relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 shrink-0 gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-light text-text-primary mb-1">
              {activeTab === 'koleksiyon' && 'Gardırop'}
              {activeTab === 'kombinlerim' && 'Kombinlerim'}
              {activeTab === 'istatistikler' && 'İstatistikler'}
              {activeTab === 'hesap' && 'Hesap Ayarları'}
              {activeTab === 'kesfet' && 'Dolap Keşfet'}
            </h2>
            <p className="text-xs md:text-sm text-text-secondary">
              {activeTab === 'koleksiyon' && (loading ? 'Yükleniyor...' : `${items.length} parça · Bulut Veritabanı`)}
              {activeTab === 'kombinlerim' && `${savedOutfits.length} kombin kaydedildi`}
              {activeTab === 'istatistikler' && 'Sistem Analizi & Yapay Zeka Durumu'}
              {activeTab === 'hesap' && 'Profilinizi ve güvenliğinizi yönetin'}
              {activeTab === 'kesfet' && 'Diğer tarz sahiplerini ve açık gardıropları keşfedin'}
            </p>
          </div>
          <div className="flex space-x-2">
            {activeTab === 'koleksiyon' && (
              <div className="flex items-center gap-2">
                {isSelectionMode && (
                  <button
                    onClick={handleToggleSelectionMode}
                    className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all"
                  >
                    Vazgeç
                  </button>
                )}
                <button
                  onClick={() => setShowAddModal(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Yeni Ekle
                </button>
              </div>
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
                    animate={{
                      opacity: 1,
                      y: 0,
                      height: isResultVisible ? 'auto' : '64px'
                    }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`mb-8 md:mb-12 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-500/20 rounded-3xl p-4 md:p-8 overflow-hidden transition-all duration-500`}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-2 rounded-lg">
                          <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-xl font-semibold text-indigo-900 dark:text-indigo-100">AI Tavsiyesi</h3>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3">
                        {isResultVisible && result && (
                          <div className="hidden sm:block bg-secondary px-4 py-2 rounded-full border border-border-color">
                            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">%{result?.compatibilityScore || 0} Uyum</span>
                          </div>
                        )}
                        <button
                          onClick={() => setIsResultVisible(!isResultVisible)}
                          className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border-color text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold hover:bg-primary transition-all"
                        >
                          {isResultVisible ? (
                            <><EyeOff className="w-4 h-4" /><span>Gizle</span></>
                          ) : (
                            <><Eye className="w-4 h-4" /><span>Kombini Göster</span></>
                          )}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isResultVisible && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            {selectedItemsDetails.map(item => (
                              <div key={item.id} className="bg-secondary p-3 rounded-2xl border border-border-color shadow-sm relative group transition-colors">
                                <div className="aspect-square bg-primary rounded-xl mb-3 overflow-hidden relative">
                                  <img src={item.imagePath} alt={item.name}
                                    loading="lazy" decoding="async"
                                    className="w-full h-full object-contain mix-blend-normal dark:opacity-90"
                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                  <div className="absolute inset-0 bg-black/5 pointer-events-none" />

                                  {/* Kilit İkonu (Sabit Görüntü) */}
                                  {lockedItems.includes(item.id) && (
                                    <div className="absolute top-2 left-2 bg-amber-500 text-white p-1.5 rounded-lg shadow-sm z-10 group-hover:opacity-0 transition-opacity">
                                      <Lock className="w-3 h-3" />
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">{CATEGORY_LABELS[item.category] || item.category}</p>
                                <p className="text-sm font-medium text-text-primary truncate">{item.name}</p>

                                {/* Kilitle / Değiştir Butonları */}
                                <div className="absolute -top-3 -right-3 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                                  <button
                                    onClick={() => setLockedItems(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])}
                                    title={lockedItems.includes(item.id) ? "Kilidi Aç" : "Bu Parçayı Sabitle"}
                                    className={`bg-secondary border shadow-md rounded-full p-2 transition-all ${lockedItems.includes(item.id) ? 'border-amber-400 text-amber-500 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100' : 'border-border-color text-text-secondary hover:text-indigo-600 hover:border-indigo-300'}`}
                                  >
                                    {lockedItems.includes(item.id) ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => handleReplaceItem(item.id)}
                                    disabled={isGenerating || lockedItems.includes(item.id)}
                                    title={lockedItems.includes(item.id) ? "Kilitli parça değiştirilemez" : "Sadece bu parçayı değiştir"}
                                    className="bg-secondary border border-border-color shadow-md text-text-secondary hover:text-indigo-600 hover:border-indigo-300 rounded-full p-2 transition-all disabled:opacity-30 disabled:hover:text-text-secondary disabled:hover:border-border-color"
                                  >
                                    <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin text-indigo-600' : ''}`} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="bg-secondary/50 backdrop-blur-sm p-6 rounded-2xl border border-border-color mb-6 transition-colors shadow-inner">
                            <p className="text-sm text-text-primary leading-relaxed italic">"{result?.stylingReason || 'Bu kombin senin için özenle seçildi.'}"</p>
                          </div>

                          <div className="flex justify-end gap-3 border-t border-indigo-100 dark:border-indigo-500/10 pt-4 mt-2">
                            <button
                              onClick={handleReroll}
                              disabled={isGenerating}
                              className="flex items-center gap-2 px-5 py-2 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-sm font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all disabled:opacity-50"
                            >
                              <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                              Yeniden Üret
                            </button>
                            <button
                              onClick={async () => {
                                const name = await ask('Kombin İsmi', 'Favori Kombinim');
                                if (!name) return;
                                try {
                                  const token = localStorage.getItem('aura_token');
                                  const res = await fetch('/api/outfits', {
                                    method: 'POST',
                                    headers: { 
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify({
                                      name,
                                      items: result?.selectedItems || [],
                                      stylingReason: result?.stylingReason || '',
                                      compatibilityScore: result?.compatibilityScore || 0
                                    })
                                  });
                                  if (res.ok) {
                                    notify('Kombin kaydedildi!', 'success');
                                    fetchOutfits();
                                  } else throw new Error();
                                } catch {
                                  notify('Kombin kaydedilemedi', 'error');
                                }
                              }}
                              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-500/20"
                            >
                              <Save className="w-4 h-4" />
                              Kombini Kaydet
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                
                {!isResultVisible && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-indigo-50/30 dark:bg-indigo-900/5 border border-indigo-100/30 dark:border-indigo-500/5 p-4 rounded-xl text-center mt-2"
                        >
                          <p className="text-[11px] text-indigo-600/60 dark:text-indigo-400/60 font-medium italic">
                            Kombin detayları şu an daraltıldı. Detaylı analiz ve parçaları görmek için yukarıdaki butonu kullanabilirsin.
                          </p>
                        </motion.div>
                      )}
                  </motion.section>
                )}
              </AnimatePresence>

              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-gray-100 border-t-black rounded-full animate-spin" />
                </div>
              ) : (
                <WardrobeGrid
                  items={items}
                  onDelete={handleDeleteItem}
                  onClickItem={setSelectedItem}
                  isSelectionMode={isSelectionMode}
                  selectedItems={selectedForOutfit}
                  onSelectItem={handleItemSelect}
                  hasMore={hasMore}
                  onLoadMore={() => fetchWardrobe(page + 1, true)}
                />
              )}
            </>
          ) : activeTab === 'kombinlerim' ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20">
              {savedOutfits.length === 0 ? (
                <div className="col-span-full py-20 text-center text-text-secondary">
                  <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Henüz kaydedilmiş kombin yok</p>
                </div>
              ) : (
                savedOutfits.map(outfit => (
                  <div key={outfit.id} className="bg-secondary border border-border-color rounded-2xl p-6 shadow-sm transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-primary">{outfit.name}</h3>
                        <p className="text-xs text-text-secondary">{new Date(outfit.createdAt).toLocaleDateString('tr-TR')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-md">%{outfit.compatibilityScore} Uyum</span>

                        <button
                          onClick={() => handleEditOutfit(outfit)}
                          className="p-1.5 text-text-secondary hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleAddItemToOutfit(outfit.id)}
                          className="p-1.5 text-text-secondary hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          title="Parça Ekle"
                        >
                          <Plus className="w-4 h-4" />
                        </button>

                        <button
                          onClick={async () => {
                            const ok = await askConfirm('Kombini Sil', 'Bu kombini silmek istediğinize emin misiniz?');
                            if (!ok) return;
                            const token = localStorage.getItem('aura_token');
                            await fetch(`/api/outfits/${outfit.id}`, { 
                              method: 'DELETE',
                              headers: {
                                'Authorization': `Bearer ${token}`
                              }
                            });
                            fetchOutfits();
                          }}
                          className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                      <div className="flex gap-3 mb-4 overflow-x-auto pb-4 custom-scrollbar no-scrollbar">
                        {outfit.items.map(itemId => {
                          const item = items.find(i => i.id === itemId);
                          if (!item) return null;
                          return (
                            <div key={itemId} className="w-24 shrink-0 group relative">
                              <div className="aspect-square bg-primary rounded-2xl mb-1.5 overflow-hidden border border-border-color group-hover:border-indigo-200 transition-all cursor-pointer" onClick={() => setSelectedItem(item)}>
                                <img src={item.imagePath} alt={item.name}
                                  loading="lazy" decoding="async"
                                  className="w-full h-full object-cover" />
                              </div>
                              <p className="text-[10px] text-center text-text-secondary truncate px-1">{item.name}</p>
                              
                              {/* Parçayı Kombinden Çıkar Butonu */}
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const ok = await askConfirm('Parçayı Çıkar', 'Bu parçayı kombinden çıkarmak istediğinize emin misiniz?');
                                  if (!ok) return;
                                  
                                  const newItems = outfit.items.filter(id => id !== itemId);
                                  if (newItems.length === 0) {
                                    notify('Kombin en az bir parça içermelidir. Kombini tamamen silmeyi deneyin.', 'info');
                                    return;
                                  }

                                  const token = localStorage.getItem('aura_token');
                                  try {
                                    const res = await fetch(`/api/outfits/${outfit.id}`, {
                                      method: 'PUT',
                                      headers: { 
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                      },
                                      body: JSON.stringify({ items: newItems })
                                    });
                                    if (res.ok) {
                                      notify('Parça kombinden çıkarıldı.', 'success');
                                      fetchOutfits();
                                    }
                                  } catch {
                                    notify('İşlem başarısız.', 'error');
                                  }
                                }}
                                className="absolute -top-1 -right-1 p-1 bg-white dark:bg-gray-800 text-rose-500 border border-rose-100 dark:border-rose-900/30 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-text-secondary bg-primary/50 p-3 rounded-xl italic border border-border-color/50 transition-colors">"{outfit.stylingReason}"</p>
                    </div>
                  ))
                )}
              </div>
          ) : activeTab === 'hesap' ? (
            <AccountSettings />
          ) : activeTab === 'kesfet' ? (
            <Explore />
          ) : (
            <StatsDashboard />
          )}
        </div>
      </main>

      {/* Sağ Sidebar */}
      <section className={`fixed md:relative inset-y-0 right-0 z-50 w-full sm:w-80 md:w-80 bg-secondary border-l border-border-color p-6 md:p-8 flex flex-col h-full shrink-0 transform transition-transform duration-300 ease-in-out ${mobilePlannerOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
        <div className="flex justify-between items-center mb-6 md:hidden">
          <div className="flex items-center gap-2 text-indigo-600">
            <Zap className="w-5 h-5 fill-current" />
            <span className="font-bold uppercase tracking-wider text-sm">Karar Motoru</span>
          </div>
          <button onClick={() => setMobilePlannerOpen(false)} className="p-2 text-text-secondary hover:text-text-primary bg-primary rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mb-8 overflow-y-auto flex-grow custom-scrollbar space-y-8 pr-1 no-scrollbar">
          {/* Mobil İçin Ek Araçlar (Sidebar'dan buraya taşındı) */}
          <div className="md:hidden space-y-3 mb-6">
            <button
              onClick={() => { handleToggleSelectionMode(); setMobilePlannerOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all ${isSelectionMode
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-primary border border-border-color text-text-secondary'
                }`}
            >
              <div className="flex items-center gap-3">
                <Sparkles className={`w-5 h-5 ${isSelectionMode ? 'text-white' : 'text-indigo-600'}`} />
                <span className="text-sm font-bold uppercase tracking-wider">Manuel Kombin</span>
              </div>
              {isSelectionMode && <X className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setShowContextInput(!showContextInput)}
              className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all ${showContextInput
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-primary border border-border-color text-text-secondary'
                }`}
            >
              <div className="flex items-center gap-3">
                <Fingerprint className={`w-5 h-5 ${showContextInput ? 'text-white' : 'text-indigo-600'}`} />
                <span className="text-sm font-bold uppercase tracking-wider">Stil Kimliğim</span>
              </div>
              {showContextInput ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <AnimatePresence>
              {showContextInput && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-2 pb-4">
                    <textarea
                      value={personalContext}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPersonalContext(val);
                        localStorage.setItem('aura_personal_context', val);
                      }}
                      placeholder="Stilinizi tanımlayın..."
                      className="w-full h-32 p-4 text-sm bg-primary border border-border-color rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 resize-none text-text-primary leading-relaxed"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {missingCount > 0 && !enrichState.running && (
              <button
                onClick={handleEnrich}
                className="w-full flex items-center justify-center gap-3 py-4 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-2xl transition-all shadow-lg shadow-amber-500/20"
              >
                <Wand2 className="w-5 h-5" />
                {missingCount} Öğeyi AI ile Tamamla
              </button>
            )}

            <div className="h-px bg-border-color my-6 opacity-50" />
          </div>

          <OutfitPlanner
            items={items}
            onGenerate={(req) => { handleGenerate(req); setMobilePlannerOpen(false); }}
            isGenerating={isGenerating}
            generationStatus={generationStatus}
            onNotify={notify}
          />
        </div>
      </section>

      {/* Sağ Sidebar Backdrop */}
      {mobilePlannerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setMobilePlannerOpen(false)} />
      )}

      {/* Yeni Kıyafet Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddItemModal
            onClose={() => setShowAddModal(false)}
            onAdded={handleItemAdded}
            onNotify={notify}
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
            onNotify={notify}
          />
        )}
      </AnimatePresence>

      {/* Manuel Kombin Bar */}
      <AnimatePresence>
        {isSelectionMode && selectedForOutfit.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-gray-900 text-white px-4 md:px-6 py-3 md:py-4 rounded-3xl shadow-2xl flex items-center gap-3 md:gap-6 w-[calc(100vw-2rem)] max-w-[480px] border border-white/10 backdrop-blur-xl"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Seçilen Parçalar</span>
              <span className="text-sm font-semibold">{selectedForOutfit.length} Kıyafet</span>
            </div>

            <div className="h-8 w-px bg-white/10" />

            <div className="flex gap-2 flex-grow overflow-x-auto max-w-[200px] no-scrollbar">
              {selectedForOutfit.map(id => {
                const item = items.find(i => i.id === id);
                return (
                  <div key={id} className="w-8 h-8 rounded-lg overflow-hidden border border-white/20 shrink-0">
                    <img src={item?.imagePath} className="w-full h-full object-cover" alt="" />
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleSaveManualOutfitExtended}
              className="bg-indigo-600 text-white px-6 py-2 rounded-2xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 whitespace-nowrap"
            >
              {targetOutfitId ? 'Kombine Ekle' : 'Kombini Tamamla'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Mobil Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-secondary/90 backdrop-blur-md border-t border-border-color pb-safe z-[60] shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] transition-colors">
        <div className="flex justify-around items-center h-16 px-2">
          <button onClick={() => { setActiveTab('koleksiyon'); setMobilePlannerOpen(false); }} className={`flex flex-col items-center justify-center w-14 h-full transition-colors ${activeTab === 'koleksiyon' && !mobilePlannerOpen ? 'text-indigo-600' : 'text-text-secondary'}`}>
            <Shirt className={`w-5 h-5 mb-1 ${activeTab === 'koleksiyon' && !mobilePlannerOpen ? 'fill-indigo-50 dark:fill-indigo-900/20' : ''}`} />
            <span className="text-[10px] font-bold tracking-tight">Koleksiyon</span>
          </button>
          <button onClick={() => { setActiveTab('kombinlerim'); setMobilePlannerOpen(false); }} className={`flex flex-col items-center justify-center w-14 h-full transition-colors ${activeTab === 'kombinlerim' && !mobilePlannerOpen ? 'text-indigo-600' : 'text-text-secondary'}`}>
            <LayoutGrid className={`w-5 h-5 mb-1 ${activeTab === 'kombinlerim' && !mobilePlannerOpen ? 'fill-indigo-50 dark:fill-indigo-900/20' : ''}`} />
            <span className="text-[10px] font-bold tracking-tight">Kombinler</span>
          </button>

          {/* Ortadaki Yüzer Ekleme Butonu (FAB) */}
          <div className="relative -top-5 flex flex-col items-center">
            <button
              onClick={() => { setShowAddModal(true); setMobilePlannerOpen(false); }}
              className="bg-indigo-600 text-white p-3.5 rounded-2xl shadow-xl shadow-indigo-600/20 active:scale-95 hover:scale-105 transition-all"
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>

          <button onClick={() => setMobilePlannerOpen(!mobilePlannerOpen)} className={`flex flex-col items-center justify-center w-14 h-full transition-colors ${mobilePlannerOpen ? 'text-indigo-600' : 'text-text-secondary'}`}>
            <Zap className={`w-5 h-5 mb-1 ${mobilePlannerOpen ? 'fill-indigo-50 dark:fill-indigo-900/20' : ''}`} />
            <span className="text-[10px] font-bold tracking-tight">AI Asistan</span>
          </button>
          <button onClick={() => { setActiveTab('istatistikler'); setMobilePlannerOpen(false); }} className={`flex flex-col items-center justify-center w-14 h-full transition-colors ${activeTab === 'istatistikler' && !mobilePlannerOpen ? 'text-indigo-600' : 'text-text-secondary'}`}>
            <BarChart2 className={`w-5 h-5 mb-1 ${activeTab === 'istatistikler' && !mobilePlannerOpen ? 'fill-indigo-50 dark:fill-indigo-900/20' : ''}`} />
            <span className="text-[10px] font-bold tracking-tight">Durum</span>
          </button>
        </div>
      </div>

      {/* Mobil Menü Çekmecesi (Mobile Drawer Menu) */}
      <AnimatePresence>
        {isMobileDrawerOpen && (
          <>
            {/* Karartma Maskesi */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileDrawerOpen(false)}
              className="md:hidden fixed inset-0 bg-black z-[100]"
            />
            {/* Drawer Gövdesi */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="md:hidden fixed inset-y-0 left-0 w-[280px] max-w-[85%] bg-secondary border-r border-border-color z-[101] flex flex-col p-6 shadow-2xl transition-colors text-left"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xs font-bold tracking-[0.2em] uppercase text-text-secondary mb-0.5">Aura</h3>
                  <p className="text-base font-semibold text-primary">Akıllı Gardırop</p>
                </div>
                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-2 hover:bg-primary rounded-xl transition-all text-text-secondary hover:text-text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Kullanıcı Bilgisi */}
              {user && (
                <div className="flex items-center gap-3 p-4 bg-primary/40 border border-border-color/50 rounded-2xl mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-black shadow-md shadow-indigo-500/10 shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-xs font-semibold text-text-primary truncate">{user.name}</span>
                    <span className="text-[10px] text-text-secondary truncate">@{user.username}</span>
                  </div>
                </div>
              )}

              {/* Linkler */}
              <nav className="space-y-2 flex-grow">
                <button
                  onClick={() => { setActiveTab('koleksiyon'); setMobilePlannerOpen(false); setIsMobileDrawerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left text-xs font-bold uppercase tracking-wider ${activeTab === 'koleksiyon' && !mobilePlannerOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-text-secondary hover:text-text-primary hover:bg-primary'}`}
                >
                  <Shirt className="w-4 h-4" />
                  <span>Koleksiyonum</span>
                </button>
                
                <button
                  onClick={() => { setActiveTab('kombinlerim'); setMobilePlannerOpen(false); setIsMobileDrawerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left text-xs font-bold uppercase tracking-wider ${activeTab === 'kombinlerim' && !mobilePlannerOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-text-secondary hover:text-text-primary hover:bg-primary'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Kombinlerim</span>
                </button>

                <button
                  onClick={() => { setActiveTab('kesfet'); setMobilePlannerOpen(false); setIsMobileDrawerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left text-xs font-bold uppercase tracking-wider ${activeTab === 'kesfet' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-text-secondary hover:text-text-primary hover:bg-primary'}`}
                >
                  <LayoutGrid className="w-4 h-4 text-indigo-500" />
                  <span>Dolap Keşfet</span>
                </button>

                <button
                  onClick={() => { setActiveTab('istatistikler'); setMobilePlannerOpen(false); setIsMobileDrawerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left text-xs font-bold uppercase tracking-wider ${activeTab === 'istatistikler' && !mobilePlannerOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  <BarChart2 className="w-4 h-4" />
                  <span>İstatistikler</span>
                </button>

                <button
                  onClick={() => { setActiveTab('hesap'); setMobilePlannerOpen(false); setIsMobileDrawerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left text-xs font-bold uppercase tracking-wider ${activeTab === 'hesap' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-text-secondary hover:text-text-primary hover:bg-primary'}`}
                >
                  <User className="w-4 h-4" />
                  <span>Hesap Ayarları</span>
                </button>
              </nav>

              {/* Alt Kısım - Çıkış Yap */}
              <div className="pt-4 border-t border-border-color/50">
                <button
                  onClick={logout}
                  className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wider text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Çıkış Yap</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
