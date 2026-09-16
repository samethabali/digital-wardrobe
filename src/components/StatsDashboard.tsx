import React, { useMemo, useState } from 'react';
import { useWardrobe } from '../contexts/WardrobeContext';
import { CATEGORY_LABELS, STYLE_LABELS } from '../constants/wardrobe';
import { missingFields } from '../../shared/wardrobe';
import WardrobeInsights from './WardrobeInsights';
import { Shirt, Sparkles, CheckCircle2, AlertCircle, BarChart2, Palette, Activity } from 'lucide-react';
import { Button, Card, Chip, Notice, Spinner } from './ui/primitives';

export default function StatsDashboard() {
  const { items } = useWardrobe();

  const [selectedCategory, setSelectedCategory] = useState<string>('any');
  const [capsuleData, setCapsuleData] = useState<any>(null);
  const [loadingCapsule, setLoadingCapsule] = useState(false);
  const [capsuleError, setCapsuleError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const fetchCapsuleAnalysis = async (cat: string) => {
    if (items.length < 5) return;
    setLoadingCapsule(true);
    setCapsuleError(null);
    setHasRun(true);
    try {
      const token = localStorage.getItem('aura_token');
      const response = await fetch(`/api/capsule-analysis?category=${cat}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setCapsuleData(data);
      } else {
        throw new Error('Analiz alınamadı');
      }
    } catch (err) {
      setCapsuleError('Kapsül analizi yüklenirken bir hata oluştu.');
    } finally {
      setLoadingCapsule(false);
    }
  };

  const stats = useMemo(() => {
    const categories = ['top', 'bottom', 'onepiece', 'outerwear', 'shoes', 'accessory', 'makeup'];

    const byCategory = categories.reduce(
      (acc, cat) => {
        acc[cat] = items.filter((i) => i.category === cat).length;
        return acc;
      },
      {} as Record<string, number>,
    );

    const aiAnalyzed = items.filter((i) => i.aiAnalyzed).length;
    const isComplete = (i: any) => missingFields(i).length === 0;
    const complete = items.filter(isComplete).length;
    const incomplete = items.length - complete;

    // En çok kullanılan renkler
    const colorCounts: Record<string, number> = {};
    items.forEach((item) => {
      if (item.color) {
        const c = item.color.trim();
        colorCounts[c] = (colorCounts[c] || 0) + 1;
      }
    });

    const topColors = Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Dominant tarzlar
    const styleCounts: Record<string, number> = {};
    items.forEach((item) => {
      if (item.style) {
        const s = item.style.trim();
        styleCounts[s] = (styleCounts[s] || 0) + 1;
      }
    });

    const topStyles = Object.entries(styleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return {
      byCategory,
      aiAnalyzed,
      complete,
      incomplete,
      topColors,
      topStyles,
    };
  }, [items]);

  const styleLabels: Record<string, string> = STYLE_LABELS;

  if (items.length === 0) {
    return (
      <Card className="p-12 text-center max-w-lg mx-auto space-y-3">
        <BarChart2 className="w-10 h-10 mx-auto text-ink-3" />
        <h4 className="font-bold text-ink text-base">Henüz Gardırop Verisi Yok</h4>
        <p className="text-xs text-ink-3 leading-relaxed">
          Gardırobunuza kıyafet eklediğinizde bu panelde kategorileriniz, renk dağılımlarınız ve stil analitikleriniz sergilenecektir.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Giyim alışkanlıkları ve stil kümeleri */}
      <WardrobeInsights />

      {/* Genel Özet Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between text-ink-3 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Toplam Parça</span>
            <Shirt className="w-4 h-4 text-accent" />
          </div>
          <span className="text-2xl font-black text-ink">{items.length}</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-ink-3 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">AI Analizli</span>
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
          <span className="text-2xl font-black text-ink">{stats.aiAnalyzed}</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-ink-3 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Eksiksiz Kayıt</span>
            <CheckCircle2 className="w-4 h-4 text-success" />
          </div>
          <span className="text-2xl font-black text-ink">{stats.complete}</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-ink-3 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Eksik Bilgili</span>
            <AlertCircle className="w-4 h-4 text-warning" />
          </div>
          <span className="text-2xl font-black text-ink">{stats.incomplete}</span>
        </Card>
      </div>

      {/* Kapsül Gardırop AI Simülasyonu */}
      {items.length >= 5 && (
        <Card className="p-5 md:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-accent-soft text-accent rounded-2xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">Kapsül Gardırop AI Simülasyonu</h3>
              <p className="text-xs text-ink-3">Dolabınızdaki eksik kilit parçayı bularak kombinasyon sayınızı katlayın</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { id: 'any', label: 'Tümü' },
              { id: 'top', label: 'Üst Giyim' },
              { id: 'bottom', label: 'Alt Giyim' },
              { id: 'onepiece', label: 'Elbise / Tulum' },
              { id: 'outerwear', label: 'Dış Giyim' },
              { id: 'shoes', label: 'Ayakkabı' },
              { id: 'accessory', label: 'Aksesuar' },
            ].map(cat => (
              <Chip
                key={cat.id}
                selected={selectedCategory === cat.id}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.label}
              </Chip>
            ))}
          </div>

          <Button
            variant="primary"
            loading={loadingCapsule}
            onClick={() => fetchCapsuleAnalysis(selectedCategory)}
            icon={<Sparkles className="w-4 h-4" />}
          >
            Simülasyonu Çalıştır
          </Button>

          {capsuleError && (
            <Notice tone="danger">
              <p className="text-xs text-danger">{capsuleError}</p>
            </Notice>
          )}

          {hasRun && capsuleData && (
            <div className="pt-2">
              {!capsuleData.insufficient && capsuleData.suggestedPiece ? (
                <div className="p-4 rounded-2xl bg-surface-2 border border-line space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-accent uppercase tracking-wider">Önerilen Kilit Parça</span>
                    <span className="text-xs font-bold text-ink">
                      +{Math.round((((capsuleData.projectedOutfitCount ?? capsuleData.currentOutfitCount) - capsuleData.currentOutfitCount) / Math.max(1, capsuleData.currentOutfitCount)) * 100)}% Verimlilik Artışı
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-ink">{capsuleData.suggestedPiece.name}</h4>
                  <p className="text-xs text-ink-2 leading-relaxed">{capsuleData.reason}</p>
                </div>
              ) : (
                <p className="text-xs text-ink-3">{capsuleData.message || 'Dolabınızda yeterli kıyafet yok.'}</p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Kategori Dağılımı ve Veri Kalitesi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 md:p-6 space-y-4">
          <h3 className="text-base font-bold text-ink">Kategori Dağılımı</h3>
          <div className="space-y-3">
            {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map(cat => {
              if (cat === 'all') return null;
              const count = stats.byCategory[cat] || 0;
              const percentage = items.length > 0 ? (count / items.length) * 100 : 0;

              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-ink">{CATEGORY_LABELS[cat]}</span>
                    <span className="text-ink-3">{count} parça (%{Math.round(percentage)})</span>
                  </div>
                  <div className="w-full bg-surface-2 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-500 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5 md:p-6 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-base font-bold text-ink mb-3">Veri Kalitesi</h3>
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-4xl font-black text-accent">
                %{Math.round((stats.complete / items.length) * 100)}
              </span>
              <span className="text-xs font-semibold text-ink-3">Eksiksiz Gardırop Oranı</span>
            </div>
            <div className="w-full bg-surface-2 h-2.5 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-accent transition-all duration-500 rounded-full"
                style={{ width: `${(stats.complete / items.length) * 100}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-ink-3 leading-relaxed p-3 rounded-2xl bg-surface-2 border border-line">
            {stats.incomplete > 0
              ? `Gardırobunuzdaki ${stats.incomplete} kıyafette bazı bilgiler eksik. Gardırop ekranındaki "Tamamla" butonu ile yapay zekanın eksik bilgileri doldurmasını sağlayabilirsiniz.`
              : 'Tebrikler! Gardırobunuzdaki tüm kıyafetler eksiksiz ve analiz edilmiş olarak kaydedilmiştir. 🎉'}
          </p>
        </Card>
      </div>

      {/* Renkler ve Stiller */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {stats.topColors.length > 0 && (
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-ink mb-1">
              <Palette className="w-4 h-4 text-accent" />
              <span>En Sık Tercih Edilen Renkler</span>
            </div>
            <div className="space-y-2">
              {stats.topColors.map(([color, count], idx) => (
                <div key={color} className="flex justify-between items-center p-2.5 bg-surface-2 border border-line rounded-2xl">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-black text-ink-3 w-4">#{idx + 1}</span>
                    <span className="text-xs font-bold text-ink capitalize">{color}</span>
                  </div>
                  <span className="text-xs text-ink-3 font-semibold">{count} parça</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {stats.topStyles.length > 0 && (
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-ink mb-1">
              <Activity className="w-4 h-4 text-accent" />
              <span>Dominant Tarzlar</span>
            </div>
            <div className="space-y-2">
              {stats.topStyles.map(([style, count], idx) => (
                <div key={style} className="flex justify-between items-center p-2.5 bg-surface-2 border border-line rounded-2xl">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-black text-ink-3 w-4">#{idx + 1}</span>
                    <span className="text-xs font-bold text-ink">{styleLabels[style.toLowerCase()] || style}</span>
                  </div>
                  <span className="text-xs text-accent font-bold px-2 py-0.5 rounded-lg bg-accent-soft">
                    {count} parça
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
