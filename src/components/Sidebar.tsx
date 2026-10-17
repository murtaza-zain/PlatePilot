import type { ReactNode } from 'react';
import {
  Calculator,
  FlaskConical,
  History,
  Home,
  LineChart,
  Scale,
  Sparkles,
  Utensils,
} from 'lucide-react';
import type { RouteId } from '@/types';
import { cn } from '@/lib/cn';
import { routeHref } from '@/router';

interface NavItem {
  id: RouteId;
  label: string;
  icon: typeof Home;
  group: 'top' | 'labs' | 'results';
}

const NAV: NavItem[] = [
  { id: 'landing', label: 'Overview', icon: Home, group: 'top' },
  { id: 'setup', label: 'Setup', icon: Utensils, group: 'top' },
  { id: 'forecast', label: 'Forecast', icon: LineChart, group: 'top' },
  { id: 'counterfactual', label: 'Counterfactual Lab', icon: Scale, group: 'labs' },
  { id: 'validation', label: 'Validation Lab', icon: FlaskConical, group: 'labs' },
  { id: 'impact', label: 'Impact', icon: Sparkles, group: 'results' },
  { id: 'history', label: 'History', icon: History, group: 'results' },
];

const GROUP_LABELS: Record<NavItem['group'], string> = {
  top: 'Workspace',
  labs: 'Laboratories',
  results: 'Outcomes',
};

export function Sidebar({
  route,
  onNavigate,
}: {
  route: RouteId;
  onNavigate?: () => void;
}) {
  const groups: NavItem['group'][] = ['top', 'labs', 'results'];
  return (
    <nav className="flex h-full flex-col gap-6 p-4">
      <Brand />
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
        {groups.map((g) => (
          <div key={g} className="space-y-1.5">
            <p className="px-3 label-eyebrow">{GROUP_LABELS[g]}</p>
            {NAV.filter((n) => n.group === g).map((item) => {
              const Icon = item.icon;
              const active = route === item.id;
              return (
                <a
                  key={item.id}
                  href={routeHref(item.id)}
                  onClick={onNavigate}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary-800/80 text-white shadow-subtle'
                      : 'text-neutral2-400 hover:bg-primary-800/40 hover:text-neutral2-100',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      active
                        ? 'text-accent-400'
                        : 'text-neutral2-500 group-hover:text-neutral2-300',
                    )}
                  />
                  {item.label}
                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-400" />
                  )}
                </a>
              );
            })}
          </div>
        ))}
      </div>
      <div className="surface px-3 py-3 text-2xs leading-relaxed text-neutral2-500">
        <p className="flex items-center gap-1.5 text-neutral2-400">
          <Calculator className="h-3.5 w-3.5 text-accent-400" />
          Phase 2 · Uncertainty-aware model
        </p>
        <p className="mt-1">
          Demand estimation & cost-sensitive optimisation. Not a trained ML model.
        </p>
      </div>
    </nav>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a href={routeHref('landing')} className="flex items-center gap-2.5 px-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-primary-950 shadow-lift">
        <Utensils className="h-4.5 w-4.5" strokeWidth={2.5} />
      </span>
      {!compact && (
        <div className="leading-tight">
          <p className="font-display text-base font-semibold tracking-tight text-white">
            PlatePilot
          </p>
          <p className="text-2xs text-neutral2-500">Predict before you prepare</p>
        </div>
      )}
    </a>
  );
}

export function PageShell({
  title,
  eyebrow,
  description,
  actions,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10 animate-fade-up">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="label-eyebrow mb-2">{eyebrow}</p>}
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral2-400">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}
