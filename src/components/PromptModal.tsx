import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  title: string;
  defaultValue?: string;
  placeholder?: string;
  /** Sadece onay/iptal gösterir, text input olmaz */
  confirmOnly?: boolean;
  /** confirmOnly=true iken gösterilecek mesaj */
  message?: string;
  /** confirmOnly=false: text değer döner. confirmOnly=true: 'CONFIRM' döner */
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export default function PromptModal({
  isOpen,
  title,
  defaultValue = '',
  placeholder,
  confirmOnly = false,
  message,
  onConfirm,
  onCancel,
}: Props) {
  const [value, setValue] = React.useState(defaultValue);

  React.useEffect(() => {
    if (isOpen) setValue(defaultValue);
  }, [isOpen, defaultValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmOnly) {
      onConfirm('CONFIRM');
    } else if (value.trim()) {
      onConfirm(value);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-[10000] flex items-center justify-center p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="bg-secondary rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-border-color transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-2xl ${confirmOnly ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-indigo-600 shadow-lg shadow-indigo-500/20'}`}>
                  {confirmOnly
                    ? <AlertTriangle className="w-6 h-6 text-rose-500" />
                    : <Sparkles className="w-6 h-6 text-white" />
                  }
                </div>
                <h2 className="text-xl font-bold text-text-primary tracking-tight">{title}</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {confirmOnly ? (
                  message && (
                    <p className="text-sm text-text-secondary bg-primary rounded-2xl px-5 py-4 leading-relaxed border border-border-color transition-colors">
                      {message}
                    </p>
                  )
                ) : (
                  <div className="relative">
                    <input
                      autoFocus
                      type="text"
                      value={value}
                      onChange={e => setValue(e.target.value)}
                      placeholder={placeholder}
                      className="w-full bg-primary border border-border-color rounded-2xl px-5 py-4 text-text-primary focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-base placeholder:text-text-secondary/50"
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 py-4 bg-primary text-text-secondary rounded-2xl text-sm font-bold hover:bg-secondary hover:text-text-primary border border-border-color transition-all"
                  >
                    {confirmOnly ? 'İptal' : 'Vazgeç'}
                  </button>
                  <button
                    type="submit"
                    disabled={!confirmOnly && !value.trim()}
                    className={`flex-1 py-4 text-white rounded-2xl text-sm font-bold transition-all disabled:opacity-50 disabled:shadow-none shadow-xl ${
                      confirmOnly
                        ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                    }`}
                  >
                    {confirmOnly ? 'Evet, Sil' : 'Kaydet'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
