import React from 'react';
import { Shirt, Sparkles, CheckCircle2, AlertCircle, BarChart2, Palette, Activity, TrendingUp } from 'lucide-react';
import type { WardrobeStats } from '../../shared/api';
import { useWardrobe } from '../contexts/WardrobeContext';
import { apiFetch } from '../services/api';
import { CATEGORY_LABELS, STYLE_LABELS, COLOR_FAMILY_HEX } from '../constants/wardrobe';
import WardrobeInsights from './WardrobeInsights';
import { Button, Card, Chip, Notice } from './ui/primitives';

interface CapsuleSuggestion {
  name: string;
  category: string;
  colorFamily?: string;
  reason: string;
  gain: number;
  gainType: 'new_outfits' | 'pairings';
}

interface CapsuleResult {
  insufficient: boolean;
  message?: string;
  currentOutfitCount: number;
  estimated: boolean;
  suggestions: CapsuleSuggestion[];
  usedFallback: boolean;
}

const CAPSULE_TARGETS = [
  { id: 'any', label: 'Tümü' },
  { id: 'top', label: 'Üst' },
  { id: 'bottom', label: 'Alt' },
  { id: 'onepiece', label: 'Elbise / Tulum' },
  { id: 'outerwear', label: 'Dış giyim' },
  { id: 'shoes', label: 'Ayakkabı' },
  { id: 'accessory', label: 'Aksesuar' },
];

function StatCard({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-ink-3 mb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <span className="text-2xl font-bold text-ink tabular-nums">{value}</span>
    </Card>
  );
}

