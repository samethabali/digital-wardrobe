import React from 'react';
import { Search } from 'lucide-react';
import type { WardrobeItem } from '../../types';
import { CATEGORIES, CATEGORY_LABELS } from '../../constants/wardrobe';
import { useWardrobe } from '../../contexts/WardrobeContext';
import { useWardrobeQuery } from '../../hooks/useWardrobeQuery';
import Sheet from '../ui/Sheet';
import { Button, Chip, Spinner } from '../ui/primitives';
import { Input } from '../ui/fields';
import ItemCard from './ItemCard';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Başlangıçta seçili parçalar */
  initialSelected?: string[];
  /** Seçilemeyecek parçalar (ör. kombinde zaten olanlar) */
  disabledIds?: string[];
  confirmLabel: string;
  onConfirm: (ids: string[], items: WardrobeItem[]) => void | Promise<void>;
}

/** Gardıroptan çoklu parça seçimi. Kategori ve arama sunucuda yapılır; tüm gardırop taranır. */
export default function ItemPickerSheet({ open, onClose, title, subtitle, initialSelected = [], disabledIds = [], confirmLabel, onConfirm }: Props) {
  const { categoryCounts } = useWardrobe();
  const [category, setCategory] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<Map<string, WardrobeItem | null>>(new Map());
  const [saving, setSaving] = React.useState(false);
  const list = useWardrobeQuery(category, query, { enabled: open, pageSize: 30 });

  React.useEffect(() => {
    if (open) setSelected(new Map(initialSelected.map(id => [id, null])));
    // Yalnızca açılışta başlangıç seçimini uygula
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (item: WardrobeItem) => {
    if (disabledIds.includes(item.id)) return;
    setSelected(prev => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  };

  const confirm = async () => {
    setSaving(true);
    try {
      const ids = Array.from(selected.keys());
      await onConfirm(ids, Array.from(selected.values()).filter(Boolean) as WardrobeItem[]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      fullHeight
      width="lg"
      zIndex={70}
      footer={
        <Button block size="lg" loading={saving} onClick={confirm}>
          {confirmLabel}{selected.size ? ` (${selected.size})` : ''}
        </Button>
      }
    >
      <div className="space-y-3 pt-1">
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Ad, renk veya tür ara…" leading={<Search className="w-4 h-4" />} />
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
          <Chip selected={category === 'all'} onClick={() => setCategory('all')}>Tümü</Chip>
          {CATEGORIES.filter(c => categoryCounts[c]).map(c => (
            <Chip key={c} selected={category === c} count={categoryCounts[c]} onClick={() => setCategory(c)}>{CATEGORY_LABELS[c]}</Chip>
          ))}
        </div>

        {list.loading && list.items.length === 0 ? (
          <div className="py-12 flex justify-center"><Spinner className="w-7 h-7" /></div>
        ) : list.items.length === 0 ? (
          <p className="text-sm text-ink-3 text-center py-12">Eşleşen parça yok.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {list.items.map(item => (
              <div key={item.id} className={disabledIds.includes(item.id) ? 'opacity-40 pointer-events-none' : ''}>
                <ItemCard item={item} selectable selected={selected.has(item.id)} onClick={() => toggle(item)} compact />
              </div>
            ))}
          </div>
        )}
        {list.hasMore && (
          <div className="flex justify-center pt-2">
            <Button variant="secondary" loading={list.loading} onClick={list.loadMore}>Daha fazla göster</Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
