import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Shirt, Sparkles, CheckCircle2, ChevronDown, Eye, Lock } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { useStylist } from '../contexts/StylistContext';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch, ApiError } from '../services/api';
import type { ExploreProfile, WardrobeItem, CollabSession } from '../types';
import PageHeader from '../components/layout/PageHeader';
import Sheet from '../components/ui/Sheet';
import { Button, Card, Avatar, EmptyState, Spinner, ItemImage, Chip, cx } from '../components/ui/primitives';
import { Input, Segmented } from '../components/ui/fields';
import { CATEGORIES, CATEGORY_LABELS } from '../constants/wardrobe';
import { COLLAB_SEEN_EVENT } from '../services/events';


interface CollabDetail {
  initiatorItems: WardrobeItem[];
  friendItems: WardrobeItem[];
}

function OutfitStrip({ title, items, fallbackCount }: { title: string; items?: WardrobeItem[]; fallbackCount: number }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-semibold text-ink-2 mb-1.5 truncate">{title}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {items
          ? items.map(item => <ItemImage key={item.id} item={item} className="aspect-square" rounded="rounded-xl" />)
          : Array.from({ length: Math.max(1, fallbackCount) }, (_, i) => <div key={i} className="aspect-square rounded-xl skeleton" />)}
      </div>
      {items && items.length === 0 && <p className="text-[12px] text-ink-3">Parçalar artık gardıropta değil.</p>}
    </div>
  );
}

