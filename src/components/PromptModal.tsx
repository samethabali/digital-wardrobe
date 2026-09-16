import React from 'react';
import Sheet from './ui/Sheet';
import { Button, Notice } from './ui/primitives';
import { Input } from './ui/fields';
import { AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  title: string;
  defaultValue?: string;
  placeholder?: string;
  confirmOnly?: boolean;
  confirmText?: string;
  message?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export default function PromptModal({
  isOpen,
  title,
  defaultValue = '',
  placeholder,
  confirmOnly = false,
  confirmText,
  message,
  onConfirm,
  onCancel,
}: Props) {
  const [value, setValue] = React.useState(defaultValue);

  React.useEffect(() => {
    if (isOpen) setValue(defaultValue);
  }, [isOpen, defaultValue]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (confirmOnly) {
      onConfirm('CONFIRM');
    } else if (value.trim()) {
      onConfirm(value.trim());
    }
  };

  const actionLabel = confirmText || (confirmOnly ? 'Onayla' : 'Kaydet');

  return (
    <Sheet
      open={isOpen}
      onClose={onCancel}
      title={title}
      width="sm"
      footer={
        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            {confirmOnly ? 'İptal' : 'Vazgeç'}
          </Button>
          <Button
            variant={confirmOnly ? 'danger' : 'primary'}
            onClick={() => handleSubmit()}
            disabled={!confirmOnly && !value.trim()}
            className="flex-1"
          >
            {actionLabel}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="pt-2">
        {confirmOnly ? (
          message ? (
            <Notice tone="warning" icon={<AlertTriangle className="w-5 h-5 text-warning shrink-0" />}>
              <p className="text-ink text-sm leading-relaxed">{message}</p>
            </Notice>
          ) : null
        ) : (
          <div>
            <Input
              autoFocus
              type="text"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={placeholder}
            />
          </div>
        )}
      </form>
    </Sheet>
  );
}
