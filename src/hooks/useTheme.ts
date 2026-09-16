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

function apply(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.setAttribute('content', dark ? '#141311' : '#f5f1eb'));
}

/** Açık / koyu / sistem teması. Sistem modunda işletim sistemi tercihi değişince tema da değişir. */
export function useTheme() {
  const [mode, setModeState] = React.useState<ThemeMode>(readMode);

  React.useEffect(() => {
    apply(mode);
    if (mode !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [mode]);

  const setMode = React.useCallback((next: ThemeMode) => {
    try {
      localStorage.setItem(KEY, next);
      localStorage.removeItem('aura_dark_mode');
    } catch { /* gizli sekme */ }
    setModeState(next);
  }, []);

  return { mode, setMode };
}