function CollabSessionCard({ session, incoming, detail, expanded, onToggle }: {
  session: CollabSession;
  incoming: boolean;
  detail?: CollabDetail;
  expanded: boolean;
  onToggle: () => void;
}) {
  const otherName = incoming ? session.initiatorName : session.friendName;
  const unread = incoming && !session.seenByFriend;
  return (
    <Card className={cx('overflow-hidden', unread && 'border-accent/40')}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="w-full flex items-center gap-3 p-4 text-left">
        <Avatar name={otherName || '?'} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink truncate">
            {otherName}
            {unread && <span className="ml-2 align-middle inline-block w-2 h-2 rounded-full bg-accent" aria-label="Yeni" />}
          </p>
          <p className="text-[12px] text-ink-3 truncate">
            {session.event || 'Etkinlik'} · {new Date(session.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
            {!incoming && session.seenByFriend ? ' · Görüldü' : ''}
          </p>
        </div>
        <span className="text-[13px] font-bold text-accent shrink-0">%{session.compatibilityScore}</span>
        <ChevronDown className={cx('w-4 h-4 text-ink-3 shrink-0 transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-line pt-3">
          <p className="text-[13px] font-semibold text-ink">{session.styleHarmony}</p>
          <div className="grid grid-cols-2 gap-3">
            <OutfitStrip title={incoming ? `${otherName}` : 'Senin kombinin'} items={detail?.initiatorItems} fallbackCount={session.myOutfit.length} />
            <OutfitStrip title={incoming ? 'Senin kombinin' : `${otherName}`} items={detail?.friendItems} fallbackCount={session.friendOutfit.length} />
          </div>
          {session.collabReason && <p className="text-[13px] text-ink-2 leading-relaxed">{session.collabReason}</p>}
          {!incoming && session.seenByFriend && (
            <p className="text-[12px] text-success flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {otherName} gördü</p>
          )}
        </div>
      )}
    </Card>
  );
}

export default function ExploreView() {
  const { notify } = useNotification();
  const { setCollabPartner } = useStylist();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = React.useState<'profiles' | 'collab'>('profiles');
  const [collabSubTab, setCollabSubTab] = React.useState<'incoming' | 'sent'>('incoming');

  const [profiles, setProfiles] = React.useState<ExploreProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');

  const [viewingProfile, setViewingProfile] = React.useState<ExploreProfile | null>(null);
  const [profileItems, setProfileItems] = React.useState<WardrobeItem[]>([]);
  const [profileCategory, setProfileCategory] = React.useState('all');
  const [loadingWardrobe, setLoadingWardrobe] = React.useState(false);
  const [wardrobeError, setWardrobeError] = React.useState<string | null>(null);

  const [incomingSessions, setIncomingSessions] = React.useState<CollabSession[]>([]);
  const [sentSessions, setSentSessions] = React.useState<CollabSession[]>([]);
  const [loadingCollab, setLoadingCollab] = React.useState(true);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [details, setDetails] = React.useState<Record<string, CollabDetail>>({});

  const unreadCount = incomingSessions.filter(s => !s.seenByFriend).length;

  React.useEffect(() => {
    apiFetch<{ profiles: ExploreProfile[] }>('/api/users/explore')
      .then(data => setProfiles(data.profiles || []))
      .catch(() => notify('Profiller yüklenemedi.', 'error'))
      .finally(() => setLoadingProfiles(false));

    Promise.all([
      apiFetch<{ sessions: CollabSession[] }>('/api/collab/inbox'),
      apiFetch<{ sessions: CollabSession[] }>('/api/collab/sent'),
    ])
      .then(([incoming, sent]) => {
        setIncomingSessions(incoming.sessions || []);
        setSentSessions(sent.sessions || []);
      })
      .catch(() => undefined)
      .finally(() => setLoadingCollab(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openProfileWardrobe = async (profile: ExploreProfile) => {
    setViewingProfile(profile);
    setProfileItems([]);
    setProfileCategory('all');
    setWardrobeError(null);
    setLoadingWardrobe(true);
    try {
      const data = await apiFetch<{ items: WardrobeItem[] }>(`/api/users/explore/${encodeURIComponent(profile.id)}/wardrobe`);
      setProfileItems(data.items || []);
    } catch (err) {
      setWardrobeError(err instanceof ApiError && err.status === 403
        ? 'Bu kullanıcı gardırobunu gizledi.'
        : 'Gardırop yüklenemedi. Biraz sonra tekrar dene.');
    } finally {
      setLoadingWardrobe(false);
    }
  };

  const startCollabWith = (profile: ExploreProfile) => {
    setCollabPartner(profile);
    navigate('/olustur?mod=beraber');
  };

  const toggleSession = async (session: CollabSession) => {
    const next = expandedId === session.id ? null : session.id;
    setExpandedId(next);
    if (!next) return;

    if (!details[session.id]) {
      apiFetch<CollabDetail>(`/api/collab/${encodeURIComponent(session.id)}`)
        .then(data => setDetails(prev => ({ ...prev, [session.id]: { initiatorItems: data.initiatorItems, friendItems: data.friendItems } })))
        .catch(() => setDetails(prev => ({ ...prev, [session.id]: { initiatorItems: [], friendItems: [] } })));
    }

    // Gelen ve henüz görülmemiş kombin: görüldü işaretle, menüdeki rozeti güncelle
    if (session.friendId === user?.id && !session.seenByFriend) {
      setIncomingSessions(prev => prev.map(s => (s.id === session.id ? { ...s, seenByFriend: true } : s)));
      try {
        await apiFetch(`/api/collab/${encodeURIComponent(session.id)}/seen`, { method: 'PATCH' });
        window.dispatchEvent(new Event(COLLAB_SEEN_EVENT));
      } catch {
        setIncomingSessions(prev => prev.map(s => (s.id === session.id ? { ...s, seenByFriend: false } : s)));
      }
    }
  };

  const filteredProfiles = React.useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr-TR');
    if (!q) return profiles;
    return profiles.filter(p => p.name.toLocaleLowerCase('tr-TR').includes(q) || p.username.toLocaleLowerCase('tr-TR').includes(q));
  }, [profiles, searchQuery]);

  const visibleProfileItems = profileCategory === 'all' ? profileItems : profileItems.filter(i => i.category === profileCategory);
  const sessions = collabSubTab === 'incoming' ? incomingSessions : sentSessions;

  return (
    <div className="space-y-5 pb-16">
      <PageHeader title="Keşfet">
        <Segmented<'profiles' | 'collab'>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'profiles', label: 'Kişiler' },
            { value: 'collab', label: 'Beraber', badge: unreadCount || undefined },
          ]}
        />
      </PageHeader>

      {tab === 'profiles' && (
        <div className="space-y-4">
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="İsim veya kullanıcı adı ara…" leading={<Search className="w-4 h-4" />} />

          {loadingProfiles ? (
            <div className="py-12 flex justify-center"><Spinner className="w-7 h-7" /></div>
          ) : filteredProfiles.length === 0 ? (
            <EmptyState
              icon={<Users className="w-8 h-8" />}
              title="Kullanıcı bulunamadı"
              text={searchQuery ? 'Farklı bir arama dene.' : 'Henüz herkese açık gardırop yok.'}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredProfiles.map(profile => (
                <Card key={profile.id} className="p-4 flex items-center gap-3">
                  <button type="button" onClick={() => openProfileWardrobe(profile)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                    <Avatar name={profile.name} size={46} />
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-ink truncate">{profile.name}</p>
                      <p className="text-[12px] text-ink-3 truncate">@{profile.username} · {profile.itemCount || 0} parça</p>
                    </div>
                  </button>
                  <Button size="sm" variant="secondary" onClick={() => startCollabWith(profile)} icon={<Sparkles className="w-4 h-4" />}>
                    Beraber
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'collab' && (
        <div className="space-y-4 max-w-2xl mx-auto">
          <Segmented<'incoming' | 'sent'>
            size="sm"
            value={collabSubTab}
            onChange={value => { setCollabSubTab(value); setExpandedId(null); }}
            options={[
              { value: 'incoming', label: 'Sana gelenler', badge: unreadCount || undefined },
              { value: 'sent', label: 'Gönderdiklerin' },
            ]}
          />
          {loadingCollab ? (
            <div className="py-12 flex justify-center"><Spinner className="w-7 h-7" /></div>
          ) : sessions.length === 0 ? (
            <EmptyState
              icon={collabSubTab === 'incoming' ? <Sparkles className="w-8 h-8" /> : <Users className="w-8 h-8" />}
              title={collabSubTab === 'incoming' ? 'Henüz gelen beraber kombin yok' : 'Henüz beraber kombin oluşturmadın'}
              text={collabSubTab === 'incoming'
                ? 'Biri seninle beraber kombin oluşturduğunda burada görünür.'
                : 'Kişiler sekmesinden birini seçip "Beraber" düğmesine dokun.'}
            />
          ) : (
            <div className="space-y-3">
              {sessions.map(session => (
                <CollabSessionCard
                  key={session.id}
                  session={session}
                  incoming={collabSubTab === 'incoming'}
                  detail={details[session.id]}
                  expanded={expandedId === session.id}
                  onToggle={() => toggleSession(session)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Sheet
        open={Boolean(viewingProfile)}
        onClose={() => setViewingProfile(null)}
        title={viewingProfile?.name}
        subtitle={viewingProfile ? `@${viewingProfile.username} · ${viewingProfile.itemCount || 0} parça` : undefined}
        width="lg"
        fullHeight
        footer={viewingProfile && !wardrobeError ? (
          <Button block size="lg" onClick={() => { const p = viewingProfile; setViewingProfile(null); startCollabWith(p); }} icon={<Sparkles className="w-4 h-4" />}>
            Beraber kombin oluştur
          </Button>
        ) : undefined}
      >
        <div className="pt-1 pb-4 space-y-3">
          {loadingWardrobe ? (
            <div className="py-16 flex justify-center"><Spinner className="w-7 h-7" /></div>
          ) : wardrobeError ? (
            <EmptyState icon={<Lock className="w-8 h-8" />} title="Gardırop görüntülenemiyor" text={wardrobeError} />
          ) : profileItems.length === 0 ? (
            <EmptyState icon={<Shirt className="w-8 h-8" />} title="Henüz parça eklenmemiş" />
          ) : (
            <>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
                <Chip selected={profileCategory === 'all'} onClick={() => setProfileCategory('all')} count={profileItems.length}>Tümü</Chip>
                {CATEGORIES.filter(c => profileItems.some(i => i.category === c)).map(c => (
                  <Chip key={c} selected={profileCategory === c} onClick={() => setProfileCategory(c)} count={profileItems.filter(i => i.category === c).length}>
                    {CATEGORY_LABELS[c]}
                  </Chip>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {visibleProfileItems.map(item => (
                  <div key={item.id}>
                    <ItemImage item={item} className="aspect-[4/5]" />
                    <p className="text-[13px] font-semibold text-ink truncate mt-1.5">{item.name}</p>
                    <p className="text-[12px] text-ink-3 truncate">{CATEGORY_LABELS[item.category] || item.category}</p>
                  </div>
                ))}
              </div>
              {viewingProfile && viewingProfile.itemCount > profileItems.length && (
                <p className="text-[12px] text-ink-3 text-center flex items-center justify-center gap-1"><Eye className="w-3.5 h-3.5" /> Son eklenen {profileItems.length} parça gösteriliyor.</p>
              )}
            </>
          )}
        </div>
      </Sheet>
    </div>
  );
}
