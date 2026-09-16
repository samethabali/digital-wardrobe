import React from 'react';
import { Plane, MapPin, Loader2, Umbrella, AlertCircle, Check } from 'lucide-react';
import type { LocationInput, TripPlanResponse } from '../../shared/api';
import { apiFetch } from '../services/api';
import { EVENTS, displayImage } from '../constants/wardrobe';
import LocationPicker from './common/LocationPicker';
import { Button, Card, Notice, cx } from './ui/primitives';
import { Field, Select, Input } from './ui/fields';

interface Props {
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const MAX_DAYS = 14;

function isoDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });

export default function TripPlanner({ onNotify }: Props) {
  const today = React.useMemo(() => isoDate(new Date()), []);
  const [location, setLocation] = React.useState<LocationInput | null>({
    type: 'coords',
    lat: 36.8841,
    lon: 30.7056,
    label: 'Antalya',
  });
  const [locationLabel, setLocationLabel] = React.useState('Antalya');
  const [startDate, setStartDate] = React.useState(today);
  const [endDate, setEndDate] = React.useState(isoDate(new Date(Date.now() + 3 * 86_400_000)));
  const [event, setEvent] = React.useState('Seyahat');
  const [loading, setLoading] = React.useState(false);
  const [plan, setPlan] = React.useState<TripPlanResponse | null>(null);
  const [packed, setPacked] = React.useState<Set<string>>(new Set());

  const maxEnd = isoDate(new Date(new Date(`${startDate}T12:00:00`).getTime() + (MAX_DAYS - 1) * 86_400_000));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) {
      onNotify('Önce seyahat edeceğin yeri seç.', 'error');
      return;
    }
    setLoading(true);
    try {
      const result = await apiFetch<TripPlanResponse>('/api/trips/plan', {
        body: { location, startDate, endDate, event },
      });
      setPlan(result);
      setPacked(new Set());
    } catch (err: any) {
      onNotify(err.message || 'Seyahat planı oluşturulamadı.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const totalItems = plan?.packingList.reduce((sum, g) => sum + g.items.length, 0) || 0;

  return (
    <div className="space-y-6">
      <Card className="p-5 md:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 bg-accent-soft text-accent rounded-2xl">
            <Plane className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-ink">Seyahat Bavulu Planlayıcı</h3>
            <p className="text-xs text-ink-3">Hava tahminine göre her gün için kombin ve optimize edilmiş bavul listesi</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-[13px] font-semibold text-ink-2 block mb-1.5">Nereye Gidiyorsun?</label>
            <LocationPicker
              label={locationLabel}
              value={location || undefined}
              onChange={(loc, lbl) => {
                setLocation(loc);
                setLocationLabel(lbl);
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Gidiş Tarihi">
              <Input
                type="date"
                min={today}
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  if (endDate < e.target.value) setEndDate(e.target.value);
                }}
              />
            </Field>

            <Field label="Dönüş Tarihi">
              <Input
                type="date"
                min={startDate}
                max={maxEnd}
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </Field>

            <Field label="Seyahat Amacı">
              <Select value={event} onChange={e => setEvent(e.target.value)}>
                {EVENTS.map(ev => (
                  <option key={ev} value={ev}>{ev}</option>
                ))}
              </Select>
            </Field>
          </div>

          <p className="text-[11px] text-ink-3">Hava tahmini en fazla 16 gün sonrası için mevcuttur; daha uzak günler mevsime göre tahmin edilir.</p>

          <Button
            type="submit"
            variant="primary"
            block
            loading={loading}
            icon={<Plane className="w-4 h-4" />}
          >
            Bavulu Planla
          </Button>
        </form>
      </Card>

      {plan && (
        <div className="space-y-6">
          {(plan.warnings.length > 0 || plan.tips.length > 0) && (
            <div className="space-y-2">
              {plan.tips.map((tip, i) => (
                <Notice key={i} tone="accent" icon={<Umbrella className="w-4 h-4 text-accent shrink-0" />}>
                  <p className="text-xs text-ink">{tip}</p>
                </Notice>
              ))}
              {plan.warnings.map((w, i) => (
                <Notice key={i} tone="warning" icon={<AlertCircle className="w-4 h-4 text-warning shrink-0" />}>
                  <p className="text-xs text-ink">{w}</p>
                </Notice>
              ))}
            </div>
          )}

          {/* Bavul Listesi */}
          <Card className="p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-ink">Bavul Listesi · {plan.locationLabel}</h3>
              <span className="text-xs font-semibold text-accent">{packed.size}/{totalItems} hazır</span>
            </div>

            <div className="space-y-4">
              {plan.packingList.map(group => (
                <div key={group.category}>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-2">{group.label}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.items.map(item => {
                      const done = packed.has(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setPacked(prev => {
                              const next = new Set(prev);
                              if (done) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            });
                          }}
                          className={cx(
                            'flex items-center gap-3 p-2.5 rounded-2xl border text-left transition-all',
                            done ? 'border-success/30 bg-success-soft/50' : 'border-line bg-surface-2 hover:bg-surface-3',
                          )}
                        >
                          <div className={cx(
                            'w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors',
                            done ? 'bg-success border-success text-canvas' : 'border-line bg-surface',
                          )}>
                            {done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                          </div>
                          <img
                            src={displayImage(item)}
                            alt=""
                            className="w-10 h-10 object-contain rounded-xl bg-surface"
                            loading="lazy"
                          />
                          <div className="min-w-0">
                            <p className={cx('text-xs font-semibold truncate', done ? 'line-through text-ink-3' : 'text-ink')}>{item.name}</p>
                            <p className="text-[11px] text-ink-3">{item.days} gün kullanım</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Gün Gün Kombinler */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-ink px-1">Günlük Kombin Planı</h3>
            {plan.days.map(day => (
              <Card key={day.date} className="p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-sm font-bold text-ink capitalize">{dayLabel(day.date)}</p>
                  <p className="text-xs text-ink-3">
                    {day.weather
                      ? `${Math.round(day.weather.minC ?? day.weather.temperatureC)}–${Math.round(day.weather.maxC ?? day.weather.temperatureC)}°C · ${day.weather.condition}${day.weather.precipitationProbability ? ` · %${day.weather.precipitationProbability} yağış` : ''}`
                      : 'Tahmin yok'}
                  </p>
                </div>
                {day.outfit ? (
                  <div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                      {day.outfit.items.map(item => (
                        <div key={item.id} className="w-16 shrink-0">
                          <div className="aspect-square bg-surface-2 border border-line rounded-xl overflow-hidden p-1 flex items-center justify-center">
                            <img src={displayImage(item)} alt={item.name} loading="lazy" className="w-full h-full object-contain" />
                          </div>
                          <p className="text-[10px] text-ink-3 truncate text-center mt-1">{item.name}</p>
                        </div>
                      ))}
                    </div>
                    {day.outfit.reason && <p className="text-[12px] text-ink-2 mt-2 leading-relaxed">{day.outfit.reason}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-ink-3">{day.note}</p>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
