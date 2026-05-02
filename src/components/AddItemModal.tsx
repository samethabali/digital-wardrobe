import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, Wand2, Loader2, CheckCircle2 } from 'lucide-react';
import { analyzeImageFile } from '../services/stylistService';

interface Props {
  onClose: () => void;
  onAdded: () => void;
}

const CATEGORIES = ['top', 'bottom', 'shoes', 'makeup', 'accessory'] as const;
const STYLES     = ['casual', 'formal', 'sport', 'elegant', 'bohemian'] as const;
const WEATHERS   = ['sunny', 'cloudy', 'rainy', 'snowy', 'hot', 'cold'] as const;

export default function AddItemModal({ onClose, onAdded }: Props) {
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
          weatherMatch: result.weatherMatch?.length ? result.weatherMatch : prev.weatherMatch,
        }));
        setAnalyzed(true);
      } else {
        alert('Analiz başarısız. Lütfen bilgileri manuel girin.');
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
      formData.append('autoAnalyze', 'false'); // Zaten analiz ettik

      const res = await fetch('/api/wardrobe/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Yükleme başarısız');
      }
      onAdded();
    } catch (err: any) {
      alert(err.message || 'Kaydetme başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Yeni Kıyafet Ekle</h2>
            <p className="text-xs text-gray-400 mt-0.5">Fotoğraf yükle, AI ile otomatik analiz et</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Dosya Yükleme Alanı */}
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`relative border-2 border-dashed rounded-2xl transition-all ${
              dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50'
            }`}
          >
            {preview ? (
              <div className="flex items-center gap-4 p-4">
                <img src={preview} alt="preview" className="w-24 h-24 object-cover rounded-xl border border-gray-200" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{file?.name}</p>
                  <p className="text-xs text-gray-400">{file ? `${(file.size / 1024).toFixed(0)} KB` : ''}</p>
                  <label className="mt-2 inline-block text-xs text-indigo-600 hover:underline cursor-pointer">
                    Değiştir
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                  </label>
                </div>
                {analyzed && (
                  <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-xs font-medium">AI Analiz Edildi</span>
                  </div>
                )}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center py-10 cursor-pointer">
                <Upload className="w-8 h-8 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-500">Fotoğraf seç veya sürükle bırak</p>
                <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP · Maks 15MB</p>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              </label>
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
            {(file) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-gray-100" />
                  <p className="text-[11px] uppercase tracking-widest text-gray-400 font-bold">
                    {analyzed ? 'AI Doldurdu · Düzenleyebilirsin' : 'Manuel Giriş'}
                  </p>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>

                {/* Ad */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Ad</label>
                  <input className={inputCls} placeholder="örn: Lacivert Slim Fit Gömlek"
                    value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>

                {/* Kategori + Alt Kategori */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Kategori</label>
                    <select className={inputCls} value={form.category}
                      onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Alt Kategori</label>
                    <input className={inputCls} placeholder="gömlek, pantolon..."
                      value={form.subCategory} onChange={e => setForm(p => ({ ...p, subCategory: e.target.value }))} />
                  </div>
                </div>

                {/* Renk + Kumaş */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Renk</label>
                    <input className={inputCls} placeholder="beyaz, siyah..."
                      value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Kumaş</label>
                    <input className={inputCls} placeholder="pamuk, denim..."
                      value={form.material} onChange={e => setForm(p => ({ ...p, material: e.target.value }))} />
                  </div>
                </div>

                {/* Stil */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Stil</label>
                  <div className="flex flex-wrap gap-2">
                    {STYLES.map(s => (
                      <button key={s} type="button" onClick={() => setForm(p => ({ ...p, style: s }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          form.style === s ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hava Durumu */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Hava Uyumu</label>
                  <div className="flex flex-wrap gap-2">
                    {WEATHERS.map(w => (
                      <button key={w} type="button" onClick={() => toggleWeather(w)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          form.weatherMatch.includes(w) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-100">
          <button onClick={onClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={!file || !form.name || saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Kaydediliyor...</span></> : <span>Gardıroba Ekle</span>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
