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
      const token = localStorage.getItem('aura_token');
      const res = await fetch(`/api/wardrobe/${item.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-end md:items-center justify-center md:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.98, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.98, opacity: 0, y: 30 }}
        className="bg-secondary rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl w-full md:max-w-4xl overflow-hidden flex flex-col md:flex-row transition-colors border border-border-color/50"
        style={{ maxHeight: '92vh' }}
      >
        {/* Sol Taraf - Resim (mobilde sabit yükseklik, masaüstünde yarı genişlik) */}
        <div className="relative shrink-0 h-64 sm:h-80 md:h-auto md:w-1/2 bg-primary flex items-center justify-center overflow-hidden">
          <img
            src={item.imagePath}
            alt={item.name}
            className="w-full h-full object-cover"
          />
          {/* Mobil kapatma butonu — resim üstünde */}
          <button
            onClick={onClose}
            className="absolute top-6 left-6 p-2.5 bg-secondary/80 backdrop-blur-md hover:bg-secondary rounded-2xl md:hidden shadow-lg border border-white/10"
          >
            <X className="w-6 h-6 text-text-primary" />
          </button>
        </div>

        {/* Sağ Taraf - Detaylar (kendi içinde scroll) */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Sticky header */}
          <div className="flex items-center justify-between px-6 py-5 md:px-8 border-b border-border-color bg-secondary/90 backdrop-blur-md shrink-0 transition-colors">
            <div className="min-w-0 pr-4">
              <h2 className="text-xl md:text-2xl font-bold text-text-primary truncate">{form.name}</h2>
              <p className="text-xs text-text-secondary uppercase tracking-[0.2em] font-bold mt-1 opacity-70">{CATEGORY_LABELS[form.category] || form.category} • {form.subCategory}</p>
            </div>
            <div className="flex gap-2.5 shrink-0">
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="p-3 bg-indigo-600 shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 text-white rounded-2xl transition-all active:scale-95" title="Düzenle">
                  <Edit3 className="w-5 h-5" />
                </button>
              ) : (
                <button onClick={() => setIsEditing(false)} className="p-3 bg-primary hover:bg-secondary text-text-secondary rounded-2xl transition-all border border-border-color" title="Vazgeç">
                  <X className="w-5 h-5" />
                </button>
              )}
              <button onClick={onClose} className="p-3 hover:bg-primary rounded-2xl transition-colors hidden md:block">
                <X className="w-6 h-6 text-text-secondary" />
              </button>
            </div>
          </div>

          {/* Scrollable form alanı */}
          <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
            {/* İsim */}
            <div className="col-span-2">
              <label className="block text-[11px] font-black text-text-secondary uppercase tracking-widest mb-2 opacity-50">Kıyafet Adı</label>
              <input className={inputCls} value={form.name} disabled={!isEditing}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>

            {/* Kategori + Alt Kategori */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] font-black text-text-secondary uppercase tracking-widest mb-2 opacity-50">Kategori</label>
                <select className={inputCls} value={form.category} disabled={!isEditing}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value as Category }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-black text-text-secondary uppercase tracking-widest mb-2 opacity-50">Alt Kategori</label>
                <input className={inputCls} value={form.subCategory} disabled={!isEditing}
                  onChange={e => setForm(p => ({ ...p, subCategory: e.target.value }))} />
              </div>
            </div>

            {/* Renk + Kumaş */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] font-black text-text-secondary uppercase tracking-widest mb-2 opacity-50">Renk</label>
                <input className={inputCls} value={form.color} disabled={!isEditing}
                  onChange={e => setForm(p => ({ ...p, color: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[11px] font-black text-text-secondary uppercase tracking-widest mb-2 opacity-50">Kumaş Türü</label>
                <input className={inputCls} value={form.material} disabled={!isEditing}
                  onChange={e => setForm(p => ({ ...p, material: e.target.value }))} />
              </div>
            </div>

            {/* Desen + Kesim */}
            {['top', 'bottom', 'outerwear'].includes(form.category) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[11px] font-black text-text-secondary uppercase tracking-widest mb-2 opacity-50">Desen</label>
                  <input className={inputCls} value={form.pattern || ''} disabled={!isEditing} placeholder="Örn: düz, çizgili"
                    onChange={e => setForm(p => ({ ...p, pattern: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-text-secondary uppercase tracking-widest mb-2 opacity-50">Kesim / Fit</label>
                  <input className={inputCls} value={form.fit || ''} disabled={!isEditing} placeholder="Örn: dar, oversize"
                    onChange={e => setForm(p => ({ ...p, fit: e.target.value }))} />
                </div>
              </div>
            )}

            {/* Stil */}
            <div>
              <label className="block text-[11px] font-black text-text-secondary uppercase tracking-widest mb-3 opacity-50">Giyim Stili</label>
              <div className="flex flex-wrap gap-2.5">
                {STYLES.map(s => {
                  const styleLabels: Record<string, string> = {
                    casual: 'Günlük', formal: 'Resmi', sport: 'Spor', 
                    elegant: 'Zarif', bohemian: 'Bohem'
                  };
                  return (
                    <button key={s} type="button" disabled={!isEditing} onClick={() => setForm(p => ({ ...p, style: s }))}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        form.style === s ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-primary border border-border-color text-text-secondary'
                      } ${isEditing ? 'hover:border-indigo-200 cursor-pointer' : 'cursor-default opacity-80'}`}>
                      {styleLabels[s] || s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hava Uyumu */}
            <div className="pb-8">
              <label className="block text-[11px] font-black text-text-secondary uppercase tracking-widest mb-3 opacity-50">Hava Durumu Uyumu</label>
              <div className="flex flex-wrap gap-2.5">
                {WEATHERS.map(w => {
                  const weatherLabels: Record<string, string> = {
                    sunny: 'Güneşli', cloudy: 'Bulutlu', rainy: 'Yağmurlu', 
                    snowy: 'Karlı', hot: 'Sıcak', cold: 'Soğuk'
                  };
                  return (
                    <button key={w} type="button" disabled={!isEditing} onClick={() => toggleWeather(w)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        form.weatherMatch.includes(w) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-primary border border-border-color text-text-secondary'
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
            <div className="px-6 py-5 md:p-8 border-t border-border-color bg-secondary/80 backdrop-blur-md shrink-0 transition-colors pb-safe-offset-4 mb-16 md:mb-0">
              <button onClick={handleSave} disabled={saving}
                className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50 active:scale-[0.98]">
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
