import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, Wand2, Loader2, CheckCircle2, Camera, ImagePlus } from 'lucide-react';
import { analyzeImageFile } from '../services/stylistService';
import { CATEGORIES, STYLES, WEATHERS, PATTERNS, FITS, CATEGORY_LABELS } from '../constants/wardrobe';

interface Props {
  onClose: () => void;
  onAdded: () => void;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function AddItemModal({ onClose, onAdded, onNotify }: Props) {
  const [file, setFile]           = React.useState<File | null>(null);
  const [preview, setPreview]     = React.useState<string>('');
  const [analyzing, setAnalyzing] = React.useState(false);
  const [saving, setSaving]       = React.useState(false);
  const [analyzed, setAnalyzed]   = React.useState(false);
  const [dragOver, setDragOver]   = React.useState(false);

  const [form, setForm] = React.useState({
    name:         '',
    category:     'top',
    subCategory:  '',
    color:        '',
    material:     '',
    style:        'casual',
    pattern:      '',
    fit:          '',
    weatherMatch: ['sunny', 'cloudy'] as string[],
  });

  const handleFile = (f: File) => {
    setFile(f);
    setAnalyzed(false);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) handleFile(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    try {
      const result = await analyzeImageFile(file);
      if (result) {
        setForm(prev => ({
          ...prev,
          name:         result.name        || prev.name,
          category:     result.category    || prev.category,
          subCategory:  result.subCategory || prev.subCategory,
          color:        result.color       || prev.color,
          material:     result.material    || prev.material,
          style:        result.style       || prev.style,
          pattern:      (result as any).pattern || prev.pattern,
          fit:          (result as any).fit     || prev.fit,
          weatherMatch: result.weatherMatch?.length ? result.weatherMatch : prev.weatherMatch,
        }));
        setAnalyzed(true);
      } else {
        onNotify('Analiz başarısız. Lütfen bilgileri manuel girin.', 'error');
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleWeather = (w: string) => {
    setForm(prev => ({
      ...prev,
      weatherMatch: prev.weatherMatch.includes(w)
        ? prev.weatherMatch.filter(x => x !== w)
        : [...prev.weatherMatch, w]
    }));
  };

  const handleSave = async () => {
    if (!file) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('itemData', JSON.stringify(form));
      formData.append('autoAnalyze', 'false');

      const res = await fetch('/api/wardrobe/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Yükleme başarısız');
      }
      onAdded();
      onNotify('Kıyafet başarıyla eklendi!', 'success');
    } catch (err: any) {
      onNotify(err.message || 'Kaydetme başarısız.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-primary border border-border-color rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all text-text-primary placeholder:text-text-secondary/50";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-secondary rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto transition-colors"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-border-color sticky top-0 bg-secondary/90 backdrop-blur-md z-10">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Yeni Kıyafet Ekle</h2>
            <p className="text-xs text-text-secondary mt-0.5">Fotoğraf yükle, AI ile otomatik analiz et</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-primary rounded-xl transition-colors">
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Dosya Yükleme Alanı */}
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`relative border-2 border-dashed rounded-2xl transition-all ${
              dragOver ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/10' : 'border-border-color hover:border-text-secondary/30 bg-primary'
            }`}
          >
            {preview ? (
              <div className="flex items-center gap-4 p-4">
                <img src={preview} alt="preview" className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl border border-border-color shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{file?.name}</p>
                  <p className="text-xs text-text-secondary">{file ? `${(file.size / 1024).toFixed(0)} KB` : ''}</p>
                  <label className="mt-2 inline-block text-xs text-indigo-600 hover:underline cursor-pointer">
                    Değiştir
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                  </label>
                </div>
                {analyzed && (
                  <div className="flex items-center gap-1.5 text-green-600 bg-green-50 dark:bg-green-900/20 px-2.5 py-1.5 rounded-full shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-medium hidden sm:inline">AI Analiz Edildi</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center py-8">
                <label className="flex flex-col items-center justify-center w-32 h-32 bg-primary border border-border-color rounded-2xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all shadow-sm group">
                  <Camera className="w-8 h-8 text-text-secondary group-hover:text-indigo-500 mb-2" />
                  <span className="text-xs font-semibold text-text-secondary group-hover:text-indigo-600">Kamera</span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                </label>
                
                <label className="flex flex-col items-center justify-center w-32 h-32 bg-primary border border-border-color rounded-2xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all shadow-sm group">
                  <ImagePlus className="w-8 h-8 text-text-secondary group-hover:text-indigo-500 mb-2" />
                  <span className="text-xs font-semibold text-text-secondary group-hover:text-indigo-600">Galeri</span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                </label>
              </div>
            )}
          </div>

          {/* Otomatik Analiz Butonu */}
          {file && !analyzed && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
            >
              {analyzing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span>Gemini Vision Analiz Ediyor...</span></>
              ) : (
                <><Wand2 className="w-4 h-4" /><span>Otomatik Analiz Et (AI)</span></>
              )}
            </button>
          )}

          {/* Form */}
          <AnimatePresence>
            {file && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border-color" />
                  <p className="text-[11px] uppercase tracking-widest text-text-secondary font-bold">
                    {analyzed ? 'AI Doldurdu · Düzenleyebilirsin' : 'Manuel Giriş'}
                  </p>
                  <div className="h-px flex-1 bg-border-color" />
                </div>

                {/* Ad */}
                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Ad</label>
                  <input className={inputCls} placeholder="örn: Lacivert Slim Fit Gömlek"
                    value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>

                {/* Kategori + Alt Kategori — mobilde tek kolon */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Kategori</label>
                    <select className={inputCls} value={form.category}
                      onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Alt Kategori</label>
                    <input className={inputCls} placeholder="gömlek, pantolon..."
                      value={form.subCategory} onChange={e => setForm(p => ({ ...p, subCategory: e.target.value }))} />
                  </div>
                </div>

                {/* Renk + Kumaş — mobilde tek kolon */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Renk</label>
                    <input className={inputCls} placeholder="beyaz, siyah..."
                      value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Kumaş</label>
                    <input className={inputCls} placeholder="pamuk, denim..."
                      value={form.material} onChange={e => setForm(p => ({ ...p, material: e.target.value }))} />
                  </div>
                </div>

                {/* Desen + Kesim */}
                {['top', 'bottom', 'outerwear'].includes(form.category) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Desen</label>
                      <select className={inputCls} value={form.pattern}
                        onChange={e => setForm(p => ({ ...p, pattern: e.target.value }))}>
                        {PATTERNS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Kesim</label>
                      <select className={inputCls} value={form.fit}
                        onChange={e => setForm(p => ({ ...p, fit: e.target.value }))}>
                        {FITS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
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
                        <button key={s} type="button" onClick={() => setForm(p => ({ ...p, style: s }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            form.style === s ? 'bg-indigo-600 text-white shadow-md' : 'bg-primary border border-border-color text-text-secondary hover:border-indigo-200'
                          }`}>
                          {styleLabels[s] || s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hava Durumu */}
                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">Hava Uyumu</label>
                  <div className="flex flex-wrap gap-2">
                    {WEATHERS.map(w => {
                      const weatherLabels: Record<string, string> = {
                        sunny: 'Güneşli', cloudy: 'Bulutlu', rainy: 'Yağmurlu', 
                        snowy: 'Karlı', hot: 'Sıcak', cold: 'Soğuk'
                      };
                      return (
                        <button key={w} type="button" onClick={() => toggleWeather(w)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            form.weatherMatch.includes(w) ? 'bg-indigo-600 text-white shadow-md' : 'bg-primary border border-border-color text-text-secondary hover:border-indigo-200'
                          }`}>
                          {weatherLabels[w] || w}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 sm:p-6 border-t border-border-color sticky bottom-0 bg-secondary transition-colors">
          <button onClick={onClose}
            className="flex-1 py-3 border border-border-color rounded-xl text-sm font-medium text-text-secondary hover:bg-primary transition-colors">
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={!file || !form.name || saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Kaydediliyor...</span></> : <span>Gardıroba Ekle</span>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
