'use client';

// A shared, plain-English journey for both the public consultation and the
// operator view. It intentionally shows progress and short highlights only.
import { Check } from 'lucide-react';
import { PROGRESS_STEPS } from '@/lib/loan/progress';
import { cn } from '@/lib/utils';

export default function ProgressChecklist({ progress, className }) {
  const currentIndex = progress?.currentStepIndex ?? -1;
  const completed = new Set(progress?.completedStepIds || []);
  const highlights = progress?.highlights || {};

  return (
    <ol className={cn('relative', className)} aria-label="Consultation progress">
      {PROGRESS_STEPS.map((step, index) => {
        const isDone = completed.has(step.id) || index < currentIndex;
        const isCurrent = index === currentIndex && !isDone;
        const highlight = highlights[step.id];
        const isLast = index === PROGRESS_STEPS.length - 1;

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
                  isDone ? 'bg-blue-600/40' : 'bg-border'
                )}
                aria-hidden="true"
              />
            )}

            <span className="relative z-10 mt-2.5 grid size-7 shrink-0 place-items-center">
              {isDone ? (
                <span className="grid size-6 place-items-center rounded-full bg-blue-700 text-white shadow-sm">
                  <Check className="size-3.5 stroke-[2.5]" aria-hidden="true" />
                </span>
              ) : isCurrent ? (
                <span className="grid size-6 place-items-center rounded-full border border-blue-600/30 bg-blue-600/10 ring-4 ring-blue-600/[0.07]">
                  <span className="size-2 rounded-full bg-blue-700 motion-safe:animate-pulse" aria-hidden="true" />
                </span>
              ) : (
                <span className="grid size-6 place-items-center rounded-full border border-border bg-card text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
              )}
            </span>

            <div
              className={cn(
                'min-w-0 rounded-xl px-3 py-2.5 transition-[background-color,color] duration-300',
                isCurrent && 'bg-blue-600/[0.07]'
              )}
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
                  <span className="shrink-0 rounded-full bg-blue-700 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white">
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
