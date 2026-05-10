import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

interface Props {
  notifications: Notification[];
  onClose: (id: string) => void;
  /** Floating action bar görünür olduğunda bildirimleri yukarı taşır */
  hasFloatingBar?: boolean;
}

export default function NotificationCenter({ notifications, onClose, hasFloatingBar = false }: Props) {
  return (
    <div
      className={`fixed right-4 z-[9999] flex flex-col gap-2 pointer-events-none max-w-[300px] w-[calc(100vw-2rem)] sm:max-w-[320px] transition-all duration-300 ${
        hasFloatingBar ? 'bottom-28 md:bottom-6' : 'bottom-6'
      }`}
    >
      <AnimatePresence mode="popLayout">
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={`pointer-events-auto flex items-center gap-2.5 p-3 rounded-xl shadow-xl backdrop-blur-md border ${
              n.type === 'success' ? 'bg-emerald-500/90 border-emerald-400/30 text-white' :
              n.type === 'error'   ? 'bg-rose-500/90 border-rose-400/30 text-white' :
              'bg-indigo-600/90 border-indigo-400/30 text-white'
            }`}
          >
            <div className="shrink-0 opacity-90">
              {n.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
              {n.type === 'error'   && <AlertCircle className="w-4 h-4" />}
              {n.type === 'info'    && <Info className="w-4 h-4" />}
            </div>
            <p className="text-[12px] font-medium flex-1 leading-tight">{n.message}</p>
            <button
              onClick={() => onClose(n.id)}
              className="p-1 hover:bg-white/10 rounded-md transition-colors opacity-60 hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
