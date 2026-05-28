import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Shirt, Calendar, X, Eye, ArrowLeft, Grid, Sparkles, User, HelpCircle } from 'lucide-react';
import { WardrobeItem, Category } from '../types';
import { CATEGORY_LABELS } from '../constants/wardrobe';
import { useNotification } from '../contexts/NotificationContext';

interface ExploreProfile {
  id: string;
  name: string;
  username: string;
  createdAt: string;
  itemCount: number;
}

export default function Explore() {
  const { notify } = useNotification();
  const [profiles, setProfiles] = useState<ExploreProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected user and their wardrobe data
  const [selectedUser, setSelectedUser] = useState<ExploreProfile | null>(null);
  const [userItems, setUserItems] = useState<WardrobeItem[]>([]);
  const [loadingWardrobe, setLoadingWardrobe] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('aura_token');
      const response = await fetch('/api/users/explore', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setProfiles(data.profiles || []);
    } catch (error) {
      console.error('Failed to fetch explore profiles:', error);
      notify('Keşfet profilleri yüklenemedi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewProfile = async (profile: ExploreProfile) => {
    setSelectedUser(profile);
    setUserItems([]);
    setLoadingWardrobe(true);
    setActiveCategory('all');

    try {
      const token = localStorage.getItem('aura_token');
      const response = await fetch(`/api/users/explore/${profile.id}/wardrobe`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 403) {
        notify('Bu kullanıcı profilini gizledi.', 'error');
        setSelectedUser(null);
        return;
      }

      if (!response.ok) throw new Error();

      const data = await response.json();
      setUserItems(data.items || []);
    } catch (error) {
      console.error('Failed to fetch user wardrobe:', error);
      notify('Kullanıcı gardırobu yüklenemedi.', 'error');
      setSelectedUser(null);
    } finally {
      setLoadingWardrobe(false);
    }
  };

  const filteredProfiles = profiles.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUserItems = activeCategory === 'all' 
    ? userItems 
    : userItems.filter(item => item.category === activeCategory);

  const categories: (Category | 'all')[] = ['all', 'top', 'bottom', 'outerwear', 'shoes', 'makeup', 'accessory'];

  return (
    <div className="relative w-full h-full animate-fade-in pb-16">
      <AnimatePresence mode="wait">
        {!selectedUser ? (
          // Keşfet Ana Liste Ekranı
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Arama Barı */}
            <div className="relative max-w-md">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-text-secondary">
                <Search className="w-5 h-5" />
              </span>
              <input
                type="text"
                placeholder="İsim veya kullanıcı adı ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-secondary border border-border-color rounded-2xl py-3.5 pl-12 pr-4 text-sm text-primary placeholder-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 shadow-sm"
              />
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="w-8 h-8 border-4 border-gray-100 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-xs text-text-secondary mt-3">Tarz sahipleri keşfediliyor...</p>
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="text-center py-20 bg-secondary/35 border border-border-color/60 rounded-3xl p-8">
                <Shirt className="w-12 h-12 mx-auto mb-3 opacity-25 text-text-secondary" />
                <p className="text-text-secondary font-medium">Aradığınız kriterlere uygun açık profil bulunamadı</p>
                <p className="text-xs text-text-secondary/60 mt-1">Gizli olmayan diğer kullanıcılar burada listelenir</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredProfiles.map((profile) => (
                  <motion.div
                    key={profile.id}
                    whileHover={{ scale: 1.01, y: -2 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => handleViewProfile(profile)}
                    className="group relative bg-secondary border border-border-color rounded-3xl p-6 shadow-sm hover:shadow-md cursor-pointer text-left transition-all overflow-hidden"
                  >
                    {/* Arkaplan Işıltısı */}
                    <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all duration-300" />
                    
                    <div className="flex items-center gap-4 mb-4">
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-black text-sm shadow-md shadow-indigo-500/10 shrink-0">
                        {profile.name.charAt(0).toUpperCase()}
                      </div>
                      
                      <div className="overflow-hidden">
                        <h4 className="font-bold text-primary truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {profile.name}
                        </h4>
                        <span className="text-xs text-text-secondary block truncate">
                          @{profile.username}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border-color/50">
                      <div className="flex items-center justify-between text-xs text-text-secondary">
                        <span className="flex items-center gap-1.5">
                          <Shirt className="w-3.5 h-3.5 text-indigo-500" />
                          Dolap Parçası:
                        </span>
                        <span className="font-bold text-primary">{profile.itemCount} kıyafet</span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-text-secondary">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          Katılım:
                        </span>
                        <span>
                          {new Date(profile.createdAt).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' })}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 flex justify-end">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Gardırobu İncele</span>
                        <Eye className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          // Seçilen Kullanıcının Gardırop Görünümü (Sosyal Profil Sayfası)
          <motion.div
            key="wardrobe"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Geri Dön Butonu ve Profil Başlığı */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-secondary border border-border-color rounded-3xl p-5 md:p-6 transition-colors shadow-sm text-left">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2.5 bg-primary border border-border-color hover:bg-secondary rounded-2xl transition-colors shrink-0 text-text-secondary hover:text-text-primary"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-1 rounded-md">
                      Açık Dolap
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-primary mt-1">{selectedUser.name}</h3>
                  <span className="text-xs text-text-secondary">@{selectedUser.username}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <span className="text-xs text-text-secondary block">Toplam Parça</span>
                  <span className="font-extrabold text-primary">{userItems.length} Kıyafet</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/10">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>

            {/* Kategori Filtreleri */}
            <div className="overflow-x-auto -mx-1 px-1 pb-1 no-scrollbar text-left">
              <div className="flex gap-1 bg-secondary p-1 rounded-xl w-max min-w-full sm:w-fit transition-colors">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex-shrink-0 px-3 sm:px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-primary text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    {CATEGORY_LABELS[cat] || cat}
                    {cat !== 'all' && (
                      <span className="ml-1 text-[10px] opacity-50">
                        {userItems.filter(i => i.category === cat).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Gardırop Grid Alanı */}
            {loadingWardrobe ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="w-8 h-8 border-4 border-gray-100 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-xs text-text-secondary mt-3">Dolap parçaları yükleniyor...</p>
              </div>
            ) : filteredUserItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-text-secondary opacity-50 bg-secondary/20 border border-border-color rounded-3xl">
                <Shirt className="w-12 h-12 mb-3" />
                <p className="text-sm font-medium">Bu kategoride açık kıyafet bulunmuyor</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
                {filteredUserItems.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group bg-secondary border border-border-color rounded-2xl p-3 md:p-4 transition-all shadow-sm hover:shadow-md text-left"
                  >
                    {/* Görsel */}
                    <div className="aspect-[3/4] bg-primary rounded-xl mb-3 flex items-center justify-center overflow-hidden relative transition-colors">
                      <img
                        src={item.imagePath}
                        alt={item.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain mix-blend-normal dark:opacity-90 group-hover:scale-102 transition-transform duration-300"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <Shirt className="w-10 h-10 text-text-secondary/10 group-hover:scale-110 transition-transform absolute -z-10" />
                      <div className="absolute inset-0 bg-black/5 pointer-events-none" />
                    </div>

                    {/* Bilgiler */}
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">
                        {CATEGORY_LABELS[item.category] || item.category}
                      </p>
                      <h4 className="text-xs font-bold text-text-primary truncate">{item.name}</h4>
                      
                      {(item.color || item.style) && (
                        <p className="text-[10px] text-text-secondary truncate">
                          {item.color && <span className="mr-1">#{item.color.replace(/\s/g, '')}</span>}
                          {item.style && <span>#{item.style === 'casual' ? 'Günlük' : item.style === 'formal' ? 'Resmi' : item.style === 'sport' ? 'Spor' : item.style === 'elegant' ? 'Zarif' : item.style === 'bohemian' ? 'Bohem' : item.style}</span>}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
