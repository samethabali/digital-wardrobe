import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'motion/react';
import { X } from 'lucide-react';
import { cx, IconButton } from './primitives';
import { useIsDesktop } from '../../hooks/useMediaQuery';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Başlık satırının sağındaki eylemler */
  actions?: React.ReactNode;
  /** Kaydırma alanının dışında, altta sabit kalan bölüm (birincil düğme) */
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Masaüstündeki pencere genişliği */
  width?: 'sm' | 'md' | 'lg' | 'xl';
  /** Mobilde tam ekran (uzun formlar, görsel detay) */
  fullHeight?: boolean;
  /** İçerik kenar boşluksuz (görsel üst alan gibi) */
  flush?: boolean;
  zIndex?: number;
}

const WIDTHS = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

let openSheets = 0;

/**
 * Mobilde alttan açılan, aşağı sürüklenerek kapanan panel; masaüstünde ortalanmış pencere.
 * Açıkken sayfa kaydırması kilitlenir, Escape ile kapanır.
 */
export default function Sheet({ open, onClose, title, subtitle, actions, footer, children, width = 'md', fullHeight, flush, zIndex = 60 }: SheetProps) {
  const isDesktop = useIsDesktop();
  const dragControls = useDragControls();

  React.useEffect(() => {
    if (!open) return;
    openSheets++;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      openSheets--;
      if (openSheets === 0) document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0" style={{ zIndex }} role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-scrim backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <div className={cx('absolute inset-0 pointer-events-none flex', isDesktop ? 'items-center justify-center p-6' : 'items-end')}>
            <motion.div
              className={cx(
                'pointer-events-auto bg-surface text-ink flex flex-col w-full overflow-hidden shadow-float',
                isDesktop ? cx('rounded-3xl max-h-[88vh]', WIDTHS[width]) : cx('rounded-t-[28px]', fullHeight ? 'h-[94dvh]' : 'max-h-[92dvh]'),
              )}
              initial={isDesktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: '100%' }}
              animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
              exit={isDesktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 340 }}
              drag={isDesktop ? false : 'y'}
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={onDragEnd}
            >
              {!isDesktop && (
                <div className="pt-2.5 pb-1 flex justify-center touch-none cursor-grab" onPointerDown={e => dragControls.start(e)}>
                  <span className="w-10 h-1.5 rounded-full bg-surface-3" />
                </div>
              )}
              {(title || actions) && (
                <div
                  className={cx('flex items-start gap-3 px-5 shrink-0', isDesktop ? 'pt-5 pb-3' : 'pt-1 pb-3 touch-none')}
                  onPointerDown={e => { if (!isDesktop && (e.target as HTMLElement).closest('button') === null) dragControls.start(e); }}
                >
                  <div className="min-w-0 flex-1 pt-1.5">
                    {title && <h2 className="text-[22px] leading-tight text-ink">{title}</h2>}
                    {subtitle && <p className="text-[13px] text-ink-3 mt-1">{subtitle}</p>}
                  </div>
                  {actions}
                  <IconButton label="Kapat" onClick={onClose} variant="plain" className="-mr-2">
                    <X className="w-5 h-5" />
                  </IconButton>
                </div>
              )}
              <div className={cx('flex-1 overflow-y-auto overscroll-contain', !flush && 'px-5 pb-5')}>
                {children}
              </div>
              {footer && (
                <div className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  {footer}
                </div>
              )}
              {!footer && !isDesktop && <div className="pb-safe shrink-0" />}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
