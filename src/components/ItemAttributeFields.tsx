import React from 'react';
import {
  CATEGORIES, CATEGORY_LABELS, STYLES, STYLE_LABELS, PATTERNS, FITS, COLOR_FAMILIES, COLOR_FAMILY_HEX,
  SEASONS, SEASON_LABELS, WARMTH_LABELS, FORMALITY_LABELS,
} from '../constants/wardrobe';
import {
  CATEGORIES as SHARED_CATEGORIES, FITS as SHARED_FITS, PATTERNS as SHARED_PATTERNS, STYLES as SHARED_STYLES,
} from '../../shared/wardrobe';
import { Chip, cx } from './ui/primitives';
import { Field, Input, ScaleSelector, Select } from './ui/fields';

/** Parça ekleme ve düzenleme formlarının ortak alanları (öneri motorunun kullandığı yapılandırılmış özellikler). */
export interface ItemFormValues {
  name: string;
  category: string;
  subCategory: string;
  color: string;
  colorFamily: string;
  material: string;
  style: string;
  pattern: string;
  fit: string;
  formality: number | null;
  warmth: number | null;
  waterResistant: boolean | null;
  seasons: string[];
  price: number | null;
}

export const EMPTY_ITEM_FORM: ItemFormValues = {
  name: '', category: 'top', subCategory: '', color: '', colorFamily: '', material: '', style: 'casual',
  pattern: '', fit: '', formality: null, warmth: null, waterResistant: null, seasons: [], price: null,
};

// Liste dışı eski değerler seçim kutusunda görünmez ama kaydedilince reddedilir; forma boş olarak alınır
const valid = (options: readonly string[], value: unknown, fallback: string) =>
  (typeof value === 'string' && options.includes(value) ? value : fallback);

export function toItemForm(item: Partial<ItemFormValues> & Record<string, any>): ItemFormValues {
  return {
    name: item.name || '',
    category: valid(SHARED_CATEGORIES, item.category, 'top'),
    subCategory: item.subCategory || '',
    color: item.color || '',
    colorFamily: valid(COLOR_FAMILIES, item.colorFamily, ''),
    material: item.material || '',
    style: valid(SHARED_STYLES, item.style, 'casual'),
    pattern: valid(SHARED_PATTERNS, item.pattern, ''),
    fit: valid(SHARED_FITS, item.fit, ''),
    formality: typeof item.formality === 'number' ? item.formality : null,
    warmth: typeof item.warmth === 'number' ? item.warmth : null,
    waterResistant: typeof item.waterResistant === 'boolean' ? item.waterResistant : null,
    seasons: Array.isArray(item.seasons) ? item.seasons : [],
    price: typeof item.price === 'number' ? item.price : null,
  };
}

/** Sunucuya gönderilecek gövde: boş yapılandırılmış alanlar gönderilmez (sunucu tahmin eder). */
export function toItemPayload(form: ItemFormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: form.name, category: form.category, subCategory: form.subCategory, color: form.color,
    material: form.material, style: form.style, pattern: form.pattern, fit: form.fit,
  };
  if (form.colorFamily) payload.colorFamily = form.colorFamily;
  if (form.formality) payload.formality = form.formality;
  if (form.warmth) payload.warmth = form.warmth;
  if (form.waterResistant !== null) payload.waterResistant = form.waterResistant;
  if (form.seasons.length) payload.seasons = form.seasons;
  payload.price = form.price;
  return payload;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-[17px] text-ink">{title}</h3>
      {children}
    </section>
  );
}

