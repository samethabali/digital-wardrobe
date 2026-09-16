import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from './primitives';

export function Label({ children, htmlFor, hint }: { children: React.ReactNode; htmlFor?: string; hint?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 mb-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-2">{children}</label>
      {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
    </div>
  );
}

const control = 'w-full bg-surface-2 border border-transparent rounded-2xl text-ink placeholder:text-ink-3 transition-colors focus:outline-none focus:bg-surface focus:border-ink/30 disabled:opacity-60';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { leading?: React.ReactNode }>(
  function Input({ className, leading, ...rest }, ref) {
    return (
      <div className="relative">
        {leading && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none">{leading}</span>}
        <input ref={ref} className={cx(control, 'h-12 px-4', leading && 'pl-11', className)} {...rest} />
      </div>
    );
  },
);

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(control, 'px-4 py-3 min-h-24 resize-none leading-relaxed', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cx(control, 'h-12 pl-4 pr-10 appearance-none', className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="w-4 h-4 text-ink-3 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label hint={hint}>{label}</Label>
      {children}
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  badge?: number;
}

/** Sekme benzeri tekli seçim (iOS segmented control). */
export function Segmented<T extends string>({ options, value, onChange, className, size = 'md' }: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="tablist" className={cx('flex p-1 bg-surface-2 rounded-2xl gap-1', className)}>
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all whitespace-nowrap',
              size === 'md' ? 'h-10 text-[14px] px-3' : 'h-8 text-[13px] px-2.5',
              active ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {option.label}
            {option.badge ? <span className="min-w-5 h-5 px-1.5 rounded-full bg-accent text-on-accent text-[11px] leading-5">{option.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** 1-5 ölçeği (resmiyet, sıcak tutma, özen düzeyi). */
export function ScaleSelector({ value, onChange, labels, allowEmpty = true, disabled }: {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  labels: Record<number, string>;
  allowEmpty?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(value === n && allowEmpty ? null : n)}
            className={cx('h-11 rounded-xl text-sm font-bold transition-all', value === n ? 'bg-ink text-canvas' : 'bg-surface-2 text-ink-2 hover:text-ink')}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-ink-3 mt-1.5">{value ? labels[value] : allowEmpty ? 'Otomatik (fotoğraftan tahmin edilir)' : ''}</p>
    </div>
  );
}
