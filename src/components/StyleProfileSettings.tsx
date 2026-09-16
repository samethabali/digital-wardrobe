import React from 'react';
import { Palette, Camera, Trash2, Save, Sparkles } from 'lucide-react';
import type { StyleProfile } from '../../shared/api';
import { apiFetch, compressImage } from '../services/api';
import { COLOR_FAMILIES, COLOR_FAMILY_HEX, FITS } from '../constants/wardrobe';
import { useNotification } from '../contexts/NotificationContext';
import { Button, Card, Chip, Notice } from './ui/primitives';
import { Textarea } from './ui/fields';

interface Props {
  personalColorConsent: boolean;
}

const FIT_OPTIONS = FITS.filter(f => f.value && f.value !== 'belirsiz');
const SEASON_TEXT: Record<string, string> = { ilkbahar: 'İlkbahar', yaz: 'Yaz', sonbahar: 'Sonbahar', 'kış': 'Kış' };

function Swatches({ colors }: { colors: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map(c => (
        <span key={c} className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-surface-2 border border-line text-xs font-semibold text-ink">
          <span className="w-3 h-3 rounded-full border border-black/10 shrink-0" style={{ background: (COLOR_FAMILY_HEX as Record<string, string>)[c] }} />
          {c}
        </span>
      ))}
    </div>
  );
}

