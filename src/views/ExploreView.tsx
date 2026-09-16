import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Shirt, Sparkles, CheckCircle2, ChevronRight, Eye } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { useStylist } from '../contexts/StylistContext';
import { apiFetch } from '../services/api';
import type { ExploreProfile, WardrobeItem, CollabSession } from '../types';
import PageHeader from '../components/layout/PageHeader';
import Sheet from '../components/ui/Sheet';
import { Button, Card, Avatar, Notice, EmptyState, cx } from '../components/ui/primitives';
import { Input, Segmented } from '../components/ui/fields';
import { CATEGORY_LABELS, displayImage } from '../constants/wardrobe';

export default function ExploreView() {
  const { notify } = useNotification();
  const { setCollabPartner } = useStylist();
  const navigate = useNavigate();

  const [tab, setTab] = React.useState<'profiles' | 'collab'>('profiles');
  const [collabSubTab, setCollabSubTab] = React.useState<'incoming' | 'sent'>('incoming');

  // Profiller
  const [profiles, setProfiles] = React.useState<ExploreProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Profil Gardırobu Paneli
  const [viewingProfile, setViewingProfile] = React.useState<ExploreProfile | null>(null);
  const [profileItems, setProfileItems] = React.useState<WardrobeItem[]>([]);
  const [loadingWardrobe, setLoadingWardrobe] = React.useState(false);

  // Beraber Kombinler
  const [incomingSessions, setIncomingSessions] = React.useState<CollabSession[]>([]);
  const [sentSessions, setSentSessions] = React.useState<CollabSession[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loadingCollab, setLoadingCollab] = React.useState(false);
  const [expandedCollabId, setExpandedCollabId] = React.useState<string | null>(null);

  const fetchProfiles = async () => {
    setLoadingProfiles(true);
    try {
      const data = await apiFetch<{ profiles: ExploreProfile[] }>('/api/users/explore');
      setProfiles(data.profiles || []);
    } catch {
      notify('Profiller yüklenemedi.', 'error');
    } finally {
      setLoadingProfiles(false);
    }
  };

  const fetchCollabInbox = async () => {
    setLoadingCollab(true);
    try {
      const incoming = await apiFetch<{ sessions: CollabSession[]; unreadCount: number }>('/api/collab/inbox');
      setIncomingSessions(incoming.sessions || []);
      setUnreadCount(incoming.unreadCount || 0);

      const sent = await apiFetch<{ sessions: CollabSession[] }>('/api/collab/sent');
      setSentSessions(sent.sessions || []);
    } catch {
      // sessizce geç
    } finally {
      setLoadingCollab(false);
    }
  };

  React.useEffect(() => {
    fetchProfiles();
    fetchCollabInbox();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openProfileWardrobe = async (prof: ExploreProfile) => {
    setViewingProfile(prof);
    setLoadingWardrobe(true);
    try {
      const data = await apiFetch<{ items: WardrobeItem[] }>(`/api/wardrobe/user/${encodeURIComponent(prof.id)}`);
      setProfileItems(data.items || []);
    } catch {
      notify('Kullanıcı gardırobu yüklenemedi.', 'error');
      setProfileItems([]);
    } finally {
      setLoadingWardrobe(false);
    }
  };

  const startCollabWith = (prof: ExploreProfile) => {
    setCollabPartner(prof);
    navigate('/olustur');
  };

  const filteredProfiles = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q),
    );
  }, [profiles, searchQuery]);

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Keşfet"
        subtitle="Stil topluluğundaki gardıropları keşfet ve ortak kombinler üret"
      >
        <Segmented<'profiles' | 'collab'>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'profiles', label: 'Kişiler' },
            { value: 'collab', label: 'Beraber Kombinler', badge: unreadCount > 0 ? unreadCount : undefined },
          ]}
        />
      </PageHeader>

      {/* ─── KİŞİLER SEKMESİ ────────────────────────────────────────────────── */}
      {tab === 'profiles' && (
        <div className="space-y-4">
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="İsim veya kullanıcı adı ara…"
            leading={<Search className="w-4 h-4" />}
            className="h-11"
          />

          {filteredProfiles.length === 0 && !loadingProfiles ? (
            <EmptyState
              icon={<Users className="w-8 h-8 text-ink-3" />}
              title="Kullanıcı bulunamadı"
              text={searchQuery ? 'Farklı bir arama yapmayı deneyebilirsin.' : 'Henüz herkese açık gardırop profili bulunmuyor.'}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProfiles.map(prof => (
                <Card key={prof.id} className="p-4 sm:p-5 flex flex-col justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <Avatar name={prof.name} size={48} />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-ink truncate">{prof.name}</h3>
                      <p className="text-xs text-ink-3">@{prof.username}</p>
                      <p className="text-[11px] font-semibold text-accent mt-2 flex items-center gap-1">
                        <Shirt className="w-3.5 h-3.5" />
                        <span>{prof.itemCount || 0} parça kıyafet</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-line">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => openProfileWardrobe(prof)}
                      icon={<Eye className="w-4 h-4" />}
                    >
                      Gardırobu İncele
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      className="flex-1"
                      onClick={() => startCollabWith(prof)}
                      icon={<Sparkles className="w-4 h-4" />}
                    >
                      Beraber Kombin
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── BERABER KOMBİNLER SEKMESİ ──────────────────────────────────────── */}
      {tab === 'collab' && (
        <div className="space-y-4 max-w-2xl mx-auto">
          <Segmented<'incoming' | 'sent'>
            size="sm"
            value={collabSubTab}
            onChange={setCollabSubTab}
            options={[
              { value: 'incoming', label: 'Gelen İstekler', badge: unreadCount > 0 ? unreadCount : undefined },
              { value: 'sent', label: 'Gönderdiklerim' },
            ]}
          />

          {collabSubTab === 'incoming' && (
            <div className="space-y-3">
              {incomingSessions.length === 0 && !loadingCollab ? (
                <EmptyState
                  icon={<Sparkles className="w-8 h-8 text-ink-3" />}
                  title="Gelen kombin isteği yok"
                  text="Arkadaşların seninle ortak bir kombin planladığında burada görünecek."
                />
              ) : (
                incomingSessions.map(session => {
                  const isExpanded = expandedCollabId === session.id;
                  return (
                    <Card key={session.id} className="p-4 space-y-3">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedCollabId(isExpanded ? null : session.id)}
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar name={session.initiatorName || 'A'} size={36} />
                          <div>
                            <p className="text-sm font-bold text-ink">{session.initiatorName}</p>
                            <p className="text-[11px] text-ink-3">
                              {new Date(session.createdAt).toLocaleDateString('tr-TR')} · {session.event || 'Etkinlik'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent-soft text-accent">
                            %{session.compatibilityScore} Uyum
                          </span>
                          <ChevronRight className={cx('w-4 h-4 text-ink-3 transition-transform', isExpanded && 'rotate-90')} />
                        </div>
                      </div>

                      {session.collabReason && (
                        <p className="text-xs text-ink-2 leading-relaxed">{session.collabReason}</p>
                      )}

                      {isExpanded && (
                        <div className="pt-3 border-t border-line space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-ink">Stil Teması:</span>
                            <span className="text-xs font-semibold text-accent">{session.styleHarmony}</span>
                          </div>
                          <p className="text-xs text-ink-3">
                            Arkadaşının kombini ({session.myOutfit.length} parça) ile senin kombinin ({session.friendOutfit.length} parça) başarıyla eşleştirildi.
                          </p>
                        </div>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {collabSubTab === 'sent' && (
            <div className="space-y-3">
              {sentSessions.length === 0 && !loadingCollab ? (
                <EmptyState
                  icon={<Users className="w-8 h-8 text-ink-3" />}
                  title="Gönderilmiş istek yok"
                  text="Bir arkadaşını seçip 'Beraber Kombin' oluşturduğunda burada takip edebilirsin."
                />
              ) : (
                sentSessions.map(session => (
                  <Card key={session.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-ink">{session.friendName} ile Kombin</p>
                      <span className="text-xs font-bold text-accent">
                        %{session.compatibilityScore} Uyum
                      </span>
                    </div>
                    {session.collabReason && (
                      <p className="text-xs text-ink-2">{session.collabReason}</p>
                    )}
                    {session.seenByFriend && (
                      <p className="text-[11px] text-success flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Görüldü
                      </p>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── PROFİL GARDIROBU PANELİ ────────────────────────────────────────── */}
      {viewingProfile && (
        <Sheet
          open={Boolean(viewingProfile)}
          onClose={() => setViewingProfile(null)}
          title={viewingProfile.name}
          subtitle={`@${viewingProfile.username} · ${profileItems.length} parça kıyafet`}
          width="lg"
          footer={
            <Button
              variant="primary"
              block
              onClick={() => {
                const p = viewingProfile;
                setViewingProfile(null);
                startCollabWith(p);
              }}
              icon={<Sparkles className="w-4 h-4" />}
            >
              Bu Gardıropla Beraber Kombin Yap
            </Button>
          }
        >
          <div className="pt-2 pb-6">
            {profileItems.length === 0 && !loadingWardrobe ? (
              <p className="text-sm text-ink-3 text-center py-10">Bu kullanıcının herkese açık parçası bulunmuyor.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {profileItems.map(item => (
                  <div key={item.id} className="p-2.5 rounded-2xl bg-surface-2 border border-line">
                    <div className="aspect-[4/5] rounded-xl overflow-hidden bg-surface p-1 flex items-center justify-center">
                      <img
                        src={displayImage(item)}
                        alt={item.name}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <p className="text-xs font-semibold text-ink truncate mt-2">{item.name}</p>
                    <p className="text-[11px] text-ink-3 truncate">{CATEGORY_LABELS[item.category] || item.category}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
}