export default function ItemAttributeFields({ form, onChange, disabled }: { form: ItemFormValues; onChange: (next: ItemFormValues) => void; disabled?: boolean }) {
  const set = <K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) => onChange({ ...form, [key]: value });
  const garment = ['top', 'bottom', 'onepiece', 'outerwear'].includes(form.category);

  return (
    <fieldset disabled={disabled} className="space-y-8 min-w-0">
      <Group title="Temel bilgiler">
        <Field label="Ad">
          <Input placeholder="ör. Lacivert keten gömlek" value={form.name} onChange={e => set('name', e.target.value)} />
        </Field>
        <div>
          <p className="text-[13px] font-semibold text-ink-2 mb-2">Kategori</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(c => <Chip key={c} selected={form.category === c} onClick={() => set('category', c)}>{CATEGORY_LABELS[c]}</Chip>)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tür">
            <Input placeholder="gömlek, bot…" value={form.subCategory} onChange={e => set('subCategory', e.target.value)} />
          </Field>
          <Field label="Kumaş">
            <Input placeholder="pamuk, yün…" value={form.material} onChange={e => set('material', e.target.value)} />
          </Field>
        </div>
      </Group>

      <Group title="Renk">
        <Field label="Renk adı">
          <Input placeholder="ör. açık mavi, ekru" value={form.color} onChange={e => set('color', e.target.value)} />
        </Field>
        <div>
          <p className="text-[13px] font-semibold text-ink-2 mb-2">Renk ailesi</p>
          <div className="grid grid-cols-8 sm:grid-cols-8 gap-2">
            {COLOR_FAMILIES.map(c => (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={c}
                aria-pressed={form.colorFamily === c}
                onClick={() => set('colorFamily', form.colorFamily === c ? '' : c)}
                className={cx('aspect-square rounded-full border border-black/10 transition-transform', form.colorFamily === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface scale-90' : 'active:scale-90')}
                style={{ background: c === 'çok renkli' ? 'conic-gradient(#c0392b,#e6b422,#2e7d32,#1f4e9e,#7b3fa0,#c0392b)' : (COLOR_FAMILY_HEX as Record<string, string>)[c] }}
              />
            ))}
          </div>
          <p className="text-[12px] text-ink-3 mt-2">{form.colorFamily ? `Seçili: ${form.colorFamily}` : 'Seçilmezse renk adından tahmin edilir.'}</p>
        </div>
      </Group>

      <Group title="Stil ve kesim">
        <div className="flex flex-wrap gap-2">
          {STYLES.map(s => <Chip key={s} selected={form.style === s} onClick={() => set('style', s)}>{STYLE_LABELS[s] || s}</Chip>)}
        </div>
        {garment && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Desen">
              <Select value={form.pattern} onChange={e => set('pattern', e.target.value)}>
                {PATTERNS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </Select>
            </Field>
            <Field label="Kesim">
              <Select value={form.fit} onChange={e => set('fit', e.target.value)}>
                {FITS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </Select>
            </Field>
          </div>
        )}
      </Group>

      <Group title="Ne zaman giyilir?">
        <Field label="Resmiyet">
          <ScaleSelector value={form.formality} labels={FORMALITY_LABELS} onChange={v => set('formality', v)} disabled={disabled} />
        </Field>
        <Field label="Sıcak tutma">
          <ScaleSelector value={form.warmth} labels={WARMTH_LABELS} onChange={v => set('warmth', v)} disabled={disabled} />
        </Field>
        <div>
          <p className="text-[13px] font-semibold text-ink-2 mb-2">Mevsim</p>
          <div className="grid grid-cols-4 gap-2">
            {SEASONS.map(season => {
              const selected = form.seasons.includes(season);
              return (
                <Chip key={season} selected={selected} className="justify-center"
                  onClick={() => set('seasons', selected ? form.seasons.filter(x => x !== season) : [...form.seasons, season])}>
                  {SEASON_LABELS[season] || season}
                </Chip>
              );
            })}
          </div>
        </div>
        {['outerwear', 'shoes'].includes(form.category) && (
          <div>
            <p className="text-[13px] font-semibold text-ink-2 mb-2">Su geçirmez mi?</p>
            <div className="grid grid-cols-3 gap-2">
              {([[null, 'Otomatik'], [true, 'Evet'], [false, 'Hayır']] as const).map(([value, label]) => (
                <Chip key={label} className="justify-center" selected={form.waterResistant === value} onClick={() => set('waterResistant', value)}>{label}</Chip>
              ))}
            </div>
          </div>
        )}
      </Group>

      <Group title="Fiyat">
        <Field label="Satın alma fiyatı" hint="Giyim başı maliyet için">
          <Input type="number" inputMode="decimal" min={0} placeholder="₺ (isteğe bağlı)"
            value={form.price ?? ''} onChange={e => set('price', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))} />
        </Field>
      </Group>
    </fieldset>
  );
}
