import { useEffect } from "react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TdHTMLAttributes,
  TextareaHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

// --- Button ------------------------------------------------------------------

type Variant = "primary" | "lime" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)]",
  lime: "bg-[var(--color-lime)] text-[var(--color-ink)] hover:bg-[var(--color-lime-hover)]",
  secondary: "bg-white text-[var(--color-ink)] border border-[var(--color-border-strong)] hover:bg-[var(--color-surface-muted)]",
  ghost: "bg-transparent text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]",
  danger: "bg-[var(--color-danger)] text-white hover:bg-red-800",
};

export function buttonClasses(variant: Variant = "primary", size: "sm" | "md" = "md", className?: string): string {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ink)]",
    size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
    VARIANTS[variant],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; icon?: ReactNode; loading?: boolean }) {
  return (
    <button
      className={buttonClasses(variant, size, className)}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "rounded-lg p-1.5 text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]",
        "focus-visible:outline-2 focus-visible:outline-[var(--color-ink)] disabled:opacity-40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// --- Card --------------------------------------------------------------------

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]", className)} {...rest} />;
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, highlight }: { label: string; value: ReactNode; hint?: ReactNode; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        highlight ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white" : "border-[var(--color-border)] bg-white",
      )}
    >
      <div className={cn("text-xs font-medium", highlight ? "text-white/70" : "text-[var(--color-ink-muted)]")}>{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint && <div className={cn("mt-1 text-xs", highlight ? "text-white/70" : "text-[var(--color-ink-muted)]")}>{hint}</div>}
    </div>
  );
}

// --- Badge -------------------------------------------------------------------

const BADGE_TONES = {
  neutral: "bg-[var(--color-canvas)] text-[var(--color-ink-muted)]",
  lime: "bg-[var(--color-lime-soft)] text-[var(--color-ink)]",
  success: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
};

export function Badge({ tone = "neutral", className, children }: { tone?: keyof typeof BADGE_TONES; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", BADGE_TONES[tone], className)}>
      {children}
    </span>
  );
}

export function CategoryDot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />;
}

// --- Form fields -------------------------------------------------------------

export function Field({
  label,
  hint,
  error,
  required,
  badge,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
        {label}
        {required && <span className="text-[var(--color-danger)]">*</span>}
        {badge}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-[var(--color-danger)]">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-[var(--color-ink-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-[var(--color-border-strong)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] transition-colors focus:border-[var(--color-ink)] focus:outline-none focus:ring-3 focus:ring-[var(--color-lime)]/60 disabled:cursor-not-allowed disabled:bg-[var(--color-surface-muted)] disabled:text-[var(--color-ink-faint)]";

export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cn(inputClass, invalid && "border-[var(--color-danger)]", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, "min-h-20 resize-y", className)} {...rest} />;
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, "cursor-pointer pr-8", className)} {...rest} />;
}

/** Twee of meer opties naast elkaar (bv. excl./incl. of 9%/21%). */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-ink)]",
            o.value === value ? "bg-[var(--color-brand)] text-white" : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// --- Table -------------------------------------------------------------------

export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className="relative overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-white">
      <table className={cn("w-full border-collapse text-sm", className)}>{children}</table>
    </div>
  );
}

export function Th({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5 text-left text-xs font-semibold text-[var(--color-ink-muted)]",
        className,
      )}
      {...rest}
    />
  );
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b border-[var(--color-border)] px-3 py-3 align-middle", className)} {...rest} />;
}

// --- States ------------------------------------------------------------------

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border-strong)] bg-white px-6 py-14 text-center">
      {icon && <div className="mb-3 rounded-full bg-[var(--color-lime-soft)] p-3">{icon}</div>}
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--color-ink-muted)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] px-6 py-10 text-center text-sm text-[var(--color-danger)]">
      {message}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Opnieuw proberen
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-[var(--color-border)]/60", className)} />;
}

// --- Modal -------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-10 sm:pt-20">
      <div className="fixed inset-0 bg-[#141414]/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 w-full rounded-2xl border border-[var(--color-border)] bg-white shadow-xl",
          size === "sm" && "max-w-md",
          size === "md" && "max-w-lg",
          size === "lg" && "max-w-2xl",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">{subtitle}</p>}
          </div>
          <IconButton label="Sluiten" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}
