import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Edit3, Loader2 } from 'lucide-react';
import { WardrobeItem, Category } from '../types';
import { CATEGORIES, STYLES, WEATHERS, CATEGORY_LABELS } from '../constants/wardrobe';

interface Props {
  item: WardrobeItem;
  onClose: () => void;
  onUpdate: (updatedItem: WardrobeItem) => void;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

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

  const inputCls = "w-full bg-primary border border-border-color rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all disabled:opacity-70 disabled:bg-primary/50 text-text-primary placeholder:text-text-secondary/50";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end md:items-center justify-center md:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.98, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.98, opacity: 0, y: 30 }}
        className="bg-secondary rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:max-w-4xl overflow-hidden flex flex-col md:flex-row transition-colors"
        style={{ maxHeight: '92vh' }}
      >
        {/* Sol Taraf - Resim (mobilde sabit yükseklik, masaüstünde yarı genişlik) */}
        <div className="relative shrink-0 h-56 sm:h-72 md:h-auto md:w-1/2 bg-primary flex items-center justify-center overflow-hidden">
          <img
            src={item.imagePath}
            alt={item.name}
            className="w-full h-full object-cover"
          />
          {/* Mobil kapatma butonu — resim üstünde */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2 bg-secondary/80 backdrop-blur hover:bg-secondary rounded-full md:hidden shadow-sm"
          >
            <X className="w-5 h-5 text-text-primary" />
          </button>
        </div>

        {/* Sağ Taraf - Detaylar (kendi içinde scroll) */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Sticky header */}
          <div className="flex items-center justify-between px-5 py-4 md:px-6 border-b border-border-color bg-secondary/90 backdrop-blur shrink-0 transition-colors">
            <div className="min-w-0 pr-4">
              <h2 className="text-lg md:text-xl font-bold text-text-primary truncate">{form.name}</h2>
              <p className="text-xs text-text-secondary uppercase tracking-widest mt-0.5">{CATEGORY_LABELS[form.category] || form.category} • {form.subCategory}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="p-2 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 rounded-xl transition-colors" title="Düzenle">
                  <Edit3 className="w-5 h-5" />
                </button>
              ) : (
                <button onClick={() => setIsEditing(false)} className="p-2 bg-primary hover:bg-primary text-text-secondary rounded-xl transition-colors" title="Vazgeç">
                  <X className="w-5 h-5" />
                </button>
              )}
              <button onClick={onClose} className="p-2 hover:bg-primary rounded-xl transition-colors hidden md:block">
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>
          </div>

          {/* Scrollable form alanı */}
          <div className="p-5 md:p-6 space-y-5 overflow-y-auto flex-1">
            {/* İsim */}
            <div className="col-span-2">
              <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">İsim</label>
              <input className={inputCls} value={form.name} disabled={!isEditing}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>

            {/* Kategori + Alt Kategori */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Kategori</label>
                <select className={inputCls} value={form.category} disabled={!isEditing}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value as Category }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Alt Kategori</label>
                <input className={inputCls} value={form.subCategory} disabled={!isEditing}
                  onChange={e => setForm(p => ({ ...p, subCategory: e.target.value }))} />
              </div>
            </div>

            {/* Renk + Kumaş */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Renk</label>
                <input className={inputCls} value={form.color} disabled={!isEditing}
                  onChange={e => setForm(p => ({ ...p, color: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Kumaş</label>
                <input className={inputCls} value={form.material} disabled={!isEditing}
                  onChange={e => setForm(p => ({ ...p, material: e.target.value }))} />
              </div>
            </div>

            {/* Desen + Kesim */}
            {['top', 'bottom', 'outerwear'].includes(form.category) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Desen</label>
                  <input className={inputCls} value={form.pattern || ''} disabled={!isEditing} placeholder="Örn: düz, çizgili"
                    onChange={e => setForm(p => ({ ...p, pattern: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Kesim</label>
                  <input className={inputCls} value={form.fit || ''} disabled={!isEditing} placeholder="Örn: dar, oversize"
                    onChange={e => setForm(p => ({ ...p, fit: e.target.value }))} />
                </div>
              </div>
            )}

            {/* Stil */}
            <div>
              <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Stil</label>
              <div className="flex flex-wrap gap-2">
                {STYLES.map(s => {
                  const styleLabels: Record<string, string> = {
                    casual: 'Günlük', formal: 'Resmi', sport: 'Spor', 
                    elegant: 'Zarif', bohemian: 'Bohem'
                  };
                  return (
                    <button key={s} type="button" disabled={!isEditing} onClick={() => setForm(p => ({ ...p, style: s }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        form.style === s ? 'bg-indigo-600 text-white shadow-md' : 'bg-primary border border-border-color text-text-secondary'
                      } ${isEditing ? 'hover:border-indigo-200 cursor-pointer' : 'cursor-default opacity-80'}`}>
                      {styleLabels[s] || s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hava Uyumu */}
            <div>
              <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Hava Uyumu</label>
              <div className="flex flex-wrap gap-2">
                {WEATHERS.map(w => {
                  const weatherLabels: Record<string, string> = {
                    sunny: 'Güneşli', cloudy: 'Bulutlu', rainy: 'Yağmurlu', 
                    snowy: 'Karlı', hot: 'Sıcak', cold: 'Soğuk'
                  };
                  return (
                    <button key={w} type="button" disabled={!isEditing} onClick={() => toggleWeather(w)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        form.weatherMatch.includes(w) ? 'bg-indigo-600 text-white shadow-md' : 'bg-primary border border-border-color text-text-secondary'
                      } ${isEditing ? 'hover:border-indigo-200 cursor-pointer' : 'cursor-default opacity-80'}`}>
                      {weatherLabels[w] || w}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sticky save footer */}
          {isEditing && (
            <div className="px-5 py-4 md:p-6 border-t border-border-color bg-primary/50 shrink-0 transition-colors">
              <button onClick={handleSave} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50">
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
