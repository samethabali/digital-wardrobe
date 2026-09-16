import React from 'react';
import { Edit3, Scissors, Undo2, Sparkles, Copy, Trash2, Check, X } from 'lucide-react';
import type { WardrobeItem } from '../types';
import type { GenerateOutfitResponse, SimilarItemDTO } from '../../shared/api';
import { CATEGORY_LABELS, displayImage } from '../constants/wardrobe';
import { apiFetch } from '../services/api';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useNotification } from '../contexts/NotificationContext';
import ItemAttributeFields, { toItemForm, toItemPayload, ItemFormValues } from './ItemAttributeFields';
import Sheet from './ui/Sheet';
import { Button, IconButton, Notice, cx } from './ui/primitives';

interface Props {
  item: WardrobeItem | null;
  onClose: () => void;
  onUpdate?: (updatedItem: WardrobeItem) => void;
  onDeleted?: () => void;
}

export default function ItemDetailModal({ item, onClose, onUpdate, onDeleted }: Props) {
  const { handleDeleteItem } = useWardrobe();
  const { notify } = useNotification();

  const [isEditing, setIsEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  // Panel kapalıyken de geçerli varsayılanlarla başlar: parça seçildiği ilk çizimde form alanları boş nesne olmamalı
  const [form, setForm] = React.useState<ItemFormValues>(() => toItemForm(item || {}));
  const [cutoutBusy, setCutoutBusy] = React.useState(false);
  const [showOriginal, setShowOriginal] = React.useState(false);
  const [pairings, setPairings] = React.useState<GenerateOutfitResponse | null>(null);
  const [pairingsLoading, setPairingsLoading] = React.useState(false);
  const [similar, setSimilar] = React.useState<SimilarItemDTO[]>([]);
  const [deleting, setDeleting] = React.useState(false);

  // Başka bir parça açıldığında paneli sıfırla
  React.useEffect(() => {
    if (item) {
      setIsEditing(false);
      setShowOriginal(false);
      setPairings(null);

      apiFetch<{ similarItems: SimilarItemDTO[] }>(`/api/wardrobe/${encodeURIComponent(item.id)}/similar`)
        .then(data => setSimilar(data.similarItems || []))
        .catch(() => setSimilar([]));
    }
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kaydetme veya arka plan kaldırma sonrası güncel parça bilgisini forma yansıt (düzenleme sürerken dokunma)
  React.useEffect(() => {
    if (item && !isEditing) setForm(toItemForm(item));
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await apiFetch<{ item: WardrobeItem }>(`/api/wardrobe/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        body: toItemPayload(form),
      });
      onUpdate?.(data.item);
      setIsEditing(false);
      notify('Parça güncellendi.', 'success');
    } catch (err: any) {
      notify(err.message || 'Güncelleme başarısız oldu.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCutout = async (remove = false) => {
    setCutoutBusy(true);
    try {
      const data = await apiFetch<{ item: WardrobeItem }>(`/api/wardrobe/${encodeURIComponent(item.id)}/cutout`, {
        method: remove ? 'DELETE' : 'POST',
      });
      onUpdate?.(data.item);
      setShowOriginal(false);
      notify(remove ? 'Orijinal görsele dönüldü.' : 'Arka plan kaldırıldı.', 'success');
    } catch (err: any) {
      notify(err.message || 'Arka plan kaldırılamadı.', 'error');
    } finally {
      setCutoutBusy(false);
    }
  };

  const handlePairings = async () => {
    setPairingsLoading(true);
    try {
      const res = await apiFetch<GenerateOutfitResponse>(`/api/wardrobe/${encodeURIComponent(item.id)}/pairings`, { body: {} });
      setPairings(res);
    } catch (err: any) {
      notify(err.message || 'Bu parça için kombin bulunamadı.', 'error');
    } finally {
      setPairingsLoading(false);
    }
  };

  const onDelete = async () => {
    // Onay ve bildirim handleDeleteItem içinde
    setDeleting(true);
    try {
      const success = await handleDeleteItem(item.id);
      if (success) {
        onDeleted?.();
        onClose();
      }
    } finally {
      setDeleting(false);
    }
  };

  const imageSrc = showOriginal || !item.cutoutImagePath ? item.imagePath : displayImage(item);
  const isCutout = Boolean(item.cutoutImagePath && !showOriginal);

  return (
    <Sheet
      open={Boolean(item)}
      onClose={onClose}
      fullHeight
      width="lg"
      title={
        <span className="truncate block font-display text-xl sm:text-2xl">{form.name || item.name}</span>
      }
      subtitle={
        <span>
          {CATEGORY_LABELS[form.category] || form.category}
          {form.subCategory ? ` · ${form.subCategory}` : ''}
          {typeof item.wearCount === 'number' && item.wearCount > 0 ? ` · ${item.wearCount} kez giyildi` : ''}
        </span>
      }
      actions={
        <div className="flex items-center gap-1">
          {!isEditing ? (
            <IconButton
              label="Düzenle"
              variant="surface"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Edit3 className="w-4 h-4" />
            </IconButton>
          ) : (
            <IconButton
              label="Vazgeç"
              variant="plain"
              size="sm"
              onClick={() => {
                setIsEditing(false);
                setForm(toItemForm(item));
              }}
            >
              <X className="w-4 h-4" />
            </IconButton>
          )}
        </div>
      }
      footer={
        isEditing ? (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setIsEditing(false);
                setForm(toItemForm(item));
              }}
            >
              Vazgeç
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              loading={saving}
              onClick={handleSave}
            >
              Kaydet
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="danger"
              size="sm"
              loading={deleting}
              onClick={onDelete}
              icon={<Trash2 className="w-4 h-4" />}
            >
              Sil
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              Kapat
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-6 pt-2 pb-6">
        {/* Görsel Alanı */}
        <div className="relative rounded-3xl bg-surface-2 border border-line overflow-hidden flex items-center justify-center aspect-[4/3] sm:aspect-[16/10]">
          <img
            src={imageSrc}
            alt={item.name}
            className={cx(
              'w-full h-full transition-all duration-300',
              isCutout ? 'object-contain p-6 drop-shadow-md' : 'object-cover',
            )}
          />

          {/* Görsel Üzeri Butonlar */}
          <div className="absolute bottom-3 inset-x-3 flex justify-center gap-2">
            {item.cutoutImagePath ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowOriginal(v => !v)}
                  className="px-3 py-1.5 rounded-full bg-surface/90 backdrop-blur border border-line text-xs font-semibold text-ink shadow-sm"
                >
                  {showOriginal ? 'Kesilmiş Görsel' : 'Orijinal Fotoğraf'}
                </button>
                <button
                  type="button"
                  onClick={() => handleCutout(true)}
                  disabled={cutoutBusy}
                  className="px-3 py-1.5 rounded-full bg-surface/90 backdrop-blur border border-line text-xs font-semibold text-ink-2 hover:text-danger flex items-center gap-1 shadow-sm disabled:opacity-50"
                >
                  <Undo2 className="w-3.5 h-3.5" /> Orijinale Dön
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleCutout(false)}
                disabled={cutoutBusy}
                className="px-3.5 py-1.5 rounded-full bg-accent text-on-accent text-xs font-semibold flex items-center gap-1.5 shadow-float active:scale-95 transition-transform disabled:opacity-60"
              >
                <Scissors className="w-3.5 h-3.5" />
                {cutoutBusy ? 'İşleniyor…' : 'Arka Planı Kaldır'}
              </button>
            )}
          </div>
        </div>

        {/* Benzer Parçalar Uyarısı */}
        {similar.length > 0 && (
          <Notice tone="warning" icon={<Copy className="w-4 h-4 text-warning" />}>
            <p className="text-xs font-semibold text-ink">Gardırobunda benzer parçalar var</p>
            <div className="flex gap-2 mt-2">
              {similar.map(s => (
                <img
                  key={s.id}
                  src={s.imagePath}
                  alt={s.name}
                  title={`${s.name} (%${Math.round(s.similarity * 100)} benzer)`}
                  className="w-10 h-10 rounded-xl object-cover border border-line"
                />
              ))}
            </div>
          </Notice>
        )}

        {/* Bu Parçayla Ne Giyerim? (Sadece görüntüleme modunda) */}
        {!isEditing && (
          <div className="space-y-3">
            <Button
              variant="secondary"
              block
              loading={pairingsLoading}
              onClick={handlePairings}
              icon={<Sparkles className="w-4 h-4 text-accent" />}
            >
              Bu parçayla ne giyerim?
            </Button>

            {pairings && (
              <div className="space-y-3 pt-1">
                {pairings.weather && (
                  <p className="text-[12px] text-ink-3">
                    {pairings.weather.locationLabel} · {Math.round(pairings.weather.temperatureC)}°C, {pairings.weather.condition}
                  </p>
                )}
                {pairings.outfits.map(outfit => (
                  <div key={outfit.id} className="p-3.5 rounded-2xl bg-surface-2 border border-line space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-bold text-ink">{outfit.title}</p>
                      <span className="text-[11px] font-bold text-accent">%{outfit.score}</span>
                    </div>
                    <p className="text-[12px] text-ink-3 leading-relaxed">{outfit.reason}</p>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1">
                      {outfit.items.map(i => (
                        <div key={i.id} className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-surface border border-line">
                          <img
                            src={displayImage(i)}
                            alt={i.name}
                            title={i.name}
                            className="w-full h-full object-contain p-1"
                          />
                          {i.id === item.id && (
                            <span className="absolute bottom-0 inset-x-0 bg-accent text-[9px] text-on-accent text-center font-bold">
                              Bu Parça
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Nitelikler Formu */}
        <ItemAttributeFields
          form={form}
          onChange={setForm}
          disabled={!isEditing}
        />

      </div>
    </Sheet>
  );
}
