import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary-800/70 bg-primary-900/30 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary-800/60 text-neutral2-400">
        {icon ?? <Inbox className="h-6 w-6" />}
      </span>
      <div>
        <p className="font-display text-sm font-semibold text-neutral2-200">
          {title}
        </p>
        {description && (
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-neutral2-500">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
