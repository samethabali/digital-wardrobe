import React from 'react';
import { Layers, MoreHorizontal, CalendarCheck, Image as ImageIcon, Trash2, Edit2, Sparkles, Plus } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useStylist } from '../contexts/StylistContext';
import { useNotification } from '../contexts/NotificationContext';
import { apiFetch } from '../services/api';
import type { SavedOutfit, WardrobeItem } from '../types';
import PageHeader from '../components/layout/PageHeader';
import OutfitCollage from '../components/OutfitCollage';
import Sheet from '../components/ui/Sheet';
import { Button, IconButton, EmptyState } from '../components/ui/primitives';
import { displayImage } from '../constants/wardrobe';

export default function OutfitsView() {
  const { savedOutfits, refreshOutfits, itemById, wearItems } = useStylist();
  const { notify, ask, askConfirm } = useNotification();

  const [selectedOutfit, setSelectedOutfit] = React.useState<SavedOutfit | null>(null);
  const [showOptions, setShowOptions] = React.useState(false);
  const [showCollage, setShowCollage] = React.useState(false);

  const handleWear = async (outfit: SavedOutfit) => {
    await wearItems(outfit.items, outfit.id);
    setShowOptions(false);
  };

  const handleRename = async (outfit: SavedOutfit) => {
    const newName = await ask('Kombin Adını Değiştir', outfit.name);
    if (!newName || newName === outfit.name) return;
    try {
      await apiFetch(`/api/outfits/${encodeURIComponent(outfit.id)}`, {
        method: 'PUT',
        body: { name: newName },
      });
      notify('Kombin adı güncellendi.', 'success');
      await refreshOutfits();
      setShowOptions(false);
    } catch (err: any) {
      notify(err.message || 'Güncellenemedi.', 'error');
    }
  };

  const handleDelete = async (outfit: SavedOutfit) => {
    const ok = await askConfirm('Kombini Sil', `"${outfit.name}" silinecek. Emin misin?`, 'Evet, Sil');
    if (!ok) return;
    try {
      await apiFetch(`/api/outfits/${encodeURIComponent(outfit.id)}`, {
        method: 'DELETE',
      });
      notify('Kombin silindi.', 'success');
      await refreshOutfits();
      setShowOptions(false);
      setSelectedOutfit(null);
    } catch (err: any) {
      notify(err.message || 'Kombin silinemedi.', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Kombinlerim"
        subtitle={`${savedOutfits.length} kayıtlı kombin`}
        actions={
          <NavLink to="/olustur">
            <Button size="md" variant="primary" icon={<Sparkles className="w-5 h-5" />}>
              Yeni Oluştur
            </Button>
          </NavLink>
        }
      />

      {savedOutfits.length === 0 ? (
        <EmptyState
          icon={<Layers className="w-8 h-8 text-ink-3" />}
          title="Henüz kayıtlı kombinin yok"
          text="Yapay zeka ile hava durumuna ve ortama uygun kombinler oluşturup beğendiklerini buraya kaydedebilirsin."
          action={
            <NavLink to="/olustur">
              <Button icon={<Sparkles className="w-4 h-4" />}>
                Kombin Oluştur
              </Button>
            </NavLink>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savedOutfits.map(outfit => {
            const outfitItems = outfit.items
              .map(id => itemById.get(id))
              .filter((i): i is WardrobeItem => Boolean(i));

            return (
              <div
                key={outfit.id}
                className="p-5 rounded-3xl bg-surface border border-line flex flex-col justify-between gap-4 transition-all hover:border-ink/20"
              >
                <div>
                  {/* Başlık ve eylem butonu */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-bold text-ink truncate">{outfit.name}</h3>
                      <p className="text-[12px] text-ink-3">
                        {new Date(outfit.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                        {outfit.compatibilityScore ? ` · %${outfit.compatibilityScore} Uyum` : ''}
                      </p>
                    </div>
                    <IconButton
                      label="Kombin Seçenekleri"
                      variant="plain"
                      size="sm"
                      onClick={() => {
                        setSelectedOutfit(outfit);
                        setShowOptions(true);
                      }}
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </IconButton>
                  </div>

                  {/* Kombin Açıklaması */}
                  {outfit.stylingReason && (
                    <p className="text-xs text-ink-2 line-clamp-2 mb-3 leading-relaxed">
                      {outfit.stylingReason}
                    </p>
                  )}

                  {/* Parça Görselleri Şeridi */}
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    {outfitItems.map(item => (
                      <div
                        key={item.id}
                        className="w-16 h-20 shrink-0 rounded-2xl bg-surface-2 border border-line overflow-hidden p-1 flex items-center justify-center"
                        title={item.name}
                      >
                        <img
                          src={item.cutoutImagePath || item.imagePath}
                          alt={item.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hızlı Butonlar */}
                <div className="flex items-center gap-2 pt-2 border-t border-line/60">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => handleWear(outfit)}
                    icon={<CalendarCheck className="w-4 h-4 text-accent" />}
                  >
                    Bugün Giydim
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedOutfit(outfit);
                      setShowCollage(true);
                    }}
                    icon={<ImageIcon className="w-4 h-4" />}
                  >
                    Kolaj
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Seçenekler Paneli */}
      {selectedOutfit && (
        <Sheet
          open={showOptions}
          onClose={() => setShowOptions(false)}
          title={selectedOutfit.name}
          subtitle="Kombin Seçenekleri"
          width="sm"
        >
          <div className="space-y-1.5 pt-2">
            <button
              type="button"
              onClick={() => handleWear(selectedOutfit)}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl hover:bg-surface-2 text-left font-semibold text-sm text-ink transition-colors"
            >
              <CalendarCheck className="w-5 h-5 text-accent" />
              <span>Bugün Giydim Olarak İşaretle</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowOptions(false);
                setShowCollage(true);
              }}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl hover:bg-surface-2 text-left font-semibold text-sm text-ink transition-colors"
            >
              <ImageIcon className="w-5 h-5 text-ink-2" />
              <span>Kolaj Görünümünde İncele</span>
            </button>
            <button
              type="button"
              onClick={() => handleRename(selectedOutfit)}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl hover:bg-surface-2 text-left font-semibold text-sm text-ink transition-colors"
            >
              <Edit2 className="w-5 h-5 text-ink-2" />
              <span>Kombin Adını Değiştir</span>
            </button>
            <button
              type="button"
              onClick={() => handleDelete(selectedOutfit)}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl hover:bg-danger-soft text-left font-semibold text-sm text-danger transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              <span>Kombini Sil</span>
            </button>
          </div>
        </Sheet>
      )}

      {/* Kolaj Görüntüleme Paneli */}
      {selectedOutfit && (
        <Sheet
          open={showCollage}
          onClose={() => setShowCollage(false)}
          title={selectedOutfit.name}
          subtitle="Düz Serim (Flat-lay) Kolaj"
          width="md"
        >
          <div className="pt-2 pb-4">
            <OutfitCollage
              items={selectedOutfit.items
                .map(id => itemById.get(id))
                .filter((i): i is WardrobeItem => Boolean(i))}
            />
          </div>
        </Sheet>
      )}
    </div>
  );
}
