import React from 'react';
import { User, LogOut, Sun, Moon, Laptop, Shirt, Layers, ShieldCheck, Palette, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useStylist } from '../contexts/StylistContext';
import { useTheme } from '../hooks/useTheme';
import { useNotification } from '../contexts/NotificationContext';
import PageHeader from '../components/layout/PageHeader';
import StatsDashboard from '../components/StatsDashboard';
import AccountSettings from '../components/AccountSettings';
import PrivacySettings from '../components/PrivacySettings';
import StyleProfileSettings from '../components/StyleProfileSettings';
import { Button, Card, Avatar, Notice, cx } from '../components/ui/primitives';
import { Segmented } from '../components/ui/fields';

export default function ProfileView() {
  const { user, logout } = useAuth();
  const { total } = useWardrobe();
  const { savedOutfits } = useStylist();
  const { mode, setMode } = useTheme();
  const { notify, askConfirm } = useNotification();

  const [activeTab, setActiveTab] = React.useState<'stats' | 'settings'>('stats');
  const [personalColorConsent, setPersonalColorConsent] = React.useState(false);

  if (!user) return null;

  const handleLogout = async () => {
    const ok = await askConfirm('Çıkış Yap', 'Hesabınızdan çıkış yapmak istediğinize emin misiniz?', 'Çıkış Yap');
    if (!ok) return;
    logout();
    notify('Başarıyla çıkış yapıldı.', 'info');
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Sayfa Başlığı ve Kullanıcı Kartı */}
      <PageHeader
        title="Profilim"
        actions={
          <Button
            size="sm"
            variant="ghost"
            onClick={handleLogout}
            icon={<LogOut className="w-4 h-4 text-danger" />}
            className="text-danger"
          >
            Çıkış Yap
          </Button>
        }
      />

        <div>
          <Card className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <Avatar name={user.name} size={52} />
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-ink truncate">{user.name}</h2>
                <p className="text-xs text-ink-3">@{user.username} · {user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-line">
              <div className="flex-1 sm:flex-initial px-3 py-1.5 rounded-2xl bg-surface-2 border border-line text-center">
                <span className="text-base font-bold text-ink block leading-none">{total}</span>
                <span className="text-[10px] text-ink-3 font-semibold uppercase tracking-wider">Kıyafet</span>
              </div>
              <div className="flex-1 sm:flex-initial px-3 py-1.5 rounded-2xl bg-surface-2 border border-line text-center">
                <span className="text-base font-bold text-ink block leading-none">{savedOutfits.length}</span>
                <span className="text-[10px] text-ink-3 font-semibold uppercase tracking-wider">Kombin</span>
              </div>
            </div>
          </Card>
        </div>

        <div>
          <Segmented<'stats' | 'settings'>
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: 'stats', label: 'İstatistikler' },
              { value: 'settings', label: 'Ayarlar' },
            ]}
          />
        </div>


      {/* ─── İSTATİSTİKLER SEKMESİ ───────────────────────────────────────────── */}
      {activeTab === 'stats' && (
        <StatsDashboard />
      )}

      {/* ─── AYARLAR SEKMESİ ────────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-3xl mx-auto">
          {/* Görünüm / Tema Ayarı */}
          <Card className="p-5 md:p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-ink">Görünüm & Tema</h3>
              <p className="text-xs text-ink-3 mt-0.5">Uygulamanın açık veya koyu renk temasını seçin</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'system', label: 'Sistem', icon: Laptop },
                { id: 'light', label: 'Açık', icon: Sun },
                { id: 'dark', label: 'Koyu', icon: Moon },
              ].map(t => {
                const active = mode === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setMode(t.id as any)}
                    className={cx(
                      'flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border text-xs font-bold transition-all',
                      active ? 'bg-surface border-ink shadow-sm text-ink' : 'bg-surface-2 border-line text-ink-3 hover:text-ink',
                    )}
                  >
                    <t.icon className="w-5 h-5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Profil Bilgileri ve Şifre */}
          <AccountSettings />

          {/* Gizlilik ve KVKK Rızaları */}
          <PrivacySettings onConsentsChange={c => setPersonalColorConsent(c.personalColor)} />

          {/* Stil Profili */}
          <StyleProfileSettings personalColorConsent={personalColorConsent} />
        </div>
      )}
    </div>
  );
}
