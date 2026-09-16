import React from 'react';
import {
  Lock, Unlock, RefreshCw, BookmarkPlus, CalendarCheck, ThumbsDown, CloudSun, AlertCircle, ChevronDown, LayoutGrid, Image as ImageIcon,
} from 'lucide-react';
import { useStylist } from '../../contexts/StylistContext';
import { CATEGORY_LABELS, FEEDBACK_REASONS, SCORE_LABELS } from '../../constants/wardrobe';
import OutfitCollage from '../OutfitCollage';
import Sheet from '../ui/Sheet';
import { Button, Card, IconButton, ItemImage, Notice, Spinner, cx } from '../ui/primitives';
import { Segmented } from '../ui/fields';

/** Kombin önerisi sonucu: alternatifler, parçalar (kilitle/değiştir), açıklama, puan dökümü ve geri bildirim. */
export default function OutfitResult() {
  const {
    result, currentOutfit, selectedIndex, setSelectedIndex, isGenerating, generationStatus,
    lockedItems, toggleLock, replaceItem, reroll, sendFeedback, saveCurrent,
  } = useStylist();
  const [view, setView] = React.useState<'items' | 'collage'>('items');
  const [showBreakdown, setShowBreakdown] = React.useState(false);
  const [dislikeOpen, setDislikeOpen] = React.useState(false);

  if (!result || !currentOutfit) return null;
  const weather = result.weather;

  return (
    <div className={cx('space-y-4 relative', isGenerating && 'pointer-events-none')} aria-busy={isGenerating}>
      {isGenerating && (
        <div className="absolute inset-0 z-10 rounded-3xl bg-canvas/70 backdrop-blur-[2px] flex flex-col items-center justify-start pt-24 gap-3">
          <Spinner className="w-8 h-8" />
          <p className="text-[13px] font-semibold text-ink-2">{generationStatus || 'Kombin yenileniyor…'}</p>
        </div>
      )}

      <Card className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[22px] leading-tight text-ink">{currentOutfit.title}</h2>
          <span className="shrink-0 px-2.5 h-7 rounded-full bg-accent-soft text-accent-strong text-[13px] font-bold flex items-center tabular-nums">
            %{currentOutfit.score}
          </span>
        </div>

        {weather ? (
          <p className="text-[13px] text-ink-3 flex items-center gap-1.5">
            <CloudSun className="w-4 h-4 text-accent shrink-0" />
            <span>
              {weather.locationLabel} · {Math.round(weather.temperatureC)}° (hissedilen {Math.round(weather.feelsLikeC)}°) · {weather.condition}
              {weather.precipitationProbability ? ` · %${weather.precipitationProbability} yağış` : ''}
              {weather.isForecast ? ` · ${new Date(weather.time).toLocaleString('tr-TR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} tahmini` : ''}
            </span>
          </p>
        ) : result.weatherError ? (
          <Notice tone="warning" icon={<AlertCircle className="w-4 h-4" />}>{result.weatherError}</Notice>
        ) : null}

        <p className="text-[15px] text-ink-2 leading-relaxed">{currentOutfit.reason}</p>
      </Card>

      {result.outfits.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar snap-row -mx-4 px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Alternatif kombinler">
          {result.outfits.map((outfit, index) => (
            <button
              key={outfit.id}
              type="button"
              role="tab"
              aria-selected={selectedIndex === index}
              onClick={() => setSelectedIndex(index)}
              className={cx(
                'shrink-0 flex items-center gap-2.5 pl-1.5 pr-3.5 h-14 rounded-2xl border transition-all',
                selectedIndex === index ? 'bg-surface border-ink' : 'bg-surface-2 border-transparent text-ink-2',
              )}
            >
              <span className="flex -space-x-3">
                {outfit.items.slice(0, 3).map(item => (
                  <ItemImage key={item.id} item={item} className="w-10 h-10 border-2 border-surface" rounded="rounded-full" />
                ))}
              </span>
              <span className="text-left">
                <span className="block text-[13px] font-semibold text-ink">Seçenek {index + 1}</span>
                <span className="block text-[12px] text-ink-3 tabular-nums">%{outfit.score} uyum</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-ink-3">Kilitlediğin parça yenilemede korunur.</p>
        <Segmented<'items' | 'collage'>
          size="sm"
          className="shrink-0"
          value={view}
          onChange={setView}
          options={[
            { value: 'items', label: <LayoutGrid className="w-4 h-4" aria-label="Parçalar" /> },
            { value: 'collage', label: <ImageIcon className="w-4 h-4" aria-label="Kolaj" /> },
          ]}
        />
      </div>

      {view === 'collage' ? (
        <OutfitCollage items={currentOutfit.items} />
      ) : (
        <Card className="divide-y divide-line">
          {currentOutfit.items.map(item => {
            const locked = lockedItems.includes(item.id);
            return (
              <div key={item.id} className="flex items-center gap-3 p-3">
                <ItemImage item={item} className="w-16 h-20 shrink-0" rounded="rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink line-clamp-2 leading-snug">{item.name}</p>
                  <p className="text-[12px] text-ink-3 truncate">
                    {CATEGORY_LABELS[item.category] || item.category}{item.color ? ` · ${item.color}` : ''}
                  </p>
                </div>
                <IconButton
                  label={locked ? 'Kilidi aç' : 'Kilitle'}
                  variant={locked ? 'accent' : 'surface'}
                  aria-pressed={locked}
                  onClick={() => toggleLock(item.id)}
                >
                  {locked ? <Lock className="w-4.5 h-4.5" /> : <Unlock className="w-4.5 h-4.5" />}
                </IconButton>
                <IconButton label="Bu parçayı değiştir" variant="surface" disabled={locked} onClick={() => replaceItem(item.id)}>
                  <RefreshCw className="w-4.5 h-4.5" />
                </IconButton>
              </div>
            );
          })}
        </Card>
      )}

      {result.warnings.length > 0 && (
        <Notice tone="warning" icon={<AlertCircle className="w-4 h-4" />}>{result.warnings.join(' ')}</Notice>
      )}

      <Card>
        <button type="button" onClick={() => setShowBreakdown(v => !v)} aria-expanded={showBreakdown} className="w-full flex items-center justify-between px-4 h-12 text-[14px] font-semibold text-ink">
          Neden %{currentOutfit.score}?
          <ChevronDown className={cx('w-4 h-4 text-ink-3 transition-transform', showBreakdown && 'rotate-180')} />
        </button>
        {showBreakdown && (
          <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {SCORE_LABELS.filter(({ key }) => currentOutfit.breakdown[key] !== null && currentOutfit.breakdown[key] !== undefined).map(({ key, label }) => {
              const value = currentOutfit.breakdown[key] as number;
              return (
                <div key={key}>
                  <div className="flex justify-between text-[13px] mb-1">
                    <span className="text-ink-2">{label}</span>
                    <span className="font-semibold text-ink tabular-nums">%{value}</span>
                  </div>
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full bg-ink rounded-full" style={{ width: `${value}%` }} />
                  </div>
                </div>
              );
            })}
            {result.model === null && (
              <p className="sm:col-span-2 text-[12px] text-ink-3">Açıklama kural motoruyla yazıldı (yapay zeka stilisti o an yanıt vermedi).</p>
            )}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={saveCurrent} icon={<BookmarkPlus className="w-4 h-4" />}>Kaydet</Button>
        <Button variant="secondary" onClick={() => sendFeedback('worn')} icon={<CalendarCheck className="w-4 h-4" />}>Bugün giydim</Button>
        <Button variant="secondary" onClick={reroll} icon={<RefreshCw className="w-4 h-4" />}>Yenile</Button>
        <Button variant="ghost" onClick={() => setDislikeOpen(true)} icon={<ThumbsDown className="w-4 h-4" />}>Beğenmedim</Button>
      </div>

      <Sheet open={dislikeOpen} onClose={() => setDislikeOpen(false)} title="Neyi beğenmedin?" subtitle="Sonraki önerilerde dikkate alınır" width="sm">
        <div className="space-y-1 pt-1">
          {FEEDBACK_REASONS.map(reason => (
            <button
              key={reason.value}
              type="button"
              onClick={() => { setDislikeOpen(false); sendFeedback('disliked', reason.value); }}
              className="w-full text-left px-4 h-12 rounded-2xl text-[15px] text-ink hover:bg-surface-2 active:bg-surface-2"
            >
              {reason.label}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
