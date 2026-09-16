import React from 'react';
import { Camera, ImagePlus, Wand2, CheckCircle2 } from 'lucide-react';
import { analyzeImageFile } from '../services/stylistService';
import ItemAttributeFields, { EMPTY_ITEM_FORM, ItemFormValues, toItemForm, toItemPayload } from './ItemAttributeFields';
import Sheet from './ui/Sheet';
import { Button, Notice } from './ui/primitives';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * Parça ekleme akışı: 1) fotoğraf (kamera veya galeri) 2) otomatik analiz 3) bilgileri kontrol edip kaydet.
 * Mobilde tam ekran panel; kaydet düğmesi başparmak erişiminde, altta sabit.
 */
export default function AddItemModal({ open, onClose, onAdded, onNotify }: Props) {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState('');
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analyzed, setAnalyzed] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<ItemFormValues>(EMPTY_ITEM_FORM);

  const reset = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview('');
    setAnalyzed(false);
    setForm(EMPTY_ITEM_FORM);
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const analyze = async (target: File) => {
    setAnalyzing(true);
    try {
      const result = await analyzeImageFile(target);
      if (result) {
        if (result.isClothing === false) onNotify('Fotoğrafta bir kıyafet görünmüyor; bilgileri kontrol et.', 'info');
        setForm(prev => ({ ...toItemForm(result), name: prev.name || result.name || '', price: prev.price }));
        setAnalyzed(true);
      } else {
        onNotify('Otomatik analiz yapılamadı; bilgileri elle girebilirsin.', 'info');
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const pick = (selected: File | undefined) => {
    if (!selected || !selected.type.startsWith('image/')) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setAnalyzed(false);
    // Fotoğraf seçilir seçilmez analiz başlar: mobilde bir dokunuş daha kazandırır
    analyze(selected);
  };

  const save = async () => {
    if (!file) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('itemData', JSON.stringify(toItemPayload(form)));
      formData.append('autoAnalyze', analyzed ? 'false' : 'true');
      const token = localStorage.getItem('aura_token');
      const res = await fetch('/api/wardrobe/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Yükleme başarısız');
      if (data.similarItems?.length) {
        onNotify(`Eklendi. Dolabında çok benzer bir parça var: ${data.similarItems.map((s: any) => s.name).join(', ')}`, 'info');
      } else {
        onNotify('Parça dolabına eklendi.', 'success');
      }
      for (const warning of data.warnings || []) onNotify(warning, 'info');
      reset();
      onAdded();
    } catch (err: any) {
      onNotify(err.message || 'Kaydetme başarısız.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const fileInput = (capture: boolean) => (
    <input type="file" accept="image/*" {...(capture ? { capture: 'environment' as const } : {})} className="hidden"
      onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
  );

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Yeni parça"
      subtitle={file ? (analyzing ? 'Fotoğraf analiz ediliyor…' : analyzed ? 'Bilgileri kontrol et, gerekirse düzelt' : 'Bilgileri doldur') : 'Kıyafetin fotoğrafını çek veya galeriden seç'}
      fullHeight
      width="lg"
      footer={file ? (
        <Button block size="lg" onClick={save} loading={saving} disabled={!form.name.trim() || analyzing}>
          Dolaba ekle
        </Button>
      ) : undefined}
    >
      {!file ? (
        <div className="grid grid-cols-2 gap-3 pt-2">
          <label className="aspect-square rounded-3xl bg-ink text-canvas flex flex-col items-center justify-center gap-3 cursor-pointer active:scale-[0.98] transition-transform">
            <Camera className="w-9 h-9" strokeWidth={1.6} />
            <span className="font-semibold">Fotoğraf çek</span>
            {fileInput(true)}
          </label>
          <label className="aspect-square rounded-3xl bg-surface-2 text-ink flex flex-col items-center justify-center gap-3 cursor-pointer active:scale-[0.98] transition-transform">
            <ImagePlus className="w-9 h-9" strokeWidth={1.6} />
            <span className="font-semibold">Galeriden seç</span>
            {fileInput(false)}
          </label>
          <div className="col-span-2">
            <Notice>İpucu: Parçayı düz bir zemine ser veya askıda, gün ışığında fotoğrafla. Tek parça görünmesi etiketlemeyi iyileştirir.</Notice>
          </div>
        </div>
      ) : (
        <div className="space-y-6 pt-1">
          <div className="flex items-center gap-4">
            <img src={preview} alt="" className="w-24 h-28 object-cover rounded-2xl bg-surface-2" />
            <div className="min-w-0 flex-1 space-y-2">
              {analyzing ? (
                <div className="space-y-2">
                  <div className="h-4 w-3/4 rounded skeleton" />
                  <div className="h-3 w-1/2 rounded skeleton" />
                  <p className="text-[13px] text-ink-3">Kategori, renk ve kumaş tahmin ediliyor…</p>
                </div>
              ) : analyzed ? (
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-success"><CheckCircle2 className="w-4 h-4" /> Otomatik dolduruldu</p>
              ) : (
                <Button size="sm" variant="secondary" icon={<Wand2 className="w-4 h-4" />} onClick={() => analyze(file)}>Otomatik doldur</Button>
              )}
              <label className="inline-block text-[13px] font-semibold text-accent cursor-pointer">
                Fotoğrafı değiştir
                {fileInput(false)}
              </label>
            </div>
          </div>
          <ItemAttributeFields form={form} onChange={setForm} disabled={analyzing} />
        </div>
      )}
    </Sheet>
  );
}
