import React from 'react';
import type { WardrobeItem } from '../types';
import { apiFetch } from '../services/api';

interface ListResponse {
  items: WardrobeItem[];
  total: number;
  hasMore: boolean;
  page: number;
}

/**
 * Sunucu tarafında filtrelenen gardırop listesi (kategori + arama, sayfalı).
 * Yalnızca yüklenmiş ilk sayfayı süzmek yerine tüm gardıropta arar.
 */
export function useWardrobeQuery(category: string, query: string, options: { enabled?: boolean; pageSize?: number } = {}) {
  const enabled = options.enabled ?? true;
  const pageSize = options.pageSize ?? 40;
  const [items, setItems] = React.useState<WardrobeItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestRef = React.useRef(0);

  const load = React.useCallback(async (nextPage: number, append: boolean) => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(nextPage), limit: String(pageSize) });
    if (category && category !== 'all') params.set('category', category);
    if (query.trim()) params.set('q', query.trim());
    try {
      const data = await apiFetch<ListResponse>(`/api/wardrobe?${params.toString()}`);
      if (requestId !== requestRef.current) return; // daha yeni bir istek başladı
      setItems(prev => (append ? [...prev, ...data.items.filter(i => !prev.some(p => p.id === i.id))] : data.items));
      setTotal(data.total);
      setPage(data.page);
      setHasMore(data.hasMore);
    } catch (err: any) {
      if (requestId === requestRef.current) setError(err.message || 'Parçalar alınamadı.');
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [category, query, pageSize]);

  // Arama yazılırken her tuşta istek atılmasın
  React.useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => load(1, false), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [enabled, load, query]);

  return {
    items,
    total,
    hasMore,
    loading,
    error,
    loadMore: () => load(page + 1, true),
    reload: () => load(1, false),
    replaceItem: (updated: WardrobeItem) => setItems(prev => prev.map(i => (i.id === updated.id ? updated : i))),
    removeItem: (id: string) => {
      setItems(prev => prev.filter(i => i.id !== id));
      setTotal(prev => Math.max(0, prev - 1));
    },
  };
}
