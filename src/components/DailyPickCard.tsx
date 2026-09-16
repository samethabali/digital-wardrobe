import React from 'react';
import { Sun, RefreshCw, Check, ChevronRight } from 'lucide-react';
import type { DailyPickResponse } from '../../shared/api';
import { apiFetch } from '../services/api';
import { Button, IconButton, ItemImage, Spinner, cx } from './ui/primitives';

interface Props {
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
  /** Bildirimden açıldıysa kart kendiliğinden yüklenir */
  autoLoad?: boolean;
  onWorn?: () => void;
}

/** Dolap ekranının başındaki "Günün kombini" kartı. Dokununca son konumun bugünkü havasına göre kombin hazırlanır. */
export default function DailyPickCard({ onNotify, autoLoad = false, onWorn }: Props) {
  const [data, setData] = React.useState<DailyPickResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const [worn, setWorn] = React.useState(false);

  const load = React.useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      setData(await apiFetch<DailyPickResponse>(`/api/daily-pick${refresh ? '?refresh=1' : ''}`));
      setIndex(0);
      setWorn(false);
    } catch (err: any) {
      onNotify(err.message || 'Günün kombini hazırlanamadı.', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  React.useEffect(() => {
    if (autoLoad) load();
  }, [autoLoad, load]);

  const weather = data?.result.weather;
  const outfit = data?.result.outfits[index];

  const markWorn = async () => {
    if (!outfit || !data) return;
    try {
      await apiFetch('/api/feedback', { body: { type: 'worn', itemIds: outfit.itemIds, generationId: data.result.generationId, context: data.result.context } });
      setWorn(true);
      onNotify('Günün kombini giyim günlüğüne eklendi.', 'success');
      onWorn?.();
    } catch (err: any) {
      onNotify(err.message || 'Kaydedilemedi.', 'error');
    }
  };

  if (!data) {
    return (
      <button
        type="button"
        onClick={() => load()}
        disabled={loading}
        className="w-full flex items-center gap-3.5 p-3.5 rounded-3xl bg-surface border border-line text-left active:scale-[0.99] transition-transform"
      >
        <span className="w-11 h-11 rounded-2xl bg-warning-soft text-warning flex items-center justify-center shrink-0">
          {loading ? <Spinner className="text-warning" /> : <Sun className="w-5 h-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">Günün kombini</span>
          <span className="block text-[13px] text-ink-3 truncate">{loading ? 'Hava durumuna bakılıyor…' : 'Bugünün havasına göre hazır bir öneri'}</span>
        </span>
        <ChevronRight className="w-5 h-5 text-ink-3" />
      </button>
    );
  }

  return (
    <section className="rounded-3xl bg-surface border border-line overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4">
        <span className="w-9 h-9 rounded-xl bg-warning-soft text-warning flex items-center justify-center shrink-0"><Sun className="w-4.5 h-4.5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink truncate">{outfit?.title || 'Günün kombini'}</p>
          <p className="text-[12px] text-ink-3 truncate">
            {weather ? `${weather.locationLabel} · ${Math.round(weather.temperatureC)}° · ${weather.condition}` : data.result.weatherError || 'Hava durumu kullanılamadı'}
          </p>
        </div>
        <IconButton label="Yeniden hazırla" size="sm" onClick={() => load(true)} disabled={loading}>
          <RefreshCw className={cx('w-4 h-4', loading && 'animate-spin')} />
        </IconButton>
      </div>

      {outfit && (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pt-3">
            {outfit.items.map(item => (
              <div key={item.id} className="w-[76px] shrink-0">
                <ItemImage item={item} className="aspect-[4/5]" rounded="rounded-xl" />
              </div>
            ))}
          </div>
          {data.result.outfits.length > 1 && (
            <div className="flex gap-1.5 px-4 pt-3" role="tablist" aria-label="Alternatifler">
              {data.result.outfits.map((o, i) => (
                <button
                  key={o.id}
                  type="button"
                  aria-label={`Alternatif ${i + 1}`}
                  onClick={() => { setIndex(i); setWorn(false); }}
                  className={cx('h-2 rounded-full transition-all', i === index ? 'w-6 bg-ink' : 'w-2 bg-surface-3')}
                />
              ))}
            </div>
          )}
          <div className="px-4 pt-3 pb-4 flex items-center gap-2">
            <p className="text-[13px] text-ink-2 line-clamp-2 flex-1">{outfit.reason}</p>
            <Button size="sm" variant={worn ? 'secondary' : 'ink'} onClick={markWorn} disabled={worn} icon={<Check className="w-4 h-4" />}>
              {worn ? 'Kaydedildi' : 'Giydim'}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
