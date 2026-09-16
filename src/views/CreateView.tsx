import React from 'react';
import {
  Sparkles,
  Lock,
  Unlock,
  RefreshCw,
  BookmarkPlus,
  CalendarCheck,
  ThumbsDown,
  Users,
  Plane,
  Shirt,
  CloudSun,
  AlertCircle,
  X,
  ChevronDown,
} from 'lucide-react';
import { useStylist } from '../contexts/StylistContext';
import { useNotification } from '../contexts/NotificationContext';
import { useWardrobe } from '../contexts/WardrobeContext';
import { EVENTS, MOODS, FEEDBACK_REASONS, displayImage } from '../constants/wardrobe';
import PageHeader from '../components/layout/PageHeader';
import LocationPicker from '../components/common/LocationPicker';
import TripPlanner from '../components/TripPlanner';
import { Button, IconButton, Chip, Card, Notice, Spinner, EmptyState, Avatar, Toggle, cx } from '../components/ui/primitives';
import { Segmented, Field, ScaleSelector, Select, Textarea } from '../components/ui/fields';
import { NavLink } from 'react-router-dom';

const DRESSINESS_LABELS: Record<number, string> = {
  1: '1 · Çok Rahat (Ev / Pijama / Eşofman)',
  2: '2 · Rahat (Haftasonu / Kahve)',
  3: '3 · Dengeli (Gündelik Şık)',
  4: '4 · Özenli (İş / Şık Akşam)',
  5: '5 · Çok Şık (Özel Davet / Gece)',
};