export default function StyleProfileSettings({ personalColorConsent }: Props) {
  const { notify, askConfirm } = useNotification();
  const [profile, setProfile] = React.useState<StyleProfile | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [analyzing, setAnalyzing] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(() => {
    apiFetch<StyleProfile>('/api/style/profile').then(setProfile).catch(err => notify(err.message || 'Stil profili alınamadı.', 'error'));
  }, [notify]);

  React.useEffect(() => { load(); }, [personalColorConsent]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile) return null;

  const toggleIn = (field: 'preferredFits' | 'avoidFits' | 'dislikedColorFamilies', value: string) => {
    const list = profile[field];
    const next = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
    const other = field === 'preferredFits' ? 'avoidFits' : field === 'avoidFits' ? 'preferredFits' : null;
    setProfile({ ...profile, [field]: next, ...(other ? { [other]: profile[other].filter(v => v !== value) } : {}) });
  };

  const save = async () => {
    setSaving(true);
    try {
      const { preferredFits, avoidFits, dislikedColorFamilies, notes } = profile;
      setProfile(await apiFetch<StyleProfile>('/api/style/profile', { method: 'PUT', body: { preferredFits, avoidFits, dislikedColorFamilies, notes } }));
      notify('Stil profilin kaydedildi; önerilerde kullanılacak.', 'success');
    } catch (err: any) {
      notify(err.message || 'Kaydedilemedi.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const analyze = async (file: File) => {
    setAnalyzing(true);
    try {
      const image = await compressImage(file, 1024, 0.85);
      setProfile(await apiFetch<StyleProfile>('/api/style/personal-color', { body: image }));
      notify('Kişisel renk paletin hazır.', 'success');
    } catch (err: any) {
      notify(err.message || 'Renk analizi yapılamadı.', 'error');
    } finally {
      setAnalyzing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeColor = async () => {
    const ok = await askConfirm('Renk analizini sil', 'Kişisel renk paletin silinsin mi? Öneriler artık bu paleti kullanmaz.', 'Evet, Sil');
    if (!ok) return;
    setProfile(await apiFetch<StyleProfile>('/api/style/personal-color', { method: 'DELETE' }));
  };

  return (
    <Card className="p-5 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-accent-soft text-accent rounded-2xl">
          <Palette className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-ink">Stil Profilim</h3>
          <p className="text-xs text-ink-3 mt-0.5">Kombin puanlamasında kullanılan kişisel tercihlerin</p>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-2">Sevdiğim Kesimler</p>
        <div className="flex flex-wrap gap-2">
          {FIT_OPTIONS.map(f => (
            <Chip
              key={f.value}
              selected={profile.preferredFits.includes(f.value)}
              onClick={() => toggleIn('preferredFits', f.value)}
            >
              {f.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-2">Kaçındığım Kesimler</p>
        <div className="flex flex-wrap gap-2">
          {FIT_OPTIONS.map(f => (
            <Chip
              key={f.value}
              tone="danger"
              selected={profile.avoidFits.includes(f.value)}
              onClick={() => toggleIn('avoidFits', f.value)}
            >
              {f.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-2">Sevmediğim Renkler</p>
        <div className="flex flex-wrap gap-2">
          {COLOR_FAMILIES.map(c => (
            <Chip
              key={c}
              tone="danger"
              selected={profile.dislikedColorFamilies.includes(c)}
              onClick={() => toggleIn('dislikedColorFamilies', c)}
            >
              <span className="w-2.5 h-2.5 rounded-full border border-black/10 shrink-0" style={{ background: (COLOR_FAMILY_HEX as Record<string, string>)[c] }} />
              <span>{c}</span>
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-1.5">Özel Stil Notları</p>
        <Textarea
          value={profile.notes}
          maxLength={1000}
          onChange={e => setProfile({ ...profile, notes: e.target.value })}
          placeholder="Ör. Ofiste çalışıyorum, topuklu giymiyorum, koyu renkleri tercih ediyorum…"
          className="text-xs min-h-20"
        />
      </div>

      {profile.preferenceSummary && (
        <Notice tone="accent" icon={<Sparkles className="w-4 h-4 text-accent shrink-0" />}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-accent-strong mb-0.5">Geri Bildirimlerinden Öğrenilenler</p>
          <p className="text-xs text-ink leading-relaxed">{profile.preferenceSummary}</p>
        </Notice>
      )}

      <div className="flex justify-end pt-1">
        <Button
          variant="primary"
          loading={saving}
          onClick={save}
          icon={<Save className="w-4 h-4" />}
        >
          Stil Profilini Kaydet
        </Button>
      </div>

      <div className="h-px bg-line" />

      {/* Kişisel Renk Analizi */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-ink">Kişisel Renk Analizi</h4>
        {!personalColorConsent ? (
          <p className="text-xs text-ink-3 leading-relaxed">
            Yüz fotoğrafından sana en çok yakışan renk ailelerini çıkarmak için yukarıdaki Gizlilik bölümünden "Kişisel renk analizi" iznini vermelisin. Fotoğraf asla saklanmaz.
          </p>
        ) : profile.personalColor ? (
          <div className="space-y-3">
            <p className="text-xs text-ink">
              <b>{SEASON_TEXT[profile.personalColor.season] || profile.personalColor.season}</b> paleti · {profile.personalColor.undertone} alt ton · {profile.personalColor.contrast} kontrast
            </p>
            {profile.personalColor.note && <p className="text-xs text-ink-3 italic">{profile.personalColor.note}</p>}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-1.5">Sana En Çok Yakışanlar</p>
              <Swatches colors={profile.personalColor.bestColorFamilies} />
            </div>
            {profile.personalColor.avoidColorFamilies.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-1.5">Yüzüne Yakın Kaçınman Önerilenler</p>
                <Swatches colors={profile.personalColor.avoidColorFamilies} />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                loading={analyzing}
                onClick={() => fileRef.current?.click()}
                icon={<Camera className="w-3.5 h-3.5" />}
              >
                Yeniden Analiz Et
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={removeColor}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Sil
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-ink-3">Gün ışığında, makyajsız ve filtresiz bir yüz fotoğrafı yükle. Fotoğraf yalnızca analiz için kullanılır, saklanmaz.</p>
            <Button
              variant="secondary"
              loading={analyzing}
              onClick={() => fileRef.current?.click()}
              icon={<Camera className="w-4 h-4" />}
            >
              Fotoğraf Yükle & Analiz Et
            </Button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) analyze(f); }} />
      </div>
    </Card>
  );
}
