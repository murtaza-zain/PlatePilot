import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'accent' | 'warning' | 'error' | 'success';

const TONES: Record<Tone, string> = {
  neutral: 'bg-primary-800/70 text-neutral2-300 border-primary-700/70',
  accent: 'bg-accent-500/15 text-accent-300 border-accent-500/30',
  warning: 'bg-warning-500/15 text-warning-300 border-warning-500/30',
  error: 'bg-error-500/15 text-error-300 border-error-500/30',
  success: 'bg-success-500/15 text-success-300 border-success-500/30',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wider',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
