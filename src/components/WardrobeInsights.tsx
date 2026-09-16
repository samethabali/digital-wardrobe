import React from 'react';
import { CalendarDays, Trash2, TrendingUp, Moon, Wallet, Layers, RefreshCw } from 'lucide-react';
import type { WardrobeStats, WearLogEntry, WornItemStat } from '../../shared/api';
import { apiFetch } from '../services/api';
import { useWardrobe } from '../contexts/WardrobeContext';
import { displayImage } from '../constants/wardrobe';
import { useNotification } from '../contexts/NotificationContext';
import { Card, Button, Spinner, IconButton, cx } from './ui/primitives';

function ItemRow({ items, value }: { items: WornItemStat[]; value: (s: WornItemStat) => string }) {
  if (items.length === 0) return <p className="text-xs text-ink-3">Henüz veri yok.</p>;
  return (
    <div className="space-y-2.5">
      {items.map(s => (
        <div key={s.id} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-2 border border-line p-1 overflow-hidden shrink-0 flex items-center justify-center">
            <img src={s.imagePath} alt="" className="w-full h-full object-contain" loading="lazy" />
          </div>
          <span className="text-xs font-semibold text-ink truncate flex-1">{s.name}</span>
          <span className="text-xs font-bold text-ink-2 shrink-0">{value(s)}</span>
        </div>
      ))}
    </div>
  );
}

const formatDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'long' });