export default function StatsDashboard() {
  const { total } = useWardrobe();
  // Genel özet tüm gardıroptan hesaplanır (sunucu); yüklenmiş sayfadaki parçalardan değil
  const [stats, setStats] = React.useState<WardrobeStats | null>(null);

  const [target, setTarget] = React.useState('any');
  const [capsule, setCapsule] = React.useState<CapsuleResult | null>(null);
  const [loadingCapsule, setLoadingCapsule] = React.useState(false);
  const [capsuleError, setCapsuleError] = React.useState<string | null>(null);

  const runCapsule = async () => {
    setLoadingCapsule(true);
    setCapsuleError(null);
    try {
      setCapsule(await apiFetch<CapsuleResult>(`/api/capsule-analysis?category=${encodeURIComponent(target)}`));
    } catch (err: any) {
      setCapsuleError(err.message || 'Kapsül analizi yapılamadı.');
    } finally {
      setLoadingCapsule(false);
    }
  };

  if (total === 0) {
    return (
      <Card className="p-10 text-center max-w-lg mx-auto space-y-2">
        <BarChart2 className="w-10 h-10 mx-auto text-ink-3" />
        <h3 className="text-lg text-ink">Henüz veri yok</h3>
        <p className="text-sm text-ink-3 leading-relaxed">Gardırobuna parça ekledikçe kategori, renk ve giyim alışkanlıkların burada görünür.</p>
      </Card>
    );
  }

  const itemCount = stats?.totalItems ?? total;
  const completeRatio = stats && itemCount ? Math.round((stats.completeItems / itemCount) * 100) : null;

  return (
    <div className="space-y-6">
      <WardrobeInsights onStats={setStats} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Toplam parça" value={itemCount} icon={<Shirt className="w-4 h-4 text-accent" />} />
        <StatCard label="Fotoğraftan analiz" value={stats ? stats.aiAnalyzed : '—'} icon={<Sparkles className="w-4 h-4 text-accent" />} />
        <StatCard label="Bilgisi tam" value={stats ? stats.completeItems : '—'} icon={<CheckCircle2 className="w-4 h-4 text-success" />} />
        <StatCard label="Eksik bilgili" value={stats ? itemCount - stats.completeItems : '—'} icon={<AlertCircle className="w-4 h-4 text-warning" />} />
      </div>

      {itemCount >= 5 && (
        <Card className="p-5 md:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-accent-soft text-accent rounded-2xl shrink-0"><TrendingUp className="w-5 h-5" /></div>
            <div>
              <h3 className="text-lg text-ink">Kapsül gardırop</h3>
              <p className="text-[13px] text-ink-3">Hangi parçayı eklersen en çok yeni kombin kurabileceğini hesaplar.</p>
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5 md:mx-0 md:px-0 md:flex-wrap">
            {CAPSULE_TARGETS.map(cat => (
              <Chip key={cat.id} selected={target === cat.id} onClick={() => setTarget(cat.id)}>{cat.label}</Chip>
            ))}
          </div>

          <Button loading={loadingCapsule} onClick={runCapsule} icon={<Sparkles className="w-4 h-4" />}>
            Analiz et
          </Button>

          {capsuleError && <Notice tone="danger">{capsuleError}</Notice>}

          {capsule && (
            capsule.insufficient ? (
              <Notice>{capsule.message || 'Analiz için gardırobunda yeterli parça yok.'}</Notice>
            ) : (
              <div className="space-y-3">
                <p className="text-[13px] text-ink-2">
                  Şu an yaklaşık <b className="text-ink">{capsule.currentOutfitCount}</b> geçerli kombin kurabiliyorsun
                  {capsule.estimated ? ' (örneklemeyle tahmin)' : ''}.
                </p>
                {capsule.suggestions.length === 0 ? (
                  <Notice>Bu kategoride kombin sayısını artıracak bir öneri bulunamadı.</Notice>
                ) : capsule.suggestions.map((s, index) => (
                  <div key={`${s.name}-${index}`} className="p-4 rounded-2xl bg-surface-2 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {s.colorFamily && (
                          <span className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0" style={{ background: (COLOR_FAMILY_HEX as Record<string, string>)[s.colorFamily] }} />
                        )}
                        <p className="text-[15px] font-semibold text-ink truncate">{s.name}</p>
                      </div>
                      <span className="text-[12px] font-bold text-accent shrink-0">
                        +{s.gain} {s.gainType === 'new_outfits' ? 'kombin' : 'eşleşme'}
                      </span>
                    </div>
                    <p className="text-[12px] text-ink-3">{CATEGORY_LABELS[s.category] || s.category}</p>
                    <p className="text-[13px] text-ink-2 leading-relaxed">{s.reason}</p>
                  </div>
                ))}
                {capsule.usedFallback && <p className="text-[12px] text-ink-3">Yapay zeka yanıt vermediği için temel parça önerileri gösteriliyor.</p>}
              </div>
            )
          )}
        </Card>
      )}

      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5 md:p-6 space-y-4">
            <h3 className="text-lg text-ink">Kategoriler</h3>
            <div className="space-y-3">
              {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
                const percentage = itemCount ? (count / itemCount) * 100 : 0;
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between items-center text-[13px]">
                      <span className="font-semibold text-ink">{CATEGORY_LABELS[cat] || cat}</span>
                      <span className="text-ink-3 tabular-nums">{count} · %{Math.round(percentage)}</span>
                    </div>
                    <div className="w-full bg-surface-2 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5 md:p-6 space-y-3">
            <h3 className="text-lg text-ink">Veri kalitesi</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-accent tabular-nums">%{completeRatio ?? 0}</span>
              <span className="text-[13px] text-ink-3">parçanın bilgisi eksiksiz</span>
            </div>
            <div className="w-full bg-surface-2 h-2.5 rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${completeRatio ?? 0}%` }} />
            </div>
            <p className="text-[13px] text-ink-2 leading-relaxed">
              {itemCount - stats.completeItems > 0
                ? `${itemCount - stats.completeItems} parçada renk, kumaş veya mevsim gibi bilgiler eksik. Dolap ekranındaki "Tamamla" ile fotoğraflardan doldurabilirsin; öneriler daha isabetli olur.`
                : 'Tüm parçaların bilgileri eksiksiz.'}
            </p>
          </Card>

          {stats.topColors.length > 0 && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-[15px] font-semibold text-ink"><Palette className="w-4 h-4 text-accent" />En çok kullandığın renkler</div>
              {stats.topColors.map(({ color, count }) => (
                <div key={color} className="flex justify-between items-center text-[13px]">
                  <span className="font-semibold text-ink capitalize">{color}</span>
                  <span className="text-ink-3 tabular-nums">{count} parça</span>
                </div>
              ))}
            </Card>
          )}

          {stats.topStyles.length > 0 && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-[15px] font-semibold text-ink"><Activity className="w-4 h-4 text-accent" />Baskın tarzların</div>
              {stats.topStyles.map(({ style, count }) => (
                <div key={style} className="flex justify-between items-center text-[13px]">
                  <span className="font-semibold text-ink">{STYLE_LABELS[style] || style}</span>
                  <span className="text-ink-3 tabular-nums">{count} parça</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
