import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps {
  children: ReactNode;
  className?: string;
  raised?: boolean;
}

export function Card({ children, className, raised = false }: CardProps) {
  return (
    <div
      className={cn(
        raised ? 'surface-raised' : 'surface',
        'p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="label-eyebrow mb-1.5">{eyebrow}</p>}
        <h3 className="font-display text-lg font-semibold tracking-tight text-white">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-neutral2-400">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