export default function CreateView() {
  const {
    form,
    setForm,
    setLocation,
    personalContext,
    setPersonalContext,
    result,
    selectedIndex,
    setSelectedIndex,
    currentOutfit,
    isGenerating,
    generationStatus,
    lockedItems,
    toggleLock,
    generate,
    replaceItem,
    reroll,
    sendFeedback,
    saveCurrent,
    collabPartner,
    setCollabPartner,
    collabResult,
    isCollabGenerating,
    generateCollab,
    clearCollab,
  } = useStylist();

  const { items } = useWardrobe();
  const { notify } = useNotification();

  const [mode, setMode] = React.useState<'outfit' | 'collab' | 'trip'>(() => (collabPartner ? 'collab' : 'outfit'));
  const [showContextField, setShowContextField] = React.useState(Boolean(personalContext));
  const [showDislikeReasons, setShowDislikeReasons] = React.useState(false);

  const handleGenerate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    generate({
      event: form.event,
      dressiness: form.dressiness,
      mood: form.mood,
      ignoreWeather: form.ignoreWeather,
      location: form.location,
      styleTags: form.styleTags,
      requiredItems: form.requiredItems,
    });
  };

  const weather = result?.weather;

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Oluştur"
        subtitle="Yapay zeka stilistinle kişisel, ortak veya seyahat kombinleri hazırla"
      >
        <Segmented
          value={mode}
          onChange={val => setMode(val)}
          options={[
            { value: 'outfit', label: 'Kişisel Kombin' },
            { value: 'collab', label: 'Beraber Kombin', badge: collabPartner ? 1 : undefined },
            { value: 'trip', label: 'Seyahat' },
          ]}
        />
      </PageHeader>

      {/* ─── KİŞİSEL KOMBİN MODU ────────────────────────────────────────────── */}
      {mode === 'outfit' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sol Kolon: Form */}
          <Card className="p-5 md:p-6 lg:col-span-5 space-y-5">
            <h2 className="text-base font-bold text-ink">Kombin Tercihleri</h2>

            {/* Konum */}
            <div>
              <label className="text-[13px] font-semibold text-ink-2 block mb-1.5">Konum</label>
              <LocationPicker
                label={form.locationLabel}
                value={form.location}
                onChange={(loc, lbl) => setLocation(loc, lbl)}
                className="w-full justify-start h-12 px-4 text-sm bg-surface-2"
              />
            </div>

            {/* Ortam / Etkinlik */}
            <Field label="Ortam & Etkinlik">
              <Select
                value={form.event}
                onChange={e => setForm(prev => ({ ...prev, event: e.target.value }))}
              >
                {EVENTS.map(ev => (
                  <option key={ev} value={ev}>{ev}</option>
                ))}
              </Select>
            </Field>

            {/* Özen Düzeyi */}
            <div>
              <label className="text-[13px] font-semibold text-ink-2 block mb-2">Özen & Resmiyet Düzeyi</label>
              <ScaleSelector
                value={form.dressiness}
                onChange={val => setForm(prev => ({ ...prev, dressiness: val || 3 }))}
                labels={DRESSINESS_LABELS}
                allowEmpty={false}
              />
            </div>

            {/* Ruh Hali */}
            <Field label="Ruh Hali & Karakter">
              <Select
                value={form.mood || 'Rahat'}
                onChange={e => setForm(prev => ({ ...prev, mood: e.target.value }))}
              >
                {MOODS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </Field>

            {/* Hava Durumu Yoksayma */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-2">
              <div>
                <p className="text-sm font-semibold text-ink">Hava Durumunu Yoksay</p>
                <p className="text-[11px] text-ink-3">Mevsim ve sıcaklık kuralları dikkate alınmaz</p>
              </div>
              <Toggle
                label="Hava durumunu yoksay"
                checked={Boolean(form.ignoreWeather)}
                onChange={val => setForm(prev => ({ ...prev, ignoreWeather: val }))}
              />
            </div>

            {/* Kişisel Stil Bağlamı */}
            <div>
              <button
                type="button"
                onClick={() => setShowContextField(v => !v)}
                className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
              >
                {showContextField ? 'Stil kimliği notunu gizle' : '+ Stil kimliği veya ek istek ekle'}
              </button>
              {showContextField && (
                <div className="mt-2">
                  <Textarea
                    value={personalContext}
                    onChange={e => setPersonalContext(e.target.value)}
                    placeholder="Örn: Genelde bol kesim severim, spor ayakkabı öncelikli olsun, minimalist bir çizgi istiyorum…"
                    className="text-xs min-h-20"
                  />
                </div>
              )}
            </div>

            <Button
              variant="primary"
              size="lg"
              block
              loading={isGenerating}
              onClick={() => handleGenerate()}
              icon={<Sparkles className="w-5 h-5" />}
            >
              Kombin Oluştur
            </Button>
          </Card>

          {/* Sağ Kolon: Sonuç */}
          <div className="lg:col-span-7 space-y-4">
            {isGenerating && (
              <Card className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                <Spinner className="w-8 h-8" />
                <div>
                  <h3 className="text-base font-bold text-ink">Kombinin Hazırlanıyor</h3>
                  <p className="text-xs text-ink-3 mt-1">{generationStatus || 'Gardırobun ve bağlam inceleniyor…'}</p>
                </div>
              </Card>
            )}

            {!isGenerating && !result && (
              <Card className="p-10 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center text-ink-3 mb-3">
                  <Shirt className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-ink">Henüz kombin oluşturulmadı</h3>
                <p className="text-xs text-ink-3 max-w-sm mt-1 leading-relaxed">
                  Sol taraftaki tercihleri belirleyip "Kombin Oluştur" butonuna dokunarak yapay zeka önerilerini alabilirsin.
                </p>
              </Card>
            )}

            {!isGenerating && result && currentOutfit && (
              <div className="space-y-4">
                {/* Sonuç Kartı Başlığı */}
                <Card className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-ink truncate">{currentOutfit.title}</h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-accent-soft text-accent text-xs font-bold">
                          %{currentOutfit.score} Uyum
                        </span>
                      </div>
                      {weather && (
                        <p className="text-xs text-ink-3 mt-1 flex items-center gap-1.5">
                          <CloudSun className="w-4 h-4 text-accent" />
                          <span>{weather.locationLabel} · {Math.round(weather.temperatureC)}°C, {weather.condition}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-ink-2 leading-relaxed mt-2">{currentOutfit.reason}</p>

                  {/* Alternatif Kombinler Şeridi */}
                  {result.outfits.length > 1 && (
                    <div className="pt-4 mt-4 border-t border-line">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-2">Alternatif Seçenekler</p>
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                        {result.outfits.map((outfit, idx) => (
                          <button
                            key={outfit.id}
                            type="button"
                            onClick={() => setSelectedIndex(idx)}
                            className={cx(
                              'flex items-center gap-2 p-2 rounded-2xl border text-left shrink-0 transition-all',
                              selectedIndex === idx ? 'bg-surface border-ink shadow-sm' : 'bg-surface-2 border-line hover:bg-surface-3',
                            )}
                          >
                            <div className="flex -space-x-2">
                              {outfit.items.slice(0, 3).map(i => (
                                <img
                                  key={i.id}
                                  src={displayImage(i)}
                                  alt=""
                                  className="w-7 h-7 rounded-full object-cover border border-surface bg-surface"
                                />
                              ))}
                            </div>
                            <span className="text-xs font-semibold text-ink whitespace-nowrap">
                              {outfit.title} · %{outfit.score}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>

                {/* Kombin Parçaları */}
                <div className="space-y-2.5">
                  {currentOutfit.items.map(item => {
                    const isLocked = lockedItems.includes(item.id);
                    return (
                      <Card key={item.id} className="p-3.5 flex items-center gap-3.5">
                        <div className="w-16 h-20 rounded-2xl bg-surface-2 border border-line overflow-hidden p-1 shrink-0 flex items-center justify-center">
                          <img
                            src={displayImage(item)}
                            alt={item.name}
                            className="w-full h-full object-contain"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-ink truncate">{item.name}</p>
                          <p className="text-xs text-ink-3 truncate mt-0.5">
                            {item.color ? `${item.color} · ` : ''}{item.category}
                          </p>
                        </div>

                        {/* Dokunmatik dostu eylemler */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant={isLocked ? 'primary' : 'secondary'}
                            onClick={() => toggleLock(item.id)}
                            icon={isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          >
                            {isLocked ? 'Kilitli' : 'Kilitle'}
                          </Button>

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => replaceItem(item.id)}
                            icon={<RefreshCw className="w-3.5 h-3.5" />}
                          >
                            Değiştir
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* Alt Eylemler */}
                <Card className="p-4 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                    <Button
                      variant="primary"
                      className="flex-1"
                      onClick={() => saveCurrent()}
                      icon={<BookmarkPlus className="w-4 h-4" />}
                    >
                      Kombini Kaydet
                    </Button>
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => sendFeedback('worn')}
                      icon={<CalendarCheck className="w-4 h-4 text-accent" />}
                    >
                      Bugün Giydim
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => reroll()}
                      icon={<RefreshCw className="w-4 h-4" />}
                    >
                      Yenile
                    </Button>
                    <div className="relative">
                      <Button
                        variant="ghost"
                        onClick={() => setShowDislikeReasons(v => !v)}
                        icon={<ThumbsDown className="w-4 h-4 text-ink-3" />}
                      >
                        Beğenmedim
                      </Button>
                      {showDislikeReasons && (
                        <div className="absolute right-0 bottom-full mb-2 w-56 rounded-2xl bg-surface border border-line shadow-float p-2 z-30 space-y-1">
                          <p className="text-[11px] font-bold text-ink-3 px-2 py-1 uppercase tracking-wider">Sebep Belirt</p>
                          {FEEDBACK_REASONS.map(r => (
                            <button
                              key={r.value}
                              type="button"
                              onClick={() => {
                                sendFeedback('disliked', r.value);
                                setShowDislikeReasons(false);
                              }}
                              className="w-full text-left p-2 rounded-xl text-xs text-ink hover:bg-surface-2 transition-colors"
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── BERABER KOMBİN MODU ───────────────────────────────────────────── */}
      {mode === 'collab' && (
        <div className="space-y-6 max-w-2xl mx-auto">
          {collabPartner ? (
            <Card className="p-5 md:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={collabPartner.name} size={48} />
                  <div>
                    <h3 className="text-base font-bold text-ink">{collabPartner.name} ile Beraber Kombin</h3>
                    <p className="text-xs text-ink-3">@{collabPartner.username}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCollabPartner(null)}
                >
                  Değiştir
                </Button>
              </div>

              <div className="space-y-3 pt-2">
                <Field label="Birlikte Gidilecek Etkinlik">
                  <Select
                    value={form.event}
                    onChange={e => setForm(prev => ({ ...prev, event: e.target.value }))}
                  >
                    {EVENTS.map(ev => (
                      <option key={ev} value={ev}>{ev}</option>
                    ))}
                  </Select>
                </Field>

                <Button
                  variant="primary"
                  size="lg"
                  block
                  loading={isCollabGenerating}
                  onClick={() => generateCollab()}
                  icon={<Users className="w-5 h-5" />}
                >
                  Uyumlu Kombinleri Oluştur
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center text-ink-3 mx-auto">
                <Users className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink">Bir Arkadaşını Seç</h3>
                <p className="text-xs text-ink-3 max-w-sm mx-auto mt-1">
                  Keşfet sekmesindeki profillerden bir arkadaşını seçerek onun gardırobuyla senin gardırobun arasında mükemmel stil uyumu yakalayabilirsin.
                </p>
              </div>
              <NavLink to="/kesfet">
                <Button variant="primary" icon={<Users className="w-4 h-4" />}>
                  Keşfet'ten Arkadaş Bul
                </Button>
              </NavLink>
            </Card>
          )}

          {/* Beraber Kombin Sonucu */}
          {collabResult && (
            <Card className="p-5 md:p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h3 className="text-lg font-bold text-ink">Ortak Stil Uyumu</h3>
                  <p className="text-xs text-ink-3 mt-0.5">{collabResult.styleHarmony || collabResult.collabReason}</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-accent text-on-accent text-sm font-bold">
                  %{collabResult.compatibilityScore} Uyum
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Benim Kombinim */}
                <div className="p-3.5 rounded-2xl bg-surface-2 border border-line space-y-2">
                  <p className="text-xs font-bold text-ink">Senin Kombinin</p>
                  <div className="grid grid-cols-2 gap-2">
                    {collabResult.myItems.map(item => (
                      <div key={item.id} className="aspect-square rounded-xl bg-surface p-1 border border-line flex items-center justify-center overflow-hidden">
                        <img src={displayImage(item)} alt={item.name} className="w-full h-full object-contain" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Arkadaşımın Kombini */}
                <div className="p-3.5 rounded-2xl bg-surface-2 border border-line space-y-2">
                  <p className="text-xs font-bold text-ink">{collabResult.friendName} Kombini</p>
                  <div className="grid grid-cols-2 gap-2">
                    {collabResult.friendItems.map(item => (
                      <div key={item.id} className="aspect-square rounded-xl bg-surface p-1 border border-line flex items-center justify-center overflow-hidden">
                        <img src={displayImage(item)} alt={item.name} className="w-full h-full object-contain" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─── SEYAHAT MODU ─────────────────────────────────────────────────── */}
      {mode === 'trip' && (
        <div className="max-w-2xl mx-auto">
          <TripPlanner onNotify={notify} />
        </div>
      )}
    </div>
  );
}
