import React from 'react';
import { cx } from '../ui/primitives';

/**
 * Sayfa başlığı. Mobilde yapışkan, kaydırınca küçülen başlık çubuğu; masaüstünde büyük editoryal başlık.
 */
export default function PageHeader({ title, subtitle, actions, children, className }: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Başlığın altında yapışkan kalan alan (filtre çipleri, segment kontrol) */
  children?: React.ReactNode;
  className?: string;
}) {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    // Eşik farkı: başlık küçülünce sayfa yüksekliği değişip durum titremesin
    const onScroll = () => setScrolled(prev => (prev ? window.scrollY > 4 : window.scrollY > 40));
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={cx(
      'sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 pt-safe bg-canvas/90 backdrop-blur-xl transition-shadow',
      scrolled && 'shadow-[0_1px_0_var(--c-line)]',
      className,
    )}>
      <div className={cx('flex items-center gap-3 transition-all', scrolled ? 'py-2.5 lg:py-4' : 'pt-4 pb-3 lg:pt-10 lg:pb-5')}>
        <div className="min-w-0 flex-1">
          <h1 className={cx('text-ink leading-tight truncate transition-all', scrolled ? 'text-[22px] lg:text-[30px]' : 'text-[30px] lg:text-[40px]')}>{title}</h1>
          {subtitle && !scrolled && <p className="text-[13px] text-ink-3 mt-0.5 truncate">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
      </div>
      {children && <div className="pb-3">{children}</div>}
    </header>
  );
}
