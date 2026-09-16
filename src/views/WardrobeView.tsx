import React from 'react';
import { Plus, CheckSquare, Search, Sparkles, Wand2, CalendarCheck, BookmarkPlus, X } from 'lucide-react';
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
import { Button, IconButton, Chip, Notice, Spinner, EmptyState, cx } from '../components/ui/primitives';
import { Input } from '../components/ui/fields';
import { apiFetch } from '../services/api';

export default function WardrobeView() {
  const {
    items,
    loading,
    total,
    hasMore,
    page,
    missingCount,
    enrichState,
    fetchWardrobe,
    handleEnrich,
  } = useWardrobe();

  const { wearItems, refreshOutfits } = useStylist();
  const { notify, ask } = useNotification();

  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedItem, setSelectedItem] = React.useState<WardrobeItem | null>(null);
  const [showAddModal, setShowAddModal] = React.useState(false);

  // Çoklu seçim modu (giyim günlüğü veya hızlı kombin oluşturma için)
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [selectedItemIds, setSelectedItemIds] = React.useState<string[]>([]);
  const [actionLoading, setActionLoading] = React.useState(false);

  const openDaily = React.useMemo(() => new URLSearchParams(window.location.search).has('gunluk'), []);

  // Filtreleme
  const filteredItems = React.useMemo(() => {
    let result = items;
    if (selectedCategory !== 'all') {
      result = result.filter(item => item.category === selectedCategory);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(item =>
        item.name.toLowerCase().includes(q) ||
        (item.color && item.color.toLowerCase().includes(q)) ||
        (item.subCategory && item.subCategory.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, selectedCategory, searchQuery]);

  const toggleSelect = (id: string) => {
    setSelectedItemIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleCardClick = (item: WardrobeItem) => {
    if (selectionMode) {
      toggleSelect(item.id);
    } else {
      setSelectedItem(item);
    }
  };

  const handleBulkWear = async () => {
    if (selectedItemIds.length === 0) return;
    setActionLoading(true);
    try {
      await wearItems(selectedItemIds);
      setSelectedItemIds([]);
      setSelectionMode(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkSaveOutfit = async () => {
    if (selectedItemIds.length === 0) return;
    const name = await ask('Kombine bir ad ver', 'Özel Kombinim');
    if (!name) return;
    setActionLoading(true);
    try {
      await apiFetch('/api/outfits', {
        body: {
          name,
          items: selectedItemIds,
          source: 'manual',
        },
      });
      notify('Kombin kaydedildi.', 'success');
      await refreshOutfits();
      setSelectedItemIds([]);
      setSelectionMode(false);
    } catch (err: any) {
      notify(err.message || 'Kombin kaydedilemedi.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Sayfa Başlığı */}
      <PageHeader
        title="Gardırobum"
        subtitle={total !== undefined ? `${total} parça kıyafet` : `${items.length} parça`}
        actions={
          <div className="flex items-center gap-2">
            <IconButton
              label={selectionMode ? 'Seçimi İptal Et' : 'Çoklu Seçim'}
              variant={selectionMode ? 'accent' : 'surface'}
              onClick={() => {
                setSelectionMode(v => !v);
                setSelectedItemIds([]);
              }}
            >
              <CheckSquare className="w-5 h-5" />
            </IconButton>
            <Button
              size="md"
              variant="primary"
              onClick={() => setShowAddModal(true)}
              icon={<Plus className="w-5 h-5" />}
            >
              Ekle
            </Button>
          </div>
        }
      >
        <div className="space-y-3 pt-1">
          {/* Arama */}
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="İsim, marka, renk veya kategori ara…"
            leading={<Search className="w-4 h-4" />}
            className="h-10 text-sm"
          />

          {/* Kategori Çipleri */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
            <Chip
              selected={selectedCategory === 'all'}
              onClick={() => setSelectedCategory('all')}
              count={items.length}
            >
              Tümü
            </Chip>
            {CATEGORIES.map(cat => {
              const count = items.filter(i => i.category === cat).length;
              return (
                <Chip
                  key={cat}
                  selected={selectedCategory === cat}
                  onClick={() => setSelectedCategory(cat)}
                  count={count > 0 ? count : undefined}
                >
                  {CATEGORY_LABELS[cat] || cat}
                </Chip>
              );
            })}
          </div>
        </div>
      </PageHeader>

      {/* Günün Kombini Kartı */}
      <DailyPickCard
        autoLoad={openDaily}
        onNotify={notify}
        onWorn={() => fetchWardrobe(1)}
      />

      {/* Eksik Bilgi Tamamlama Bandı */}
      {missingCount > 0 && (
        <Notice
          tone="accent"
          icon={<Sparkles className="w-5 h-5 text-accent shrink-0" />}
          className="items-center justify-between"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
            <div>
              <p className="font-semibold text-ink">
                {missingCount} parçanın eksik bilgileri var
              </p>
              <p className="text-xs text-ink-2 mt-0.5">
                Yapay zeka ile renk, kumaş ve sezon bilgilerini otomatik tamamla.
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              loading={enrichState.running}
              onClick={handleEnrich}
              icon={<Wand2 className="w-4 h-4" />}
              className="shrink-0"
            >
              Tamamla
            </Button>
          </div>
        </Notice>
      )}

      {/* Kıyafet Izgarası */}
      {filteredItems.length === 0 && !loading ? (
        <EmptyState
          icon={<Plus className="w-8 h-8 text-ink-3" />}
          title={searchQuery ? 'Eşleşen parça bulunamadı' : 'Gardırobun henüz boş'}
          text={
            searchQuery
              ? 'Farklı bir arama terimi veya kategori deneyebilirsin.'
              : 'İlk kıyafet fotoğrafını ekleyerek akıllı stil asistanını kullanmaya başla.'
          }
          action={
            !searchQuery && (
              <Button onClick={() => setShowAddModal(true)} icon={<Plus className="w-4 h-4" />}>
                İlk Parçayı Ekle
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filteredItems.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              selectable={selectionMode}
              selected={selectedItemIds.includes(item.id)}
              onClick={() => handleCardClick(item)}
            />
          ))}
        </div>
      )}

      {/* Daha Fazla Yükle */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="secondary"
            loading={loading}
            onClick={() => fetchWardrobe(page + 1)}
          >
            Daha Fazla Yükle
          </Button>
        </div>
      )}

      {/* Seçim Modu Alt Çubuğu */}
      {selectionMode && (
        <div className="fixed bottom-20 lg:bottom-6 inset-x-4 max-w-lg mx-auto z-40">
          <div className="p-3 bg-surface/95 backdrop-blur-xl border border-line rounded-3xl shadow-float flex items-center justify-between gap-2">
            <div className="pl-2">
              <span className="text-sm font-bold text-ink">{selectedItemIds.length} parça</span>
              <p className="text-[11px] text-ink-3">seçildi</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                disabled={selectedItemIds.length === 0 || actionLoading}
                onClick={handleBulkWear}
                icon={<CalendarCheck className="w-4 h-4" />}
              >
                Giydim
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={selectedItemIds.length === 0 || actionLoading}
                onClick={handleBulkSaveOutfit}
                icon={<BookmarkPlus className="w-4 h-4" />}
              >
                Kaydet
              </Button>
              <IconButton
                size="sm"
                label="Kapat"
                variant="plain"
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedItemIds([]);
                }}
              >
                <X className="w-4 h-4" />
              </IconButton>
            </div>
          </div>
        </div>
      )}

      {/* Parça Detay Modalı */}
      <ItemDetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdate={() => fetchWardrobe(1)}
        onDeleted={() => setSelectedItem(null)}
      />

      {/* Parça Ekle Modalı */}
      <AddItemModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={() => {
          setShowAddModal(false);
          fetchWardrobe(1);
        }}
        onNotify={notify}
      />
    </div>
  );
}
