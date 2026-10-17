import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Function that formats the displayed value. */
  format?: (v: number) => string;
  hint?: ReactNode;
  onChange: (v: number) => void;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  format = (v) => `${v}`,
  hint,
  onChange,
}: SliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-neutral2-200">{label}</label>
        <span className="font-mono text-sm font-medium tabular-nums text-accent-300">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      {hint && <p className="text-2xs text-neutral2-500">{hint}</p>}
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, children, className }: FieldProps) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-sm font-medium text-neutral2-200">{label}</span>
      {children}
      {hint && <span className="block text-2xs text-neutral2-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'h-10 w-full rounded-xl border border-primary-800/80 bg-primary-950/60 px-3 text-sm text-white placeholder:text-neutral2-500 focus-ring transition-colors hover:border-primary-700';
