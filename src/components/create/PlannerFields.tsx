import React from 'react';
import { ChevronDown, X, Plus, CalendarClock } from 'lucide-react';
import type { WardrobeItem } from '../../types';
import type { PlannerForm } from '../../contexts/StylistContext';
import { EVENTS, MOODS, STYLE_TAG_GROUPS } from '../../constants/wardrobe';
import LocationPicker from '../common/LocationPicker';
import ItemPickerSheet from '../wardrobe/ItemPickerSheet';
import { Button, Chip, ItemImage, Toggle, cx } from '../ui/primitives';
import { Field, Label, ScaleSelector, Select, Textarea } from '../ui/fields';

export const DRESSINESS_LABELS: Record<number, string> = {
  1: 'Çok rahat (ev, spor)',
  2: 'Rahat (hafta sonu, kahve)',
  3: 'Dengeli (gündelik şık)',
  4: 'Özenli (iş, şık akşam)',
  5: 'Çok şık (davet, gece)',
};

const ACTIVITY_OPTIONS: { value: number | undefined; label: string }[] = [
  { value: undefined, label: 'Etkinliğe göre' },
  { value: 1, label: 'Oturarak' },
  { value: 3, label: 'Orta' },
  { value: 5, label: 'Çok hareketli' },
];

/** datetime-local girdisi için yerel "YYYY-MM-DDTHH:mm" */
function localInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatPlannedTime(dateTime?: string) {
  if (!dateTime) return 'Şimdi';
  return new Date(dateTime).toLocaleString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

interface Props {
  form: PlannerForm;
  setForm: React.Dispatch<React.SetStateAction<PlannerForm>>;
  setLocation: (location: any, label: string) => void;
  /** Beraber kombinde kişiye özel alanlar (zorunlu parça, stil kimliği) gizlenir */
  variant?: 'personal' | 'collab';
  personalContext?: string;
  setPersonalContext?: (value: string) => void;
  /** Zorunlu parçaların görselleri (seçici panelden gelen) */
  requiredItemData: Map<string, WardrobeItem>;
  setRequiredItemData: (data: Map<string, WardrobeItem>) => void;
}

/** Kombin isteği formu. Temel alanlar her zaman görünür; ayrıntılar katlanabilir bölümde (mobilde kısa form). */
export default function PlannerFields({ form, setForm, setLocation, variant = 'personal', personalContext, setPersonalContext, requiredItemData, setRequiredItemData }: Props) {
  const [showDetails, setShowDetails] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [bounds] = React.useState(() => ({
    min: localInputValue(new Date()),
    max: localInputValue(new Date(Date.now() + 15 * 86_400_000)),
  }));

  const set = <K extends keyof PlannerForm>(key: K, value: PlannerForm[K]) => setForm(prev => ({ ...prev, [key]: value }));
  const required = form.requiredItems || [];
  const styleTags = form.styleTags || [];
  const detailCount = [form.dateTime, form.eventText, form.activity, form.ignoreWeather || undefined, styleTags.length || undefined, variant === 'personal' ? required.length || undefined : undefined]
    .filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div>
        <Label>Konum</Label>
        <LocationPicker label={form.locationLabel} value={form.location} onChange={setLocation} />
      </div>

      <Field label={variant === 'collab' ? 'Birlikte gideceğiniz yer' : 'Etkinlik'}>
        <Select value={form.event} onChange={e => set('event', e.target.value)}>
          {EVENTS.map(ev => <option key={ev} value={ev}>{ev}</option>)}
        </Select>
      </Field>

      <Field label="Şıklık düzeyi">
        <ScaleSelector value={form.dressiness ?? 3} onChange={v => set('dressiness', v ?? 3)} labels={DRESSINESS_LABELS} allowEmpty={false} />
      </Field>

      <div className="rounded-2xl border border-line">
        <button
          type="button"
          onClick={() => setShowDetails(v => !v)}
          aria-expanded={showDetails}
          className="w-full flex items-center justify-between gap-3 px-4 h-12 text-left"
        >
          <span className="text-[14px] font-semibold text-ink">
            Ayrıntılar
            {detailCount > 0 && <span className="ml-2 text-[12px] font-bold text-accent">{detailCount} seçili</span>}
          </span>
          <span className="flex items-center gap-2 text-[12px] text-ink-3">
            {form.dateTime && <span className="flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" />{formatPlannedTime(form.dateTime)}</span>}
            <ChevronDown className={cx('w-4 h-4 transition-transform', showDetails && 'rotate-180')} />
          </span>
        </button>

        {showDetails && (
          <div className="px-4 pb-4 space-y-5 border-t border-line pt-4">
            <Field label="Ne zaman?" hint="En fazla 15 gün sonrası">
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  min={bounds.min}
                  max={bounds.max}
                  value={form.dateTime || ''}
                  onChange={e => set('dateTime', e.target.value || undefined)}
                  className="flex-1 min-w-0 h-12 px-3 rounded-2xl bg-surface-2 text-ink focus:outline-none focus:bg-surface focus:ring-1 focus:ring-ink/30"
                />
                {form.dateTime && <Button variant="secondary" onClick={() => set('dateTime', undefined)}>Şimdi</Button>}
              </div>
            </Field>

            <Field label="Etkinliği anlat" hint="İsteğe bağlı">
              <Textarea
                value={form.eventText || ''}
                maxLength={300}
                onChange={e => set('eventText', e.target.value || undefined)}
                placeholder="ör. akşam çatı katında doğum günü, çok yürüyeceğim"
                className="min-h-20"
              />
            </Field>

            <div>
              <Label>Fiziksel hareket</Label>
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_OPTIONS.map(option => (
                  <Chip key={option.label} selected={form.activity === option.value} onClick={() => set('activity', option.value)}>{option.label}</Chip>
                ))}
              </div>
            </div>

            <div>
              <Label>Ruh hali</Label>
              <div className="flex flex-wrap gap-2">
                {MOODS.map(mood => <Chip key={mood} selected={form.mood === mood} onClick={() => set('mood', mood)}>{mood}</Chip>)}
              </div>
            </div>

            <div className="space-y-3">
              <Label hint={styleTags.length ? `${styleTags.length} seçili` : undefined}>Stil tercihleri</Label>
              {STYLE_TAG_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-[12px] text-ink-3 mb-1.5">{group.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.tags.map(tag => {
                      const selected = styleTags.includes(tag);
                      return (
                        <Chip key={tag} selected={selected} onClick={() => set('styleTags', selected ? styleTags.filter(t => t !== tag) : [...styleTags, tag])}>
                          {tag}
                        </Chip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {variant === 'personal' && (
              <div>
                <Label hint="Kombinde mutlaka olsun">Zorunlu parçalar</Label>
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {required.map(id => {
                    const item = requiredItemData.get(id);
                    return (
                      <div key={id} className="relative w-16 shrink-0">
                        {item ? <ItemImage item={item} className="aspect-[4/5]" rounded="rounded-xl" /> : <div className="aspect-[4/5] rounded-xl bg-surface-2" />}
                        <button
                          type="button"
                          aria-label="Çıkar"
                          onClick={() => set('requiredItems', required.filter(x => x !== id))}
                          className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-ink text-canvas flex items-center justify-center"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="w-16 aspect-[4/5] shrink-0 rounded-xl border border-dashed border-line text-ink-3 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold"
                  >
                    <Plus className="w-5 h-5" />
                    Seç
                  </button>
                </div>
              </div>
            )}

            {variant === 'personal' && setPersonalContext && (
              <Field label="Stil kimliğin" hint="Her istekte kullanılır">
                <Textarea
                  value={personalContext || ''}
                  maxLength={1000}
                  onChange={e => setPersonalContext(e.target.value)}
                  placeholder="ör. Genelde bol kesim ve nötr renkler giyerim, topuklu giymem."
                />
              </Field>
            )}

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold text-ink">Havayı dikkate alma</p>
                <p className="text-[12px] text-ink-3">Kapalı mekân etkinlikleri için</p>
              </div>
              <Toggle label="Havayı dikkate alma" checked={Boolean(form.ignoreWeather)} onChange={v => set('ignoreWeather', v)} />
            </div>
          </div>
        )}
      </div>

      {variant === 'personal' && (
        <ItemPickerSheet
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          title="Zorunlu parçalar"
          subtitle="Seçtiğin parçalar her önerilen kombinde yer alır"
          initialSelected={required}
          confirmLabel="Seçimi kullan"
          onConfirm={(ids, items) => {
            const data = new Map(requiredItemData);
            items.forEach(item => data.set(item.id, item));
            setRequiredItemData(data);
            set('requiredItems', ids);
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
