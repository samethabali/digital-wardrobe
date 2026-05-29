import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Shirt, Calendar, ArrowLeft, Sparkles, Users, Bell, Eye, ChevronRight, X, CheckCircle2 } from 'lucide-react';
import { WardrobeItem, Category, CollabSession, ExploreProfile } from '../types';
import { CATEGORY_LABELS } from '../constants/wardrobe';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';

interface ExploreProps {
  onOpenCollabWith?: (user: ExploreProfile) => void;
}

export default function Explore({ onOpenCollabWith }: ExploreProps) {
  const { notify } = useNotification();
  const [profiles, setProfiles] = useState<ExploreProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected user and their wardrobe data
  const [selectedUser, setSelectedUser] = useState<ExploreProfile | null>(null);
  const [userItems, setUserItems] = useState<WardrobeItem[]>([]);
  const [loadingWardrobe, setLoadingWardrobe] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');

  const { user } = useAuth();

  // Collab Inbox
  const [collabSessions, setCollabSessions] = useState<CollabSession[]>([]);
  const [sentCollabSessions, setSentCollabSessions] = useState<CollabSession[]>([]);
  const [collabTab, setCollabTab] = useState<'incoming' | 'sent'>('incoming');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showInbox, setShowInbox] = useState(false);
  const [expandedCollab, setExpandedCollab] = useState<string | null>(null);
  // Initiator veya Friend gardırobunu cache'le (key: userId)
  const [collabItems, setCollabItems] = useState<Record<string, WardrobeItem[]>>({});
  // Kendi gardırobumu cache'le (inbox'ta 'Senin Kombinin' için)
  const [myOwnWardrobe, setMyOwnWardrobe] = useState<WardrobeItem[]>([]);

  useEffect(() => {
    fetchProfiles();
    fetchCollabInbox();
  }, []);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('aura_token');
      const response = await fetch('/api/users/explore', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setProfiles(data.profiles || []);
    } catch {
      notify('Keşfet profilleri yüklenemedi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCollabInbox = async () => {
    try {
      const token = localStorage.getItem('aura_token');
      // Gelen Collab'lar
      const res = await fetch('/api/collab/inbox', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCollabSessions(data.sessions || []);
        setUnreadCount(data.unreadCount || 0);
      }

      // Gönderilen Collab'lar
      const sentRes = await fetch('/api/collab/sent', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (sentRes.ok) {
        const sentData = await sentRes.json();
        setSentCollabSessions(sentData.sessions || []);
      }
    } catch {
      // sessiz başarısız
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
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 403) {
        notify('Bu kullanıcı profilini gizledi.', 'error');
        setSelectedUser(null);
        return;
      }
      if (!response.ok) throw new Error();
      const data = await response.json();
      setUserItems(data.items || []);
    } catch {
      notify('Kullanıcı gardırobu yüklenemedi.', 'error');
      setSelectedUser(null);
    } finally {
      setLoadingWardrobe(false);
    }
  };

  const handleMarkSeen = async (collabId: string) => {
    try {
      const token = localStorage.getItem('aura_token');
      await fetch(`/api/collab/${collabId}/seen`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setCollabSessions(prev => prev.map(s => s.id === collabId ? { ...s, seenByFriend: true } : s));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* sessiz */ }
  };

  const handleExpandCollab = async (session: CollabSession) => {
    if (expandedCollab === session.id) {
      setExpandedCollab(null);
      return;
    }
    setExpandedCollab(session.id);
    
    // Sadece alıcıysak ve henüz görülmediyse "görüldü" işaretle
    if (session.friendId === user?.id && !session.seenByFriend) {
      handleMarkSeen(session.id);
    }

    const token = localStorage.getItem('aura_token');
    
    // Arkadaşın gardırobunu çek (Gelen ise initiator, Gönderilen ise friendId)
    const targetUserId = session.friendId === user?.id ? session.initiatorId : session.friendId;

    if (targetUserId && !collabItems[targetUserId]) {
      try {
        const res = await fetch(`/api/users/explore/${targetUserId}/wardrobe`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setCollabItems(prev => ({ ...prev, [targetUserId]: data.items || [] }));
      } catch { /* sessiz */ }
    }

    // Kendi gardırobumuzu çek
    if (myOwnWardrobe.length === 0) {
      try {
        const res = await fetch('/api/wardrobe?limit=200', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setMyOwnWardrobe(data.items || []);
      } catch { /* sessiz */ }
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
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* ─── Üst Bar: Arama + Bildirim ─────────────────────────── */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
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

              {/* Collab Inbox Butonu */}
              <button
                onClick={() => setShowInbox(!showInbox)}
                className={`relative flex items-center gap-2 px-4 py-3.5 rounded-2xl border font-semibold text-sm transition-all shadow-sm ${
                  showInbox
                    ? 'bg-fuchsia-600 border-fuchsia-600 text-white shadow-fuchsia-500/20'
                    : 'bg-secondary border-border-color text-text-secondary hover:text-text-primary hover:border-fuchsia-300'
                }`}
              >
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Collab</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-fuchsia-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* ─── Collab Inbox Paneli ─────────────────────────────────── */}
            <AnimatePresence>
              {showInbox && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-secondary border border-border-color rounded-3xl overflow-hidden shadow-sm">
                    {/* Başlık */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border-color bg-gradient-to-r from-fuchsia-50/50 to-indigo-50/50 dark:from-fuchsia-900/10 dark:to-indigo-900/10">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-600 flex items-center justify-center shadow-md">
                          <Users className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-primary">Collab Paneli</h4>
                          <p className="text-[10px] text-text-secondary">
                            {collabSessions.length} gelen, {sentCollabSessions.length} gönderilen kombin
                          </p>
                        </div>
                      </div>
                      <button onClick={() => setShowInbox(false)} className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Tab Seçiciler */}
                    <div className="flex border-b border-border-color bg-primary/25">
                      <button
                        onClick={() => { setCollabTab('incoming'); setExpandedCollab(null); }}
                        className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
                          collabTab === 'incoming'
                            ? 'border-fuchsia-500 text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50/10'
                            : 'border-transparent text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <Bell className="w-3.5 h-3.5" />
                        Gelenler ({collabSessions.length})
                      </button>
                      <button
                        onClick={() => { setCollabTab('sent'); setExpandedCollab(null); }}
                        className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
                          collabTab === 'sent'
                            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/10'
                            : 'border-transparent text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Gönderilenler ({sentCollabSessions.length})
                      </button>
                    </div>

                    {(collabTab === 'incoming' ? collabSessions : sentCollabSessions).length === 0 ? (
                      <div className="py-12 text-center animate-fade-in">
                        <Users className="w-10 h-10 mx-auto mb-3 text-text-secondary opacity-20" />
                        <p className="text-sm text-text-secondary font-medium">
                          {collabTab === 'incoming' ? 'Henüz gelen collab daveti yok' : 'Henüz gönderilen collab kombinin yok'}
                        </p>
                        <p className="text-xs text-text-secondary/60 mt-1">
                          {collabTab === 'incoming'
                            ? 'Birisi seninle beraber kombin oluşturduğunda burada görünür'
                            : "Keşfet'ten bir arkadaşının profilindeki 'Kombin' butonu ile ilk beraber kombini oluşturabilirsin"}
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border-color">
                        {(collabTab === 'incoming' ? collabSessions : sentCollabSessions).map(session => {
                          const isExpanded = expandedCollab === session.id;
                          const isIncoming = session.friendId === user?.id;
                          const targetUserId = isIncoming ? session.initiatorId : session.friendId;
                          const targetUserName = isIncoming ? session.initiatorName : session.friendName;
                          
                          const targetWardrobe = collabItems[targetUserId] || [];
                          
                          // Düzeltildi & İki Yönlü Eşleştirildi:
                          // - "Senin Kombinin": Eğer Gelen ise friendOutfit, Gönderilen ise myOutfit kendi gardırobumuzdan (myOwnWardrobe) filtrelenir
                          // - "Arkadaşının Kombini": Eğer Gelen ise myOutfit, Gönderilen ise friendOutfit karşı tarafın gardırobundan filtrelenir
                          const myDisplayItems = myOwnWardrobe.filter(item => 
                            (isIncoming ? session.friendOutfit : session.myOutfit).includes(item.id)
                          );
                          const theirDisplayItems = targetWardrobe.filter(item => 
                            (isIncoming ? session.myOutfit : session.friendOutfit).includes(item.id)
                          );

                          return (
                            <motion.div key={session.id} layout className="overflow-hidden">
                              {/* Collab Özet Satırı */}
                              <button
                                onClick={() => handleExpandCollab(session)}
                                className={`w-full flex items-center gap-4 px-6 py-4 hover:bg-primary/50 transition-colors text-left ${
                                  isIncoming && !session.seenByFriend ? 'bg-fuchsia-50/30 dark:bg-fuchsia-900/5' : ''
                                }`}
                              >
                                {/* Avatar */}
                                <div className="relative shrink-0">
                                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-fuchsia-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                    {targetUserName.charAt(0).toUpperCase()}
                                  </div>
                                  {isIncoming && !session.seenByFriend && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-fuchsia-500 rounded-full border-2 border-secondary" />
                                  )}
                                </div>

                                <div className="flex-1 overflow-hidden">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <p className="text-sm font-bold text-text-primary truncate">
                                      {targetUserName}
                                    </p>
                                    {isIncoming && !session.seenByFriend && (
                                      <span className="text-[9px] font-black text-fuchsia-600 bg-fuchsia-100 dark:bg-fuchsia-900/30 px-1.5 py-0.5 rounded-full uppercase">Yeni</span>
                                    )}
                                    {!isIncoming && (
                                      session.seenByFriend ? (
                                        <span className="text-[9px] font-black text-green-600 bg-green-100 dark:bg-green-950/30 px-1.5 py-0.5 rounded-full uppercase">Görüldü</span>
                                      ) : (
                                        <span className="text-[9px] font-black text-indigo-600 bg-indigo-100 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded-full uppercase">İletildi</span>
                                      )
                                    )}
                                  </div>
                                  <p className="text-xs text-text-secondary truncate">
                                    {isIncoming 
                                      ? `✨ Beraber kombin oluşturdu · ${session.event}` 
                                      : `✉️ Birlikte kombin yolladın · ${session.event}`}
                                  </p>
                                  <p className="text-[10px] text-text-secondary/60 mt-0.5">
                                    {new Date(session.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="hidden sm:flex flex-col items-end">
                                    <span className="text-xs font-bold text-fuchsia-600">%{session.compatibilityScore}</span>
                                    <span className="text-[9px] text-text-secondary">Uyum</span>
                                  </div>
                                  <ChevronRight className={`w-4 h-4 text-text-secondary transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                </div>
                              </button>

                              {/* Genişletilmiş Collab Detayı */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="px-6 pb-5 space-y-4 bg-primary/30">
                                      {/* Stil Etiketi + Uyum */}
                                      <div className="flex items-center gap-3 pt-3">
                                        <div className="flex-1 bg-gradient-to-r from-fuchsia-500/10 to-indigo-500/10 border border-fuchsia-200/50 dark:border-fuchsia-500/20 rounded-xl px-4 py-2.5">
                                          <p className="text-[10px] font-bold text-fuchsia-600 uppercase tracking-wider mb-0.5">Stil Teması</p>
                                          <p className="text-sm font-bold text-text-primary">{session.styleHarmony}</p>
                                        </div>
                                        <div className="text-center px-4 py-2.5 bg-secondary border border-border-color rounded-xl">
                                          <p className="text-lg font-black text-fuchsia-600">%{session.compatibilityScore}</p>
                                          <p className="text-[9px] text-text-secondary uppercase font-bold">Uyum</p>
                                        </div>
                                      </div>

                                      {/* İki Kombin Grid */}
                                      <div className="grid grid-cols-2 gap-3">
                                        {/* Senin kombinin */}
                                        <div className="space-y-2">
                                          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                                            Senin Kombinin
                                          </p>
                                          {myDisplayItems.length > 0 ? (
                                            <div className="grid grid-cols-2 gap-1.5">
                                              {myDisplayItems.map(item => (
                                                <div key={item.id} className="aspect-square bg-secondary border border-border-color rounded-xl overflow-hidden animate-fade-in">
                                                  <img src={item.imagePath} alt={item.name} className="w-full h-full object-contain" loading="lazy" />
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <div className="grid grid-cols-2 gap-1.5">
                                              {(isIncoming ? session.friendOutfit : session.myOutfit).map((_, i) => (
                                                <div key={i} className="aspect-square bg-secondary border border-border-color rounded-xl flex items-center justify-center">
                                                  <Shirt className="w-5 h-5 text-text-secondary/20" />
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>

                                        {/* Arkadaşın kombini */}
                                        <div className="space-y-2">
                                          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-fuchsia-500 inline-block" />
                                            {targetUserName}
                                          </p>
                                          {theirDisplayItems.length > 0 ? (
                                            <div className="grid grid-cols-2 gap-1.5">
                                              {theirDisplayItems.map(item => (
                                                <div key={item.id} className="aspect-square bg-secondary border border-border-color rounded-xl overflow-hidden animate-fade-in">
                                                  <img src={item.imagePath} alt={item.name} className="w-full h-full object-contain" loading="lazy" />
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <div className="grid grid-cols-2 gap-1.5">
                                              {(isIncoming ? session.myOutfit : session.friendOutfit).map((_, i) => (
                                                <div key={i} className="aspect-square bg-secondary border border-border-color rounded-xl flex items-center justify-center">
                                                  <Shirt className="w-5 h-5 text-text-secondary/20" />
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* AI Açıklaması */}
                                      <div className="bg-fuchsia-50/50 dark:bg-fuchsia-900/10 border border-fuchsia-100 dark:border-fuchsia-500/10 rounded-xl p-4">
                                        <p className="text-xs text-text-primary leading-relaxed italic">"{session.collabReason}"</p>
                                      </div>

                                      {isIncoming && session.seenByFriend && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-green-600 dark:text-green-400">
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          <span className="font-medium">Görüldü</span>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}

                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── Profil Listesi ──────────────────────────────────────── */}
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
                    className="group relative bg-secondary border border-border-color rounded-3xl p-6 shadow-sm hover:shadow-md cursor-pointer text-left transition-all overflow-hidden"
                  >
                    {/* Arkaplan Işıltısı */}
                    <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all duration-300" />

                    <div className="flex items-center gap-4 mb-4" onClick={() => handleViewProfile(profile)}>
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-black text-sm shadow-md shadow-indigo-500/10 shrink-0">
                        {profile.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="font-bold text-primary truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {profile.name}
                        </h4>
                        <span className="text-xs text-text-secondary block truncate">@{profile.username}</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border-color/50" onClick={() => handleViewProfile(profile)}>
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
                        <span>{new Date(profile.createdAt).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' })}</span>
                      </div>
                    </div>

                    {/* Alt Butonlar */}
                    <div className="mt-4 pt-3 border-t border-border-color/30 flex gap-2">
                      <button
                        onClick={() => handleViewProfile(profile)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Gardırop</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenCollabWith?.(profile); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold text-fuchsia-600 dark:text-fuchsia-400 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20 rounded-xl transition-colors border border-fuchsia-200/50 dark:border-fuchsia-500/20"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Kombin</span>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          // Seçilen Kullanıcının Gardırop Görünümü
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
                {/* Beraber Kombin Yap Butonu */}
                {onOpenCollabWith && (
                  <button
                    onClick={() => onOpenCollabWith(selectedUser)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-fuchsia-500/20 hover:from-fuchsia-700 hover:to-indigo-700 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Beraber Kombin</span>
                  </button>
                )}
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
