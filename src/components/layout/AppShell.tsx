import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Shirt, Layers, Sparkles, Compass, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import { apiFetch } from '../../services/api';
import { Avatar, cx } from '../ui/primitives';

const NAV = [
  { to: '/', label: 'Dolap', icon: Shirt, end: true },
  { to: '/kombinler', label: 'Kombinler', icon: Layers },
  { to: '/olustur', label: 'Oluştur', icon: Sparkles, primary: true },
  { to: '/kesfet', label: 'Keşfet', icon: Compass },
  { to: '/profil', label: 'Profil', icon: User },
] as const;

export default function AppShell() {
  const { user } = useAuth();
  useTheme(); // kayıtlı temayı uygular
  const location = useLocation();
  const [unread, setUnread] = React.useState(0);

  React.useEffect(() => {
    apiFetch<{ unreadCount: number }>('/api/collab/inbox').then(d => setUnread(d.unreadCount || 0)).catch(() => undefined);
  }, [location.pathname === '/kesfet']); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Masaüstü: sol menü */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-line bg-canvas px-4 py-6 z-30">
        <div className="px-3 mb-8">
          <p className="font-display text-[28px] leading-none text-ink">Aura</p>
          <p className="text-[12px] text-ink-3 mt-1.5">Akıllı gardırop</p>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) => cx(
                'flex items-center gap-3 h-11 px-3 rounded-2xl text-[15px] font-semibold transition-colors',
                'primary' in item
                  ? isActive ? 'bg-accent text-on-accent' : 'bg-accent-soft text-accent-strong hover:brightness-95'
                  : isActive ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
              )}
            >
              <item.icon className="w-5 h-5" strokeWidth={1.8} />
              <span className="flex-1">{item.label === 'Oluştur' ? 'Kombin Oluştur' : item.label}</span>
              {item.to === '/kesfet' && unread > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-accent text-on-accent text-[11px] leading-5 text-center">{unread}</span>}
            </NavLink>
          ))}
        </nav>
        {user && (
          <NavLink to="/profil" className="flex items-center gap-3 p-2 rounded-2xl hover:bg-surface-2">
            <Avatar name={user.name} size={36} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{user.name}</p>
              <p className="text-[12px] text-ink-3 truncate">@{user.username}</p>
            </div>
          </NavLink>
        )}
      </aside>

      <main className="lg:pl-64 pb-nav lg:pb-12">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-10">
          <Outlet />
        </div>
      </main>

      {/* Mobil: alt sekme çubuğu */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-canvas/92 backdrop-blur-xl border-t border-line pb-safe" aria-label="Ana menü">
        <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) => cx(
                'relative flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
                isActive ? 'text-ink' : 'text-ink-3',
              )}
            >
              {({ isActive }) => 'primary' in item ? (
                <>
                  <span className={cx('w-12 h-12 -mt-5 rounded-full flex items-center justify-center shadow-float transition-transform active:scale-95', isActive ? 'bg-ink text-canvas' : 'bg-accent text-on-accent')}>
                    <item.icon className="w-6 h-6" strokeWidth={2} />
                  </span>
                  <span className="-mt-0.5">{item.label}</span>
                </>
              ) : (
                <>
                  <span className="relative">
                    <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.1 : 1.7} />
                    {item.to === '/kesfet' && unread > 0 && <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-accent text-on-accent text-[10px] leading-4 text-center">{unread}</span>}
                  </span>
                  {item.label}
                  {isActive && <span className="absolute top-0 w-8 h-0.5 rounded-full bg-ink" />}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
