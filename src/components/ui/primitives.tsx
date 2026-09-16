import React from 'react';
import { Loader2 } from 'lucide-react';

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');
export { cx };

// ─── Düğme ──────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ink';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-strong shadow-sm',
  ink: 'bg-ink text-canvas hover:opacity-90',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger-soft text-danger hover:brightness-95',
};

// Dokunma hedefleri en az 44px (md/lg)
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-sm gap-2 rounded-2xl',
  lg: 'h-13 px-5 text-[15px] gap-2 rounded-2xl',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  block?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, block, className, children, disabled, type = 'button', ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center font-semibold transition-all active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none select-none',
        VARIANTS[variant], SIZES[size], block && 'w-full', className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'plain' | 'surface' | 'accent' | 'overlay';
  size?: 'sm' | 'md';
  className?: string;
  children?: React.ReactNode;
}

/** Yalnızca simgeli düğme; erişilebilirlik için etiket zorunlu. */
export function IconButton({ label, variant = 'plain', size = 'md', className, children, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-40 shrink-0',
        size === 'md' ? 'w-11 h-11' : 'w-9 h-9',
        variant === 'plain' && 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        variant === 'surface' && 'bg-surface border border-line text-ink hover:bg-surface-2',
        variant === 'accent' && 'bg-accent text-on-accent hover:bg-accent-strong',
        variant === 'overlay' && 'bg-surface/90 backdrop-blur text-ink shadow-card',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ─── Çip (filtre, seçim) ────────────────────────────────────────────────────
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  count?: number;
  tone?: 'default' | 'danger';
  className?: string;
  children?: React.ReactNode;
}

export function Chip({ selected, count, tone = 'default', className, children, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(
        'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all shrink-0 border',
        selected
          ? tone === 'danger' ? 'bg-danger text-canvas border-danger' : 'bg-ink text-canvas border-ink'
          : 'bg-surface text-ink-2 border-line hover:text-ink',
        className,
      )}
      {...rest}
    >
      {children}
      {count !== undefined && <span className={cx('text-[11px] tabular-nums', selected ? 'opacity-70' : 'text-ink-3')}>{count}</span>}
    </button>
  );
}

// ─── Kart ve bölüm ──────────────────────────────────────────────────────────
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('bg-surface border border-line rounded-3xl', className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, subtitle, action, className }: { title: string; subtitle?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-xl text-ink leading-tight">{title}</h2>
        {subtitle && <p className="text-[13px] text-ink-3 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cx('text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3', className)}>{children}</p>;
}

// ─── Durum göstergeleri ─────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('w-5 h-5 animate-spin text-accent', className)} />;
}

export function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <div className="w-16 h-16 rounded-full bg-surface-2 text-ink-3 flex items-center justify-center mb-4">{icon}</div>
      <h3 className="text-lg text-ink">{title}</h3>
      {text && <p className="text-sm text-ink-3 mt-1.5 max-w-xs leading-relaxed">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({ tone = 'neutral', icon, children, className }: { tone?: 'neutral' | 'warning' | 'success' | 'danger' | 'accent'; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx(
      'flex items-start gap-2.5 rounded-2xl px-3.5 py-3 text-[13px] leading-snug',
      tone === 'neutral' && 'bg-surface-2 text-ink-2',
      tone === 'warning' && 'bg-warning-soft text-warning',
      tone === 'success' && 'bg-success-soft text-success',
      tone === 'danger' && 'bg-danger-soft text-danger',
      tone === 'accent' && 'bg-accent-soft text-accent-strong',
      className,
    )}>
      {icon && <span className="shrink-0 mt-px">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Avatar({ name, size = 40, className }: { name: string; size?: number; className?: string }) {
  return (
    <div
      className={cx('rounded-full bg-accent-soft text-accent-strong font-display flex items-center justify-center shrink-0', className)}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      {(name || '?').charAt(0).toLocaleUpperCase('tr-TR')}
    </div>
  );
}

/** Açma/kapama anahtarı (rıza, gizlilik gibi ayarlar). */
export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-40', checked ? 'bg-accent' : 'bg-surface-3')}
    >
      <span className={cx('absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-surface shadow transition-transform', checked && 'translate-x-5')} />
    </button>
  );
}

/** Ortak parça görseli: arka planı kaldırılmış görsel varsa yumuşak zeminde "contain", yoksa "cover". */
export function ItemImage({ item, className, rounded = 'rounded-2xl' }: { item: { name: string; imagePath: string; cutoutImagePath?: string | null }; className?: string; rounded?: string }) {
  const [failed, setFailed] = React.useState(false);
  const cutout = Boolean(item.cutoutImagePath);
  return (
    <div className={cx('relative overflow-hidden photo-well', rounded, className)}>
      {!failed && (
        <img
          src={item.cutoutImagePath || item.imagePath}
          alt={item.name}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={cx('absolute inset-0 w-full h-full', cutout ? 'object-contain p-[8%] drop-shadow-sm' : 'object-cover')}
        />
      )}
    </div>
  );
}
