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
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden border border-white/20"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className={`p-2.5 rounded-xl ${confirmOnly ? 'bg-rose-50' : 'bg-indigo-600'}`}>
                  {confirmOnly
                    ? <AlertTriangle className="w-5 h-5 text-rose-500" />
                    : <Sparkles className="w-5 h-5 text-white" />
                  }
                </div>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {confirmOnly ? (
                  // Onay modu: sadece mesaj göster
                  message && (
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3 leading-relaxed">
                      {message}
                    </p>
                  )
                ) : (
                  // Metin giriş modu
                  <div className="relative">
                    <input
                      autoFocus
                      type="text"
                      value={value}
                      onChange={e => setValue(e.target.value)}
                      placeholder={placeholder}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3.5 text-gray-900 focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all text-base"
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all"
                  >
                    {confirmOnly ? 'İptal' : 'Vazgeç'}
                  </button>
                  <button
                    type="submit"
                    disabled={!confirmOnly && !value.trim()}
                    className={`flex-1 py-3 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:shadow-none shadow-lg ${
                      confirmOnly
                        ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-100'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
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
