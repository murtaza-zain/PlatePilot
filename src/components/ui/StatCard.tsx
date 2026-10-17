import type { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge } from './Badge';

interface StatCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  delta?: { value: string; positive?: boolean };
  demo?: boolean;
  icon?: ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  unit,
  hint,
  delta,
  demo = false,
  icon,
  className,
}: StatCardProps) {
  return (
    <div className={cn('surface p-5 flex flex-col gap-3', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-800/70 text-accent-300">
              {icon}
            </span>
          )}
          <span className="label-eyebrow">{label}</span>
        </div>
        {demo && <Badge tone="neutral">Demo</Badge>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-semibold tracking-tight text-white tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium text-neutral2-400">{unit}</span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        {hint ? (
          <span className="text-xs leading-relaxed text-neutral2-500">{hint}</span>
        ) : (
          <span />
        )}
        {delta && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-semibold tabular-nums',
              delta.positive ? 'text-success-400' : 'text-error-400',
            )}
          >
            {delta.positive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {delta.value}
          </span>
        )}
      </div>
    </div>
  );
}
