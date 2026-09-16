import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, Users, Shirt, AlertCircle, SlidersHorizontal, MapPin, CalendarClock } from 'lucide-react';
import { useStylist } from '../contexts/StylistContext';
import { useNotification } from '../contexts/NotificationContext';
import type { WardrobeItem } from '../types';
import PageHeader from '../components/layout/PageHeader';
import PlannerFields, { DRESSINESS_LABELS, formatPlannedTime } from '../components/create/PlannerFields';
import OutfitResult from '../components/create/OutfitResult';
import TripPlanner from '../components/TripPlanner';
import { Avatar, Button, Card, EmptyState, ItemImage, Notice, Spinner } from '../components/ui/primitives';
import { Segmented } from '../components/ui/fields';
import { useIsDesktop } from '../hooks/useMediaQuery';

type Mode = 'kombin' | 'beraber' | 'seyahat';
const MODES: Mode[] = ['kombin', 'beraber', 'seyahat'];

function ItemGrid({ title, items }: { title: string; items: WardrobeItem[] }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] font-semibold text-ink mb-2 truncate">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        {items.map(item => (
          <div key={item.id} className="min-w-0">
            <ItemImage item={item} className="aspect-[4/5]" rounded="rounded-xl" />
            <p className="text-[12px] text-ink-2 truncate mt-1">{item.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CreateView() {
  const stylist = useStylist();
  const {
    form, setForm, setLocation, personalContext, setPersonalContext, result, isGenerating, generationStatus, generate,
    collabPartner, collabResult, isCollabGenerating, generateCollab,
  } = stylist;
  const { notify } = useNotification();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [searchParams, setSearchParams] = useSearchParams();

  // Mod adreste tutulur: geri tuşu ve Keşfet'ten "Beraber" ile gelme çalışır
  const modeParam = searchParams.get('mod') as Mode | null;
  const mode: Mode = modeParam && MODES.includes(modeParam) ? modeParam : 'kombin';
  const setMode = (next: Mode) => setSearchParams(next === 'kombin' ? {} : { mod: next }, { replace: true });

  const [requiredItemData, setRequiredItemData] = React.useState<Map<string, WardrobeItem>>(new Map());
  // Mobilde sonuç varken form özet karta dönüşür; sonuç ekranın üstüne gelir
  const [formOpen, setFormOpen] = React.useState(!result);
  const resultRef = React.useRef<HTMLDivElement>(null);

  const scrollToResult = () => {
    if (isDesktop) return;
    setFormOpen(false);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const handleGenerate = () => {
    generate({
      location: form.location,
      event: form.event,
      eventText: form.eventText,
      dateTime: form.dateTime,
      dressiness: form.dressiness,
      activity: form.activity,
      mood: form.mood,
      styleTags: form.styleTags,
      requiredItems: form.requiredItems,
      ignoreWeather: form.ignoreWeather,
    });
    scrollToResult();
  };

  const handleCollab = async () => {
    await generateCollab();
    scrollToResult();
  };

  const summary = (
    <Card className="p-4 flex items-center gap-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[15px] font-semibold text-ink truncate">{form.event} · {DRESSINESS_LABELS[form.dressiness ?? 3].split(' (')[0]}</p>
        <p className="text-[12px] text-ink-3 flex items-center gap-3 min-w-0">
          <span className="flex items-center gap-1 truncate"><MapPin className="w-3.5 h-3.5 shrink-0" />{form.ignoreWeather ? 'Hava dikkate alınmıyor' : form.locationLabel}</span>
          <span className="flex items-center gap-1 shrink-0"><CalendarClock className="w-3.5 h-3.5" />{formatPlannedTime(form.dateTime)}</span>
        </p>
      </div>
      <Button size="sm" variant="secondary" onClick={() => setFormOpen(true)} icon={<SlidersHorizontal className="w-4 h-4" />}>Düzenle</Button>
    </Card>
  );

  const showForm = isDesktop || formOpen;

  return (
    <div className="space-y-5 pb-16">
      <PageHeader title="Oluştur">
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'kombin', label: 'Kombin' },
            { value: 'beraber', label: 'Beraber' },
            { value: 'seyahat', label: 'Seyahat' },
          ]}
        />
      </PageHeader>

      {mode === 'kombin' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
          <div className="lg:col-span-5 lg:sticky lg:top-40">
            {showForm ? (
              <Card className="p-5 space-y-5">
                <PlannerFields
                  form={form}
                  setForm={setForm}
                  setLocation={setLocation}
                  personalContext={personalContext}
                  setPersonalContext={setPersonalContext}
                  requiredItemData={requiredItemData}
                  setRequiredItemData={setRequiredItemData}
                />
                <Button block size="lg" loading={isGenerating} onClick={handleGenerate} icon={<Sparkles className="w-5 h-5" />}>
                  Kombin oluştur
                </Button>
              </Card>
            ) : summary}
          </div>

          <div ref={resultRef} className="lg:col-span-7 scroll-mt-40">
            {result ? (
              <OutfitResult />
            ) : isGenerating ? (
              <Card className="p-10 flex flex-col items-center text-center gap-3">
                <Spinner className="w-8 h-8" />
                <p className="text-[15px] font-semibold text-ink">Kombinin hazırlanıyor</p>
                <p className="text-[13px] text-ink-3">{generationStatus || 'Hava durumu ve gardırobun inceleniyor…'}</p>
              </Card>
            ) : isDesktop ? (
              <Card>
                <EmptyState
                  icon={<Shirt className="w-8 h-8" />}
                  title="Kombinin burada görünecek"
                  text="Etkinliği ve şıklık düzeyini seçip Kombin oluştur'a dokun. Konumunun havasına göre üç seçenek hazırlanır."
                />
              </Card>
            ) : null}
          </div>
        </div>
      )}

      {mode === 'beraber' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
          <div className="lg:col-span-5 space-y-4">
            {collabPartner ? (
              <>
                <Card className="p-4 flex items-center gap-3">
                  <Avatar name={collabPartner.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-ink truncate">{collabPartner.name}</p>
                    <p className="text-[12px] text-ink-3 truncate">@{collabPartner.username} · {collabPartner.itemCount} parça</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => navigate('/kesfet')}>Değiştir</Button>
                </Card>
                {showForm || !collabResult ? (
                  <Card className="p-5 space-y-5">
                    <PlannerFields
                      form={form}
                      setForm={setForm}
                      setLocation={setLocation}
                      variant="collab"
                      requiredItemData={requiredItemData}
                      setRequiredItemData={setRequiredItemData}
                    />
                    <Button block size="lg" loading={isCollabGenerating} onClick={handleCollab} icon={<Users className="w-5 h-5" />}>
                      Uyumlu kombinleri oluştur
                    </Button>
                  </Card>
                ) : summary}
              </>
            ) : (
              <Card>
                <EmptyState
                  icon={<Users className="w-8 h-8" />}
                  title="Kiminle kombin yapacaksın?"
                  text="Keşfet'ten bir kişi seç; iki gardıroptan aynı havaya ve etkinliğe uygun, birbirine yakışan kombinler hazırlanır."
                  action={<Button onClick={() => navigate('/kesfet')} icon={<Users className="w-4 h-4" />}>Kişi seç</Button>}
                />
              </Card>
            )}
          </div>

          <div ref={mode === 'beraber' ? resultRef : undefined} className="lg:col-span-7 scroll-mt-40">
            {isCollabGenerating && !collabResult ? (
              <Card className="p-10 flex flex-col items-center gap-3"><Spinner className="w-8 h-8" /><p className="text-[13px] text-ink-3">İki gardırop eşleştiriliyor…</p></Card>
            ) : collabResult ? (
              <Card className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[22px] leading-tight text-ink">{collabResult.styleHarmony}</h2>
                    <p className="text-[13px] text-ink-3 mt-0.5">Sen ve {collabResult.friendName}</p>
                  </div>
                  <span className="shrink-0 px-2.5 h-7 rounded-full bg-accent-soft text-accent-strong text-[13px] font-bold flex items-center">%{collabResult.compatibilityScore}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <ItemGrid title="Senin kombinin" items={collabResult.myItems || []} />
                  <ItemGrid title={collabResult.friendName} items={collabResult.friendItems} />
                </div>
                <p className="text-[15px] text-ink-2 leading-relaxed">{collabResult.collabReason}</p>
                {collabResult.warnings && collabResult.warnings.length > 0 && (
                  <Notice tone="warning" icon={<AlertCircle className="w-4 h-4" />}>{collabResult.warnings.join(' ')}</Notice>
                )}
                <Button variant="secondary" block loading={isCollabGenerating} onClick={handleCollab}>Yeniden oluştur</Button>
              </Card>
            ) : null}
          </div>
        </div>
      )}

      {mode === 'seyahat' && (
        <div className="max-w-2xl mx-auto">
          <TripPlanner onNotify={notify} />
        </div>
      )}
    </div>
  );
}
