import React from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  React.useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** Tailwind "lg" kırılım noktası: yan menü ve ortalanmış pencereler. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
