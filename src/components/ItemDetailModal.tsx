import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Edit3, Loader2 } from 'lucide-react';
import { WardrobeItem, Category } from '../types';

interface Props {
  item: WardrobeItem;
  onClose: () => void;
  onUpdate: (updatedItem: WardrobeItem) => void;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const CATEGORIES = ['top', 'bottom', 'shoes', 'makeup', 'accessory'] as const;
const STYLES     = ['casual', 'formal', 'sport', 'elegant', 'bohemian'] as const;
const WEATHERS   = ['sunny', 'cloudy', 'rainy', 'snowy', 'hot', 'cold'] as const;

export default function ItemDetailModal({ item, onClose, onUpdate, onNotify }: Props) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<WardrobeItem>({ ...item });

  const toggleWeather = (w: string) => {
    setForm(prev => ({
      ...prev,
      weatherMatch: prev.weatherMatch.includes(w)
        ? prev.weatherMatch.filter(x => x !== w)
        : [...prev.weatherMatch, w]
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/wardrobe/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error('Güncelleme başarısız');
      const data = await res.json();
      onUpdate(data.item);
      setIsEditing(false);
      onNotify('Kıyafet güncellendi.', 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all disabled:opacity-70 disabled:bg-gray-100 disabled:border-transparent";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
      >
        {/* Sol Taraf - Resim */}
        <div className="w-full md:w-1/2 bg-gray-50 flex items-center justify-center relative min-h-[300px]">
          <img src={item.imagePath} alt={item.name} className="w-full h-full object-cover" />
          <button onClick={onClose} className="absolute top-4 left-4 p-2 bg-white/50 backdrop-blur hover:bg-white rounded-full md:hidden">
            <X className="w-5 h-5 text-gray-900" />
          </button>
        </div>

        {/* Sağ Taraf - Detaylar */}
        <div className="w-full md:w-1/2 flex flex-col max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white/90 backdrop-blur z-10">
            <div>
              <h2 className="text-xl font-bold text-gray-900 truncate pr-4">{form.name}</h2>
              <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">{form.category} • {form.subCategory}</p>
            </div>
            <div className="flex gap-2">
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-colors" title="Düzenle">
                  <Edit3 className="w-5 h-5" />
                </button>
              ) : (
                <button onClick={() => setIsEditing(false)} className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors" title="Vazgeç">
                  <X className="w-5 h-5" />
                </button>
              )}
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors hidden md:block">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5 flex-grow">
            {/* Form Alanları */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">İsim</label>
                <input className={inputCls} value={form.name} disabled={!isEditing}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Kategori</label>
                <select className={inputCls} value={form.category} disabled={!isEditing}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value as Category }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Alt Kategori</label>
                <input className={inputCls} value={form.subCategory} disabled={!isEditing}
                  onChange={e => setForm(p => ({ ...p, subCategory: e.target.value }))} />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Renk</label>
                <input className={inputCls} value={form.color} disabled={!isEditing}
                  onChange={e => setForm(p => ({ ...p, color: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Kumaş</label>
                <input className={inputCls} value={form.material} disabled={!isEditing}
                  onChange={e => setForm(p => ({ ...p, material: e.target.value }))} />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Desen</label>
                <input className={inputCls} value={form.pattern || ''} disabled={!isEditing} placeholder="Örn: düz, çizgili"
                  onChange={e => setForm(p => ({ ...p, pattern: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Kesim</label>
                <input className={inputCls} value={form.fit || ''} disabled={!isEditing} placeholder="Örn: dar, oversize"
                  onChange={e => setForm(p => ({ ...p, fit: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Stil</label>
              <div className="flex flex-wrap gap-2">
                {STYLES.map(s => (
                  <button key={s} type="button" disabled={!isEditing} onClick={() => setForm(p => ({ ...p, style: s }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      form.style === s ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
                    } ${isEditing ? 'hover:bg-gray-200 cursor-pointer' : 'cursor-default opacity-80'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Hava Uyumu</label>
              <div className="flex flex-wrap gap-2">
                {WEATHERS.map(w => (
                  <button key={w} type="button" disabled={!isEditing} onClick={() => toggleWeather(w)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      form.weatherMatch.includes(w) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                    } ${isEditing ? 'hover:bg-gray-200 cursor-pointer' : 'cursor-default opacity-80'}`}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isEditing && (
            <div className="p-6 border-t border-gray-100 bg-gray-50/50 sticky bottom-0">
              <button onClick={handleSave} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition-all shadow-lg shadow-black/10 disabled:opacity-50">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Değişiklikleri Kaydet
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