export default function WardrobeInsights() {
  const { items, fetchWardrobe } = useWardrobe();
  const { notify, askConfirm } = useNotification();
  const [stats, setStats] = React.useState<WardrobeStats | null>(null);
  const [entries, setEntries] = React.useState<WearLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [embedding, setEmbedding] = React.useState(false);
  const [itemNames, setItemNames] = React.useState<Record<string, { name: string; imagePath: string }>>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [s, log] = await Promise.all([
        apiFetch<WardrobeStats>('/api/stats'),
        apiFetch<{ entries: WearLogEntry[] }>('/api/wear-log'),
      ]);
      setStats(s);
      setEntries(log.entries);
      const known = new Set(items.map(i => i.id));
      const missing = Array.from(new Set(log.entries.flatMap(e => e.itemIds))).filter(id => !known.has(id));
      if (missing.length) {
        const extra = await apiFetch<{ items: any[] }>(`/api/wardrobe?ids=${encodeURIComponent(missing.slice(0, 200).join(','))}`);
        setItemNames(prev => ({ ...prev, ...Object.fromEntries(extra.items.map(i => [i.id, { name: i.name, imagePath: displayImage(i) }])) }));
      }
    } catch (err: any) {
      notify(err.message || 'İstatistikler alınamadı.', 'error');
    } finally {
      setLoading(false);
    }
  }, [items, notify]);

  React.useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const itemInfo = (id: string) => {
    const item = items.find(i => i.id === id);
    return item ? { name: item.name, imagePath: displayImage(item) } : itemNames[id];
  };

  const deleteEntry = async (entry: WearLogEntry) => {
    const ok = await askConfirm('Kaydı Sil', `${formatDate(entry.date)} tarihli giyim kaydı silinsin mi?`, 'Evet, Sil');
    if (!ok) return;
    try {
      await apiFetch(`/api/wear-log/${entry.id}`, { method: 'DELETE' });
      setEntries(prev => prev.filter(e => e.id !== entry.id));
      fetchWardrobe();
      load();
    } catch (err: any) {
      notify(err.message || 'Kayıt silinemedi.', 'error');
    }
  };

  const computeEmbeddings = async () => {
    setEmbedding(true);
    try {
      let remaining = 1;
      for (let round = 0; round < 10 && remaining > 0; round++) {
        const result = await apiFetch<{ computed: number; remaining: number }>('/api/wardrobe/embeddings/backfill', { body: {} });
        remaining = result.remaining;
        if (result.computed === 0) break;
      }
      notify(remaining > 0 ? `Bir kısmı hesaplandı, ${remaining} parça kaldı. Daha sonra tekrar dene.` : 'Stil analizi için tüm parçalar hazır.', remaining > 0 ? 'info' : 'success');
      load();
    } catch (err: any) {
      notify(err.message || 'Hesaplanamadı.', 'error');
    } finally {
      setEmbedding(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="py-12 flex justify-center">
        <Spinner className="w-7 h-7" />
      </div>
    );
  }
  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* İstatistik Özet Kutuları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Toplam Giyim', value: stats.totalWears },
          { label: 'Son 30 Gün', value: stats.wearsLast30Days },
          { label: 'Hiç Giyilmeyen', value: stats.neverWornCount },
          { label: 'Gardırop Değeri', value: stats.wardrobeValue !== null ? `₺${stats.wardrobeValue.toLocaleString('tr-TR')}` : '—' },
        ].map(k => (
          <Card key={k.label} className="p-4">
            <span className="text-[10px] font-bold text-ink-3 uppercase tracking-wider">{k.label}</span>
            <span className="text-2xl font-black text-ink mt-1 block">{k.value}</span>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* En Çok Giyilenler */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <TrendingUp className="w-4 h-4 text-accent" />
            <span>En Çok Giyilenler</span>
          </div>
          <ItemRow items={stats.mostWorn} value={s => `${s.wearCount} kez`} />
        </Card>

        {/* 90 Gündür Giyilmeyenler */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <Moon className="w-4 h-4 text-warning" />
            <span>90 Gündür Giyilmeyenler</span>
          </div>
          <ItemRow items={stats.notWornIn90Days} value={s => (s.lastWornAt ? new Date(s.lastWornAt).toLocaleDateString('tr-TR') : '')} />
          {stats.neverWorn.length > 0 && (
            <div className="pt-2 border-t border-line">
              <p className="text-[11px] font-bold text-ink-3 uppercase tracking-wider mb-2">Hiç Giyilmeyen Parçalar</p>
              <div className="flex gap-2 flex-wrap">
                {stats.neverWorn.map(s => (
                  <img
                    key={s.id}
                    src={s.imagePath}
                    title={s.name}
                    alt={s.name}
                    className="w-10 h-10 rounded-xl object-contain bg-surface-2 border border-line p-0.5"
                    loading="lazy"
                  />
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Giyim Başı Maliyet */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <Wallet className="w-4 h-4 text-success" />
            <span>Giyim Başı Maliyet</span>
          </div>
          {stats.costPerWear.length === 0 ? (
            <p className="text-xs text-ink-3">Parça detayından fiyat girildiğinde giyim başı maliyet burada hesaplanır.</p>
          ) : (
            <ItemRow items={stats.costPerWear} value={s => `₺${(s.costPerWear ?? 0).toLocaleString('tr-TR')} / giyim`} />
          )}
        </Card>

        {/* Stil Kümeleri */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-ink">
              <Layers className="w-4 h-4 text-accent" />
              <span>Stil Kümelerin</span>
            </div>
            {stats.embeddedItems < items.length && (
              <Button
                variant="ghost"
                size="sm"
                loading={embedding}
                onClick={computeEmbeddings}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                className="text-xs h-8 px-2"
              >
                Analizi Güncelle
              </Button>
            )}
          </div>
          {stats.styleClusters.length === 0 ? (
            <p className="text-xs text-ink-3">Kümeler için en az 6 parçanın görsel analizi gerekiyor ({stats.embeddedItems} hazır).</p>
          ) : (
            <div className="space-y-3">
              {stats.styleClusters.map(c => (
                <div key={c.label} className="flex items-center gap-3">
                  <div className="flex -space-x-2 shrink-0">
                    {c.sampleItems.map(s => (
                      <img
                        key={s.id}
                        src={s.imagePath}
                        alt={s.name}
                        className="w-9 h-9 rounded-full object-cover border-2 border-surface bg-surface-2"
                        loading="lazy"
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-ink flex-1 capitalize">{c.label}</span>
                  <span className="text-[11px] text-ink-3">{c.size} parça</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Giyim Günlüğü */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-ink">
          <CalendarDays className="w-4 h-4 text-accent" />
          <span>Giyim Günlüğü (Son 30 Gün)</span>
        </div>
        {entries.length === 0 ? (
          <p className="text-xs text-ink-3">
            Önerilerde "Bugün Giydim"e dokunduğunda veya çoklu seçim çubuğunu kullandığında kayıtlar burada listelenir.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {entries.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 py-3">
                <span className="text-xs font-semibold text-ink w-32 shrink-0 capitalize">{formatDate(entry.date)}</span>
                <div className="flex gap-2 flex-1 overflow-x-auto no-scrollbar">
                  {entry.itemIds.map(id => {
                    const info = itemInfo(id);
                    return info ? (
                      <div key={id} className="w-10 h-10 rounded-xl bg-surface-2 border border-line p-1 overflow-hidden shrink-0 flex items-center justify-center">
                        <img src={info.imagePath} alt={info.name} title={info.name} className="w-full h-full object-contain" loading="lazy" />
                      </div>
                    ) : null;
                  })}
                </div>
                <IconButton
                  label="Kaydı Sil"
                  variant="plain"
                  size="sm"
                  onClick={() => deleteEntry(entry)}
                >
                  <Trash2 className="w-4 h-4 text-ink-3 hover:text-danger" />
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
