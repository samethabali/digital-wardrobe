import React, { useMemo } from 'react';
import { useWardrobe } from '../contexts/WardrobeContext';
import { CATEGORY_LABELS } from '../constants/wardrobe';
import { Shirt, Sparkles, CheckCircle2, AlertCircle, BarChart2, Palette, Activity } from 'lucide-react';

export default function StatsDashboard() {
  const { items } = useWardrobe();

  const stats = useMemo(() => {
    const categories: ('top' | 'bottom' | 'outerwear' | 'shoes' | 'makeup' | 'accessory')[] = [
      'top', 'bottom', 'outerwear', 'shoes', 'makeup', 'accessory'
    ];

    const byCategory = categories.reduce(
      (acc, cat) => {
        acc[cat] = items.filter((i) => i.category === cat).length;
        return acc;
      },
      {} as Record<string, number>
    );

    const aiAnalyzed = items.filter((i) => i.aiAnalyzed).length;
    
    const isComplete = (i: any) => {
      const needsFitPattern = ['top', 'bottom', 'outerwear'].includes(i.category);
      return i.color && i.style && i.material && i.subCategory &&
        (!needsFitPattern || (i.pattern && i.fit));
    };

    const complete = items.filter(isComplete).length;
    const incomplete = items.length - complete;

    // En çok kullanılan renkler
    const colorMap: Record<string, number> = {};
    items.forEach((item) => {
      if (item.color) {
        const key = item.color.trim();
        if (key) {
          colorMap[key] = (colorMap[key] || 0) + 1;
        }
      }
    });
    const topColors = Object.entries(colorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // En çok tercih edilen stiller
    const styleMap: Record<string, number> = {};
    items.forEach((item) => {
      if (item.style) {
        styleMap[item.style] = (styleMap[item.style] || 0) + 1;
      }
    });
    const topStyles = Object.entries(styleMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { byCategory, aiAnalyzed, complete, incomplete, topColors, topStyles };
  }, [items]);

  const categoryColors: Record<string, string> = {
    top: 'bg-indigo-500',
    bottom: 'bg-purple-500',
    outerwear: 'bg-sky-500',
    shoes: 'bg-amber-500',
    makeup: 'bg-pink-500',
    accessory: 'bg-emerald-500',
  };

  const categoryBorderColors: Record<string, string> = {
    top: 'border-indigo-500/20',
    bottom: 'border-purple-500/20',
    outerwear: 'border-sky-500/20',
    shoes: 'border-amber-500/20',
    makeup: 'border-pink-500/20',
    accessory: 'border-emerald-500/20',
  };

  const styleLabels: Record<string, string> = {
    casual: 'Günlük (Casual)',
    formal: 'Resmi (Formal)',
    sport: 'Spor (Sport)',
    elegant: 'Zarif (Elegant)',
    bohemian: 'Bohem (Bohemian)'
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-20 bg-secondary/35 border border-border-color/60 rounded-3xl p-8 max-w-xl mx-auto">
        <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-25 text-text-secondary animate-pulse" />
        <h4 className="font-bold text-primary">Henüz Gardırop Verisi Yok</h4>
        <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto leading-relaxed">
          Gardırobunuza kıyafet eklediğinizde bu panelde kategorileriniz, renk dağılımlarınız ve stil analitikleriniz canlı olarak sergilenecektir.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 text-left animate-fade-in">
      
      {/* Genel Özet Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Toplam Parça */}
        <div className="bg-secondary border border-border-color/80 rounded-3xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute right-4 top-4 p-2 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-xl group-hover:scale-105 transition-transform">
            <Shirt className="w-5 h-5" />
          </div>
          <span className="text-xs text-text-secondary font-bold uppercase tracking-wider block">Toplam Parça</span>
          <span className="text-3xl font-black text-primary mt-2 block">{items.length}</span>
        </div>

        {/* AI Analiz */}
        <div className="bg-secondary border border-border-color/80 rounded-3xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute right-4 top-4 p-2 bg-purple-500/10 text-purple-500 dark:text-purple-400 rounded-xl group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-xs text-text-secondary font-bold uppercase tracking-wider block">AI Analizli</span>
          <span className="text-3xl font-black text-primary mt-2 block">{stats.aiAnalyzed}</span>
        </div>

        {/* Eksiksiz Eşyalar */}
        <div className="bg-secondary border border-border-color/80 rounded-3xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute right-4 top-4 p-2 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 rounded-xl group-hover:scale-105 transition-transform">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <span className="text-xs text-text-secondary font-bold uppercase tracking-wider block">Eksiksiz Kayıt</span>
          <span className="text-3xl font-black text-primary mt-2 block">{stats.complete}</span>
        </div>

        {/* Eksik Bilgi */}
        <div className="bg-secondary border border-border-color/80 rounded-3xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute right-4 top-4 p-2 bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-xl group-hover:scale-105 transition-transform">
            <AlertCircle className="w-5 h-5" />
          </div>
          <span className="text-xs text-text-secondary font-bold uppercase tracking-wider block">Eksik Bilgili</span>
          <span className="text-3xl font-black text-primary mt-2 block">{stats.incomplete}</span>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Kategori Dağılımı */}
        <div className="bg-secondary border border-border-color/80 rounded-3xl p-6 md:p-8 shadow-sm">
          <h3 className="text-lg font-bold text-primary mb-6">Kategori Dağılımı</h3>
          <div className="space-y-4">
            {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((cat) => {
              if (cat === 'all') return null;
              const count = stats.byCategory[cat] || 0;
              const percentage = items.length > 0 ? (count / items.length) * 100 : 0;
              const barColor = categoryColors[cat] || 'bg-indigo-500';

              return (
                <div key={cat} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-text-primary capitalize">{CATEGORY_LABELS[cat]}</span>
                    <span className="text-text-secondary font-semibold">{count} parça (%{Math.round(percentage)})</span>
                  </div>
                  <div className="w-full bg-primary border border-border-color/40 h-3 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${barColor} transition-all duration-500 rounded-full`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Veri Kalitesi & Tamamlanma Durumu */}
        <div className="bg-secondary border border-border-color/80 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-primary mb-4">Veri Kalitesi</h3>
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-5xl font-black text-indigo-600 dark:text-indigo-400">
                %{Math.round((stats.complete / items.length) * 100)}
              </span>
              <span className="text-sm text-text-secondary font-semibold">Eksiksiz Gardırop Oranı</span>
            </div>
            
            <div className="w-full bg-primary border border-border-color/40 h-4 rounded-full overflow-hidden mb-4">
              <div 
                className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-500 rounded-full"
                style={{ width: `${(stats.complete / items.length) * 100}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-text-secondary leading-relaxed bg-primary/40 border border-border-color/50 rounded-2xl p-4 mt-2">
            {stats.incomplete > 0 
              ? `Gardırobunuzdaki ${stats.incomplete} kıyafette renk, stil, materyal, kesim veya desen bilgileri eksik. Sistem performansını ve AI asistan tavsiyelerini güçlendirmek için bunları AI ile tek tıkla zenginleştirebilirsin.`
              : 'Tebrikler! Gardırobunuzdaki tüm kıyafetler eksiksiz ve yapay zeka analizli olarak kaydedilmiştir. 🎉'}
          </p>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* En Çok Kullanılan Renkler */}
        {stats.topColors.length > 0 && (
          <div className="bg-secondary border border-border-color/80 rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Palette className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-bold text-primary">En Sık Tercih Edilen Renkler</h3>
            </div>
            <div className="space-y-3.5">
              {stats.topColors.map(([color, count], idx) => {
                const colorsHex: Record<string, string> = {
                  siyah: '#111827', beyaz: '#f9fafb', gri: '#9ca3af', kırmızı: '#ef4444', 
                  mavi: '#3b82f6', yeşil: '#10b981', sarı: '#f59e0b', pembe: '#ec4899', 
                  mor: '#8b5cf6', turuncu: '#f97316', lacivert: '#1e3a8a', bej: '#f5f5dc', kahverengi: '#78350f'
                };
                const colorBg = colorsHex[color.toLowerCase()] || '#6366f1';
                const isLight = ['beyaz', 'bej', 'sarı'].includes(color.toLowerCase());

                return (
                  <div key={color} className="flex justify-between items-center p-3 bg-primary/30 border border-border-color/40 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-text-secondary/50 w-5">#{idx + 1}</span>
                      <div 
                        className={`w-6 h-6 rounded-full border ${isLight ? 'border-gray-300 dark:border-gray-700' : 'border-transparent'}`}
                        style={{ backgroundColor: colorBg }}
                      />
                      <span className="text-xs font-bold text-text-primary capitalize">{color}</span>
                    </div>
                    <span className="text-xs text-text-secondary font-bold">{count} parça</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dominant Stiller */}
        {stats.topStyles.length > 0 && (
          <div className="bg-secondary border border-border-color/80 rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-bold text-primary">Dominant Tarzlar</h3>
            </div>
            <div className="space-y-3.5">
              {stats.topStyles.map(([style, count], idx) => (
                <div key={style} className="flex justify-between items-center p-3 bg-primary/30 border border-border-color/40 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-text-secondary/50 w-5">#{idx + 1}</span>
                    <span className="text-xs font-bold text-text-primary">
                      {styleLabels[style.toLowerCase()] || style}
                    </span>
                  </div>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1 rounded-xl font-bold">
                    {count} parça
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
