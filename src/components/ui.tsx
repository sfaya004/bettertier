import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/* ---------- Buttons ---------- */

type Variant = "primary" | "secondary" | "quiet" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 min-h-14 px-6 py-3 rounded-[var(--radius-md)] text-[1.05rem] font-semibold no-underline text-center leading-snug transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const variants: Record<Variant, string> = {
  primary: "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-dark)] hover:text-white border-2 border-[var(--color-brand)] hover:border-[var(--color-brand-dark)]",
  secondary: "bg-white text-[var(--color-brand)] border-2 border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)] hover:text-[var(--color-brand-dark)]",
  quiet: "bg-transparent text-[var(--color-brand)] border-2 border-transparent hover:bg-[var(--color-brand-soft)] underline",
  danger: "bg-white text-[var(--color-danger)] border-2 border-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]",
};

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type={props.type ?? "button"} className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function LinkButton({ variant = "primary", className = "", href, children, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </Link>
  );
}

/* ---------- Layout ---------- */

export function Container({ children, className = "", narrow = false, wide = false }: { children: ReactNode; className?: string; narrow?: boolean; wide?: boolean }) {
  return <div className={`mx-auto w-full ${narrow ? "max-w-3xl" : wide ? "max-w-6xl" : "max-w-5xl"} px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function Card({ children, className = "", tone = "default" }: { children: ReactNode; className?: string; tone?: "default" | "good" | "warn" | "info" | "danger" }) {
  const tones = {
    default: "bg-[var(--color-panel)] border-[var(--color-line)]",
    good: "bg-[var(--color-good-soft)] border-[var(--color-good)]",
    warn: "bg-[var(--color-warn-soft)] border-[var(--color-warn)]",
    info: "bg-[var(--color-info-soft)] border-[var(--color-info)]",
    danger: "bg-[var(--color-danger-soft)] border-[var(--color-danger)]",
  };
  return <div className={`rounded-[var(--radius-lg)] border-2 p-5 sm:p-7 ${tones[tone]} ${className}`}>{children}</div>;
}

export function PageTitle({ children, lead }: { children: ReactNode; lead?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl sm:text-4xl">{children}</h1>
      {lead ? <p className="mt-3 text-[1.15rem] text-[var(--color-ink-soft)]">{lead}</p> : null}
    </div>
  );
}

export function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="text-2xl mt-10 mb-4">
      {children}
    </h2>
  );
}

/* ---------- Status ---------- */

export type Tone = "good" | "warn" | "info" | "danger";

export function Badge({ tone, symbol, children }: { tone: Tone; symbol: string; children: ReactNode }) {
  const tones: Record<Tone, string> = {
    good: "bg-[var(--color-good-soft)] text-[var(--color-good)] border-[var(--color-good)]",
    warn: "bg-[var(--color-warn-soft)] text-[var(--color-warn)] border-[var(--color-warn)]",
    info: "bg-[var(--color-info-soft)] text-[var(--color-info)] border-[var(--color-info)]",
    danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[var(--color-danger)]",
  };
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 text-[0.95rem] font-semibold ${tones[tone]}`}>
      <span aria-hidden="true" className="font-bold">
        {symbol}
      </span>
      {children}
    </span>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  const symbols: Record<Tone, string> = { good: "✓", warn: "!", info: "i", danger: "!" };
  return (
    <Card tone={tone} className="my-6">
      <div className="flex gap-3">
        <span aria-hidden="true" className="text-xl font-bold leading-none pt-1">
          {symbols[tone]}
        </span>
        <div>
          {title ? <p className="font-bold">{title}</p> : null}
          <div className="mt-1">{children}</div>
        </div>
      </div>
    </Card>
  );
}

/* ---------- Forms ---------- */

export function Field({ label, hint, id, children, error }: { label: string; hint?: string; id: string; children: ReactNode; error?: string }) {
  return (
    <div className="mb-6">
      <label htmlFor={id} className="block font-semibold text-[1.05rem]">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-[var(--color-ink-soft)] mt-1">
          {hint}
        </p>
      ) : null}
      <div className="mt-2">{children}</div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-2 font-semibold text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "w-full min-h-14 rounded-[var(--radius-md)] border-2 border-[var(--color-line-strong)] bg-white px-4 py-3 text-[1.05rem] focus:border-[var(--color-brand)]";

/* ---------- Choice list (big tap targets) ---------- */

export function ChoiceButton({ children, description, onClick, selected, ...props }: ComponentProps<"button"> & { description?: ReactNode; selected?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full text-left rounded-[var(--radius-md)] border-2 px-5 py-4 min-h-16 bg-white hover:bg-[var(--color-brand-soft)] transition-colors ${
        selected ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]" : "border-[var(--color-line-strong)]"
      }`}
      {...props}
    >
      <span className="block text-[1.1rem] font-semibold">{children}</span>
      {description ? <span className="block mt-1 text-[var(--color-ink-soft)]">{description}</span> : null}
    </button>
  );
}

export function Details({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-3">
      <summary className="font-semibold text-[var(--color-brand)] min-h-10 flex items-center">{summary}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
