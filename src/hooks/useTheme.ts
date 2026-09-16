import React from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
const KEY = 'aura_theme';

function readMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    const legacy = localStorage.getItem('aura_dark_mode');
    return legacy === 'true' ? 'dark' : legacy === 'false' ? 'light' : 'system';
  } catch {
    return 'system';
  }
}

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function apply(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && Boolean(media?.matches));
  document.documentElement.classList.toggle('dark', dark);
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.setAttribute('content', dark ? '#141311' : '#f5f1eb'));
}

// Tek kaynak: uygulamadaki tüm useTheme çağrıları aynı modu görür (kabuk ve ayarlar ekranı ayrışmaz)
let currentMode: ThemeMode = typeof window !== 'undefined' ? readMode() : 'system';
const listeners = new Set<() => void>();

media?.addEventListener('change', () => {
  if (currentMode === 'system') apply('system');
});

function setThemeMode(next: ThemeMode) {
  try {
    localStorage.setItem(KEY, next);
    localStorage.removeItem('aura_dark_mode');
  } catch { /* gizli sekme */ }
  currentMode = next;
  apply(next);
  listeners.forEach(listener => listener());
}

/** Açık / koyu / sistem teması. Sistem modunda işletim sistemi tercihi değişince tema da değişir. */
export function useTheme() {
  const mode = React.useSyncExternalStore(
    listener => { listeners.add(listener); return () => listeners.delete(listener); },
    () => currentMode,
    () => 'system' as ThemeMode,
  );
  React.useEffect(() => { apply(mode); }, [mode]);
  return { mode, setMode: setThemeMode };
}
