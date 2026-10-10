'use client';

// A shared, plain-English journey for both the public consultation and the
// operator view. It intentionally shows progress and short highlights only.
//
// The colour comes from the CSS variables --accent and --accent-ink when an
// ancestor sets them (a demo's branded call room does); without them it is the
// product blue.
import { Check } from 'lucide-react';
import { PROGRESS_STEPS } from '@/lib/loan/progress';
import { cn } from '@/lib/utils';

const ACCENT = 'var(--accent,#1d4ed8)';
const INK = 'var(--accent-ink,#ffffff)';
const tint = (percent) => `color-mix(in srgb, var(--accent,#2563eb) ${percent}%, transparent)`;

// `steps` lets a demo word the same six steps for its own industry; the ids
// (and so the agent's update_progress calls) stay the same.
export default function ProgressChecklist({ progress, className, steps = PROGRESS_STEPS }) {
  const currentIndex = progress?.currentStepIndex ?? -1;
  const completed = new Set(progress?.completedStepIds || []);
  const highlights = progress?.highlights || {};

  return (
    <ol className={cn('relative', className)} aria-label="Consultation progress">
      {steps.map((step, index) => {
        const isDone = completed.has(step.id) || index < currentIndex;
        const isCurrent = index === currentIndex && !isDone;
        const highlight = highlights[step.id];
        const isLast = index === steps.length - 1;

        return (
          <li
            key={step.id}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn('relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3', !isLast && 'pb-1')}
          >
            {!isLast && (
              <span
                className={cn(
                  'absolute bottom-[-0.25rem] left-[0.84375rem] top-7 w-px transition-colors duration-500',
                  !isDone && 'bg-border'
                )}
                style={isDone ? { backgroundColor: tint(40) } : undefined}
                aria-hidden="true"
              />
            )}

            <span className="relative z-10 mt-2.5 grid size-7 shrink-0 place-items-center">
              {isDone ? (
                <span className="grid size-6 place-items-center rounded-full shadow-sm" style={{ backgroundColor: ACCENT, color: INK }}>
                  <Check className="size-3.5 stroke-[2.5]" aria-hidden="true" />
                </span>
              ) : isCurrent ? (
                <span
                  className="grid size-6 place-items-center rounded-full border"
                  style={{ borderColor: tint(30), backgroundColor: tint(10), boxShadow: `0 0 0 4px ${tint(7)}` }}
                >
                  <span className="size-2 rounded-full motion-safe:animate-pulse" style={{ backgroundColor: ACCENT }} aria-hidden="true" />
                </span>
              ) : (
                <span className="grid size-6 place-items-center rounded-full border border-border bg-card text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
              )}
            </span>

            <div
              className="min-w-0 rounded-xl px-3 py-2.5 transition-[background-color,color] duration-300"
              style={isCurrent ? { backgroundColor: tint(7) } : undefined}
            >
              <div className="flex min-w-0 items-center justify-between gap-3">
                <p
                  className={cn(
                    'min-w-0 text-sm leading-5 transition-colors duration-300',
                    isDone && 'font-medium text-foreground/75',
                    isCurrent && 'font-semibold text-foreground',
                    !isDone && !isCurrent && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </p>
                {isCurrent && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                    style={{ backgroundColor: ACCENT, color: INK }}
                  >
                    Now
                  </span>
                )}
              </div>
              {highlight && (isDone || isCurrent) && (
                <p className="mt-1 break-words text-xs leading-4 text-muted-foreground">{highlight}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
