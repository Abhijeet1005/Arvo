'use client';

// Small form building blocks for the loan-advisor workspace.
//
// Visual system: a distinct slate/indigo "fintech ops" palette, kept apart
// from the rest of Arvo's warm emerald theme. The base surface tokens
// (bg-card, border-border, text-muted-foreground from globals.css) are
// already neutral warm-grey and read fine here unchanged — the emerald
// identity elsewhere in the app comes entirely from hardcoded `emerald-*`
// utility classes on accents/actives/focus-rings/badges, not from those base
// tokens. So the whole re-theme is: every hardcoded `emerald-*` below is
// `blue-*` instead. No CSS variable overrides, no scoped wrapper class.
import { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cva } from 'class-variance-authority';
import { Play, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

export const inputClass =
  'flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60';

// Indigo-flavored siblings of components/ui/{button,input,textarea}.jsx — same
// shape and variants, only the accent color changes. The rest of Arvo (agent,
// knowledge, connectors, settings) keeps the shared emerald primitives; every
// control inside the loan advisor imports these instead, so buttons and text
// fields don't leak the app-wide emerald brand color into this section.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out-strong active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-blue-600 text-white shadow-sm hover:bg-blue-700',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        outline: 'border border-input bg-card hover:border-blue-400 hover:bg-secondary/60',
        ghost: 'hover:bg-secondary',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export const Button = forwardRef(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
));
Button.displayName = 'Button';

export const Input = forwardRef(({ className, type, ...props }, ref) => (
  <input type={type} ref={ref} className={cn(inputClass, className)} {...props} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[80px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export function Section({ title, description, icon: Icon, children, aside }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_40px_-34px_rgba(15,23,42,.5)]">
      <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex items-start gap-3">
          {Icon && (
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100">
              <Icon className="size-4" aria-hidden="true" />
            </span>
          )}
          <div className="space-y-1">
            <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">{title}</h3>
            {description && <p className="max-w-2xl text-xs leading-5 text-slate-500">{description}</p>}
          </div>
        </div>
        {aside}
      </header>
      <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">{children}</div>
    </section>
  );
}

// Label + control + hint, wired up with ids so screen readers announce the hint.
export function Control({ id, label, hint, children, className }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-[11px] leading-snug text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

// `described` links the select to the hint its <Control> renders.
export function SelectBox({ id, value, onChange, children, described, ...props }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-describedby={described ? `${id}-hint` : undefined}
      className={inputClass}
      {...props}
    >
      {children}
    </select>
  );
}

// Range slider with its current value shown next to the label.
export function Slider({ id, label, value, onChange, min, max, step, format = (v) => v, hint, left, right, disabled }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className={cn('text-xs font-semibold uppercase tracking-wide text-muted-foreground', disabled && 'opacity-60')}>
          {label}
        </label>
        <span className={cn('text-xs font-semibold tabular-nums', disabled && 'opacity-50')}>{format(value)}</span>
      </div>
      <div className="flex items-center gap-3">
        {left && <span className="text-[11px] text-muted-foreground">{left}</span>}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={String(format(value))}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={cn('h-1.5 flex-1 cursor-pointer accent-blue-600', disabled && 'cursor-not-allowed opacity-40')}
        />
        {right && <span className="text-[11px] text-muted-foreground">{right}</span>}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-[11px] leading-snug text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Toggle({ id, label, description, checked, onChange, disabled }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {description && (
          <p id={`${id}-hint`} className="text-[11px] leading-snug text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-hint` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 disabled:opacity-50',
          checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
        )}
      >
        <span
          className={cn(
            'inline-block size-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
}

export function Pill({ className, children }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold', className)}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------- voice previews
// One shared player so starting a preview stops whichever one was playing.

const PreviewContext = createContext({ playing: null, toggle: () => {} });

export function PreviewProvider({ children }) {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(null);

  const toggle = useCallback((url) => {
    if (!url) return;
    if (!audio.current) {
      audio.current = new Audio();
      audio.current.addEventListener('ended', () => setPlaying(null));
      audio.current.addEventListener('error', () => setPlaying(null));
    }
    const a = audio.current;
    if (playing === url) {
      a.pause();
      setPlaying(null);
      return;
    }
    a.pause();
    a.src = url;
    a.play().then(() => setPlaying(url)).catch(() => setPlaying(null));
  }, [playing]);

  useEffect(() => () => audio.current?.pause(), []);

  return <PreviewContext.Provider value={{ playing, toggle }}>{children}</PreviewContext.Provider>;
}

export function PreviewButton({ url, name, className }) {
  const { playing, toggle } = useContext(PreviewContext);
  if (!url) return null;
  const active = playing === url;
  return (
    <button
      type="button"
      onClick={() => toggle(url)}
      aria-pressed={active}
      aria-label={active ? `Stop preview of ${name}` : `Play preview of ${name}`}
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30',
        active
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-border bg-card text-foreground hover:border-blue-400 hover:text-blue-700',
        className
      )}
    >
      {active ? <Square className="size-3" aria-hidden="true" /> : <Play className="ml-0.5 size-3.5" aria-hidden="true" />}
    </button>
  );
}

// "female · young · standard · casual"
export function voiceMeta(v) {
  return [v.gender, v.age, v.accent && v.accent !== 'standard' ? v.accent : '', v.style].filter(Boolean).join(' · ');
}
