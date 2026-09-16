import React from 'react';
import { Plus, CheckSquare, Search, Sparkles, Wand2, CalendarCheck, BookmarkPlus, X, SearchX } from 'lucide-react';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useStylist } from '../contexts/StylistContext';
import { useNotification } from '../contexts/NotificationContext';
import { CATEGORIES, CATEGORY_LABELS } from '../constants/wardrobe';
import type { WardrobeItem } from '../types';
import PageHeader from '../components/layout/PageHeader';
import DailyPickCard from '../components/DailyPickCard';
import ItemCard from '../components/wardrobe/ItemCard';
import AddItemModal from '../components/AddItemModal';
import ItemDetailModal from '../components/ItemDetailModal';
import { Button, IconButton, Chip, Notice, EmptyState } from '../components/ui/primitives';
import { Input } from '../components/ui/fields';
import { apiFetch } from '../services/api';
import { useWardrobeQuery } from '../hooks/useWardrobeQuery';

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i}>
          <div className="aspect-[4/5] rounded-2xl skeleton" />
          <div className="h-3.5 w-3/4 rounded skeleton mt-2.5" />
          <div className="h-3 w-1/2 rounded skeleton mt-1.5" />
        </div>
      ))}
    </div>
  );
}

export default function WardrobeView() {
  const {
    items, loading, total, categoryCounts, hasMore, page, missingCount, enrichState,
    fetchWardrobe, handleEnrich, replaceItem,
  } = useWardrobe();
  const { wearItems, refreshOutfits } = useStylist();
  const { notify, ask } = useNotification();

  const [category, setCategory] = React.useState<string>('all');
  const [showSearch, setShowSearch] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [selectedItem, setSelectedItem] = React.useState<WardrobeItem | null>(null);
  const [showAddModal, setShowAddModal] = React.useState(false);

  // Çoklu seçim (giyim günlüğü veya elle kombin kaydı)
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [actionLoading, setActionLoading] = React.useState(false);

  const openDaily = React.useMemo(() => new URLSearchParams(window.location.search).has('gunluk'), []);

  // Filtre veya arama varsa liste sunucuda süzülür (yüklenmiş ilk sayfa değil, tüm gardırop)
  const filtering = category !== 'all' || query.trim() !== '';
  const filtered = useWardrobeQuery(category, query, { enabled: filtering });
  const visibleItems = filtering ? filtered.items : items;
  const visibleLoading = filtering ? filtered.loading : loading;
  const visibleHasMore = filtering ? filtered.hasMore : hasMore;
  const loadMore = () => (filtering ? filtered.loadMore() : fetchWardrobe(page + 1, true));

  const clearFilters = () => {
    setCategory('all');
    setQuery('');
    setShowSearch(false);
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const handleCardClick = (item: WardrobeItem) => {
    if (selectionMode) {
      setSelectedIds(prev => (prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]));
    } else {
      setSelectedItem(item);
    }
  };

  const handleBulkWear = async () => {
    setActionLoading(true);
    try {
      await wearItems(selectedIds);
      exitSelection();
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkSaveOutfit = async () => {
    const name = await ask('Kombine bir ad ver', 'Kendi kombinim');
    if (!name) return;
    setActionLoading(true);
    try {
      await apiFetch('/api/outfits', { body: { name, items: selectedIds, source: 'manual' } });
      notify('Kombin kaydedildi.', 'success');
      await refreshOutfits();
      exitSelection();
    } catch (err: any) {
      notify(err.message || 'Kombin kaydedilemedi.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleItemUpdated = (updated: WardrobeItem) => {
    replaceItem(updated);
    filtered.replaceItem(updated);
    setSelectedItem(updated);
  };

  const wardrobeEmpty = !loading && total === 0 && items.length === 0;

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Gardırobum"
        subtitle={loading && total === 0 ? 'Yükleniyor…' : `${total} parça`}
        actions={
          <>
            <IconButton
              label={showSearch ? 'Aramayı kapat' : 'Ara'}
              variant={showSearch || query ? 'accent' : 'surface'}
              onClick={() => { if (showSearch) setQuery(''); setShowSearch(v => !v); }}
            >
              <Search className="w-5 h-5" />
            </IconButton>
            <IconButton
              label={selectionMode ? 'Seçimi bitir' : 'Parça seç'}
              variant={selectionMode ? 'accent' : 'surface'}
              onClick={() => (selectionMode ? exitSelection() : setSelectionMode(true))}
            >
              <CheckSquare className="w-5 h-5" />
            </IconButton>
            {/* Dar ekranda başlık kesilmesin diye yalnızca simge */}
            <span className="sm:hidden">
              <IconButton label="Parça ekle" variant="accent" onClick={() => setShowAddModal(true)}>
                <Plus className="w-5 h-5" />
              </IconButton>
            </span>
            <span className="hidden sm:block">
              <Button onClick={() => setShowAddModal(true)} icon={<Plus className="w-5 h-5" />}>Parça ekle</Button>
            </span>
          </>
        }
      >
        <div className="space-y-2.5">
          {showSearch && (
            <Input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Ad, renk, tür veya kumaş ara…"
              leading={<Search className="w-4 h-4" />}
              className="h-11"
            />
          )}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
            <Chip selected={category === 'all'} onClick={() => setCategory('all')} count={total}>Tümü</Chip>
            {CATEGORIES.filter(cat => categoryCounts[cat]).map(cat => (
              <Chip key={cat} selected={category === cat} onClick={() => setCategory(cat)} count={categoryCounts[cat]}>
                {CATEGORY_LABELS[cat] || cat}
              </Chip>
            ))}
          </div>
        </div>
      </PageHeader>

      {!filtering && !wardrobeEmpty && !selectionMode && (
        <DailyPickCard autoLoad={openDaily} onNotify={notify} onWorn={() => fetchWardrobe(1)} />
      )}

      {!filtering && missingCount > 0 && !selectionMode && (
        <Notice tone="accent" icon={<Sparkles className="w-5 h-5" />}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-ink">
                {enrichState.running
                  ? `Analiz ediliyor ${enrichState.current}/${enrichState.total}`
                  : `${missingCount} parçada eksik bilgi var`}
              </p>
              <p className="text-[12px] text-ink-2 mt-0.5 truncate">
                {enrichState.running ? enrichState.currentName : 'Renk, kumaş ve mevsim bilgilerini fotoğraftan tamamla.'}
              </p>
            </div>
            <Button size="sm" loading={enrichState.running} onClick={handleEnrich} icon={<Wand2 className="w-4 h-4" />} className="shrink-0">
              Tamamla
            </Button>
          </div>
        </Notice>
      )}

      {visibleLoading && visibleItems.length === 0 ? (
        <SkeletonGrid />
      ) : wardrobeEmpty ? (
        <EmptyState
          icon={<Plus className="w-8 h-8" />}
          title="Gardırobun henüz boş"
          text="İlk kıyafetinin fotoğrafını ekle; kategori, renk ve kumaşı otomatik dolduralım."
          action={<Button onClick={() => setShowAddModal(true)} icon={<Plus className="w-4 h-4" />}>İlk parçayı ekle</Button>}
        />
      ) : visibleItems.length === 0 ? (
        <EmptyState
          icon={<SearchX className="w-8 h-8" />}
          title={query.trim() ? 'Eşleşen parça bulunamadı' : 'Bu kategoride parça yok'}
          text={query.trim() ? `"${query.trim()}" için sonuç yok. Farklı bir kelime deneyebilirsin.` : undefined}
          action={<Button variant="secondary" onClick={clearFilters}>Filtreyi temizle</Button>}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {visibleItems.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              selectable={selectionMode}
              selected={selectedIds.includes(item.id)}
              onClick={() => handleCardClick(item)}
            />
          ))}
        </div>
      )}

      {visibleHasMore && visibleItems.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" loading={visibleLoading} onClick={loadMore}>Daha fazla göster</Button>
        </div>
      )}

      {/* Seçim çubuğu: alt menünün ve güvenli alanın üstünde */}
      {selectionMode && (
        <div className="fixed inset-x-3 z-40 max-w-lg mx-auto bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-6 lg:left-64">
          <div className="p-2.5 pl-4 bg-surface/95 backdrop-blur-xl border border-line rounded-3xl shadow-float flex items-center gap-2">
            <p className="text-sm font-semibold text-ink flex-1 min-w-0 truncate">
              {selectedIds.length ? `${selectedIds.length} parça seçildi` : 'Parçalara dokunarak seç'}
            </p>
            <Button size="sm" variant="secondary" disabled={!selectedIds.length || actionLoading} onClick={handleBulkWear} icon={<CalendarCheck className="w-4 h-4" />}>
              Giydim
            </Button>
            <Button size="sm" disabled={!selectedIds.length || actionLoading} onClick={handleBulkSaveOutfit} icon={<BookmarkPlus className="w-4 h-4" />}>
              Kaydet
            </Button>
            <IconButton size="sm" label="Seçimi kapat" onClick={exitSelection}>
              <X className="w-4 h-4" />
            </IconButton>
          </div>
        </div>
      )}

      <ItemDetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdate={handleItemUpdated}
        onDeleted={() => { if (selectedItem) filtered.removeItem(selectedItem.id); }}
      />

      <AddItemModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={() => {
          setShowAddModal(false);
          fetchWardrobe(1);
          if (filtering) filtered.reload();
        }}
        onNotify={notify}
      />
    </div>
  );
}
