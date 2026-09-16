import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cx } from './ui/primitives';

export type NotificationType = 'success' | 'error' | 'info';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

interface Props {
  notifications: Notification[];
  onClose: (id: string) => void;
  hasFloatingBar?: boolean;
}

export default function NotificationCenter({ notifications, onClose }: Props) {
  return (
    <div
      className={cx(
        'fixed z-[9999] pointer-events-none flex flex-col gap-2',
        // Mobilde üstte ortalanmış (pt-safe desteğiyle), masaüstünde sağ altta
        'top-4 inset-x-4 max-w-sm mx-auto pt-safe',
        'lg:top-auto lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0 lg:pt-0',
      )}
    >
      <AnimatePresence mode="popLayout">
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
            className={cx(
              'pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl bg-surface/95 backdrop-blur-xl border border-line shadow-float text-ink',
              n.type === 'error' && 'border-danger/30',
              n.type === 'success' && 'border-success/30',
            )}
          >
            <div className="shrink-0 mt-0.5">
              {n.type === 'success' && <CheckCircle2 className="w-4 h-4 text-success" />}
              {n.type === 'error' && <AlertCircle className="w-4 h-4 text-danger" />}
              {n.type === 'info' && <Info className="w-4 h-4 text-accent" />}
            </div>
            <p className="text-[13px] font-medium flex-1 leading-snug text-ink">{n.message}</p>
            <button
              type="button"
              onClick={() => onClose(n.id)}
              aria-label="Kapat"
              className="p-1 -mr-1 -mt-1 text-ink-3 hover:text-ink rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
