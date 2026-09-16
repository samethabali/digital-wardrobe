import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, MoreHorizontal, CalendarCheck, Image as ImageIcon, Trash2, Edit2, Sparkles, Plus, X, FileText } from 'lucide-react';
import { useStylist } from '../contexts/StylistContext';
import { useNotification } from '../contexts/NotificationContext';
import { apiFetch } from '../services/api';
import type { SavedOutfit, WardrobeItem } from '../types';
import PageHeader from '../components/layout/PageHeader';
import OutfitCollage from '../components/OutfitCollage';
import ItemPickerSheet from '../components/wardrobe/ItemPickerSheet';
import Sheet from '../components/ui/Sheet';
import { Button, Card, IconButton, EmptyState, ItemImage } from '../components/ui/primitives';
import { CATEGORY_LABELS } from '../constants/wardrobe';

type Panel = 'options' | 'detail' | 'collage' | 'add' | null;

function MenuRow({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 h-13 rounded-2xl text-left text-[15px] font-semibold transition-colors ${danger ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-surface-2'}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default function OutfitsView() {
  const { savedOutfits, refreshOutfits, itemById, wearItems } = useStylist();
  const { notify, ask, askConfirm } = useNotification();
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [panel, setPanel] = React.useState<Panel>(null);
  const selected = savedOutfits.find(o => o.id === selectedId) || null;

  const open = (outfit: SavedOutfit, next: Panel) => {
    setSelectedId(outfit.id);
    setPanel(next);
  };

  const itemsOf = (outfit: SavedOutfit) => outfit.items.map(id => itemById.get(id)).filter((i): i is WardrobeItem => Boolean(i));

  const update = async (outfit: SavedOutfit, body: Record<string, unknown>, success: string) => {
    try {
      await apiFetch(`/api/outfits/${encodeURIComponent(outfit.id)}`, { method: 'PUT', body });
      notify(success, 'success');
      await refreshOutfits();
      return true;
    } catch (err: any) {
      notify(err.message || 'Güncellenemedi.', 'error');
      return false;
    }
  };

  const rename = async (outfit: SavedOutfit) => {
    const name = await ask('Kombinin adı', outfit.name);
    if (name && name !== outfit.name) await update(outfit, { name }, 'Ad güncellendi.');
  };

  const editReason = async (outfit: SavedOutfit) => {
    const stylingReason = await ask('Kombin notu', outfit.stylingReason || '');
    if (stylingReason !== null && stylingReason !== outfit.stylingReason) await update(outfit, { stylingReason }, 'Not güncellendi.');
  };

  const removeItem = async (outfit: SavedOutfit, itemId: string) => {
    if (outfit.items.length <= 1) {
      notify('Kombinde en az bir parça kalmalı. Kombini silmek için seçenekleri kullan.', 'info');
      return;
    }
    await update(outfit, { items: outfit.items.filter(id => id !== itemId) }, 'Parça çıkarıldı.');
  };

  const remove = async (outfit: SavedOutfit) => {
    const ok = await askConfirm('Kombini sil', `"${outfit.name}" silinecek. Parçaların gardırobunda kalır.`, 'Evet, sil');
    if (!ok) return;
    try {
      await apiFetch(`/api/outfits/${encodeURIComponent(outfit.id)}`, { method: 'DELETE' });
      notify('Kombin silindi.', 'success');
      setPanel(null);
      await refreshOutfits();
    } catch (err: any) {
      notify(err.message || 'Kombin silinemedi.', 'error');
    }
  };

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Kombinlerim"
        subtitle={`${savedOutfits.length} kayıtlı kombin`}
        actions={
          <Button onClick={() => navigate('/olustur')} icon={<Sparkles className="w-5 h-5" />}>
            Yeni<span className="hidden sm:inline">&nbsp;kombin</span>
          </Button>
        }
      />

      {savedOutfits.length === 0 ? (
        <EmptyState
          icon={<Layers className="w-8 h-8" />}
          title="Henüz kayıtlı kombinin yok"
          text="Oluştur ekranında beğendiğin önerileri kaydet ya da Dolap'ta parçaları seçip kendi kombinini oluştur."
          action={<Button onClick={() => navigate('/olustur')} icon={<Sparkles className="w-4 h-4" />}>Kombin oluştur</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {savedOutfits.map(outfit => {
            const items = itemsOf(outfit);
            return (
              <Card key={outfit.id} className="p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => open(outfit, 'detail')}>
                    <h3 className="text-[19px] text-ink truncate">{outfit.name}</h3>
                    <p className="text-[12px] text-ink-3">
                      {new Date(outfit.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                      {outfit.compatibilityScore ? ` · %${outfit.compatibilityScore} uyum` : ''}
                      {outfit.source === 'manual' ? ' · Elle oluşturuldu' : ''}
                    </p>
                  </button>
                  <IconButton label="Kombin seçenekleri" size="sm" onClick={() => open(outfit, 'options')}>
                    <MoreHorizontal className="w-5 h-5" />
                  </IconButton>
                </div>

                <button type="button" onClick={() => open(outfit, 'detail')} className="flex gap-2 overflow-x-auto no-scrollbar w-full" aria-label={`${outfit.name} parçaları`}>
                  {items.map(item => <ItemImage key={item.id} item={item} className="w-[72px] aspect-[4/5] shrink-0" rounded="rounded-xl" />)}
                  {items.length === 0 && <span className="text-[13px] text-ink-3 py-6">Parçalar yükleniyor…</span>}
                </button>

                {outfit.stylingReason && <p className="text-[13px] text-ink-2 line-clamp-2">{outfit.stylingReason}</p>}

                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="secondary" onClick={() => wearItems(outfit.items, outfit.id)} icon={<CalendarCheck className="w-4 h-4" />}>Bugün giydim</Button>
                  <Button size="sm" variant="ghost" onClick={() => open(outfit, 'collage')} icon={<ImageIcon className="w-4 h-4" />}>Kolaj</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={panel === 'options' && Boolean(selected)} onClose={() => setPanel(null)} title={selected?.name} width="sm">
        {selected && (
          <div className="space-y-0.5 pt-1">
            <MenuRow icon={<CalendarCheck className="w-5 h-5 text-accent" />} label="Bugün giydim" onClick={() => { setPanel(null); wearItems(selected.items, selected.id); }} />
            <MenuRow icon={<Layers className="w-5 h-5 text-ink-2" />} label="Parçaları düzenle" onClick={() => setPanel('detail')} />
            <MenuRow icon={<Edit2 className="w-5 h-5 text-ink-2" />} label="Adını değiştir" onClick={() => rename(selected)} />
            <MenuRow icon={<FileText className="w-5 h-5 text-ink-2" />} label="Notu düzenle" onClick={() => editReason(selected)} />
            <MenuRow icon={<Trash2 className="w-5 h-5" />} label="Kombini sil" danger onClick={() => remove(selected)} />
          </div>
        )}
      </Sheet>

      <Sheet
        open={panel === 'detail' && Boolean(selected)}
        onClose={() => setPanel(null)}
        title={selected?.name}
        subtitle={selected ? `${selected.items.length} parça` : undefined}
        width="md"
        footer={selected ? (
          <Button block variant="secondary" onClick={() => setPanel('add')} icon={<Plus className="w-4 h-4" />}>Parça ekle</Button>
        ) : undefined}
      >
        {selected && (
          <div className="space-y-4 pt-1">
            <div className="divide-y divide-line">
              {itemsOf(selected).map(item => (
                <div key={item.id} className="flex items-center gap-3 py-2.5">
                  <ItemImage item={item} className="w-14 h-[70px] shrink-0" rounded="rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-ink truncate">{item.name}</p>
                    <p className="text-[12px] text-ink-3">{CATEGORY_LABELS[item.category] || item.category}</p>
                  </div>
                  <IconButton label="Kombinden çıkar" onClick={() => removeItem(selected, item.id)}>
                    <X className="w-5 h-5" />
                  </IconButton>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => editReason(selected)} className="w-full text-left p-3.5 rounded-2xl bg-surface-2">
              <p className="text-[12px] font-semibold text-ink-3 mb-1">Not</p>
              <p className="text-[14px] text-ink-2">{selected.stylingReason || 'Not eklemek için dokun'}</p>
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={panel === 'collage' && Boolean(selected)} onClose={() => setPanel(null)} title={selected?.name} subtitle="Kolaj" width="md">
        {selected && <div className="pt-1 pb-2"><OutfitCollage items={itemsOf(selected)} /></div>}
      </Sheet>

      {selected && (
        <ItemPickerSheet
          open={panel === 'add'}
          onClose={() => setPanel('detail')}
          title="Kombine parça ekle"
          subtitle={selected.name}
          disabledIds={selected.items}
          confirmLabel="Ekle"
          onConfirm={async ids => {
            if (ids.length === 0) { setPanel('detail'); return; }
            const ok = await update(selected, { items: Array.from(new Set([...selected.items, ...ids])) }, 'Parçalar eklendi.');
            if (ok) setPanel('detail');
          }}
        />
      )}
    </div>
  );
}
