import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { WardrobeItem } from '../types';
import { useNotification } from './NotificationContext';
import { useAuth } from './AuthContext';

interface EnrichState {
  running: boolean;
  total: number;
  current: number;
  currentName: string;
  enriched: number;
  done: boolean;
  message: string;
}

interface WardrobeContextType {
  items: WardrobeItem[];
  loading: boolean;
  page: number;
  hasMore: boolean;
  missingCount: number;
  enrichState: EnrichState;
  fetchWardrobe: (pageNum?: number, append?: boolean) => Promise<void>;
  handleEnrich: () => void;
  handleDeleteItem: (id: string) => Promise<void>;
  setItems: React.Dispatch<React.SetStateAction<WardrobeItem[]>>;
}

const WardrobeContext = createContext<WardrobeContextType | undefined>(undefined);

export function WardrobeProvider({ children }: { children: ReactNode }) {
  const { notify, askConfirm } = useNotification();
  const { token } = useAuth();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [enrichState, setEnrichState] = useState<EnrichState>({
    running: false, total: 0, current: 0, currentName: '', enriched: 0, done: false, message: ''
  });

  const missingCount = items.filter(i => {
    const needsFitPattern = ['top', 'bottom', 'outerwear'].includes(i.category);
    return !i.color || !i.style || !i.material || !(i as any).subCategory ||
      (needsFitPattern && (!(i as any).pattern || !(i as any).fit));
  }).length;

  const fetchWardrobe = useCallback(async (pageNum = 1, append = false) => {
    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      if (!append) setLoading(true);
      const response = await fetch(`/api/wardrobe?page=${pageNum}&limit=30`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (append) {
        setItems(prev => {
          const newItems = data.items || [];
          const existingIds = new Set(prev.map(i => i.id));
          return [...prev, ...newItems.filter((i: WardrobeItem) => !existingIds.has(i.id))];
        });
      } else {
        setItems(data.items || []);
      }
      setHasMore(data.hasMore);
      setPage(data.page);
    } catch (error) {
      console.error('Failed to fetch wardrobe:', error);
      if (!append) setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteItem = async (id: string) => {
    const ok = await askConfirm('Silmeyi Onayla', 'Bu kıyafeti silmek istediğinize emin misiniz? (Bu işlem geri alınamaz)');
    if (!ok) return;

    try {
      if (!token) return;
      const response = await fetch(`/api/wardrobe/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error();
      notify('Kıyafet silindi', 'success');
      fetchWardrobe(1, false);
    } catch {
      notify('Silme başarısız.', 'error');
    }
  };

  const handleEnrich = useCallback(() => {
    setEnrichState({ running: true, total: 0, current: 0, currentName: '', enriched: 0, done: false, message: '' });

    if (!token) return;
    fetch('/api/wardrobe/enrich', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        const pump = (): Promise<void> => reader.read().then(({ done, value }) => {
          if (done) { 
            setEnrichState(p => ({ ...p, running: false, done: true, message: 'Analiz tamamlandı.' }));
            fetchWardrobe(1, false); 
            setTimeout(() => setEnrichState(prev => ({ ...prev, done: false })), 5000);
            return; 
          }
          const text = decoder.decode(value);
          const lines = text.split('\n').filter(l => l.startsWith('data:'));
          for (const line of lines) {
            try {
              const event = JSON.parse(line.slice(5));
              if (event.type === 'start')    setEnrichState(p => ({ ...p, total: event.total }));
              if (event.type === 'progress') setEnrichState(p => ({ ...p, current: event.current, currentName: event.name }));
              if (event.type === 'item_done')setEnrichState(p => ({ ...p, enriched: p.enriched + 1 }));
              if (event.type === 'done')     {
                setEnrichState(p => ({ ...p, running: false, done: true, message: event.message }));
                notify(event.message, 'success');
              }
              if (event.type === 'error') {
                setEnrichState(p => ({ ...p, running: false, message: event.message }));
                notify(`Zenginleştirme hatası: ${event.message}`, 'error');
              }
            } catch {}
          }
          return pump();
        });
        return pump();
      })
      .catch(() => {
        setEnrichState(p => ({ ...p, running: false, message: 'Bağlantı koptu.' }));
        notify('Analiz sırasında bir hata oluştu.', 'error');
      });
  }, [fetchWardrobe, notify]);

  useEffect(() => {
    if (token) {
      fetchWardrobe(1, false);
    } else {
      setItems([]);
      setLoading(false);
    }
  }, [token, fetchWardrobe]);

  return (
    <WardrobeContext.Provider value={{ items, loading, page, hasMore, missingCount, enrichState, fetchWardrobe, handleEnrich, handleDeleteItem, setItems }}>
      {children}
    </WardrobeContext.Provider>
  );
}

export function useWardrobe() {
  const context = useContext(WardrobeContext);
  if (context === undefined) {
    throw new Error('useWardrobe must be used within a WardrobeProvider');
  }
  return context;
}
