import { ArrowRight, BarChart3, FlaskConical, RefreshCw, Utensils } from 'lucide-react';
import type { RouteId } from '@/types';
import { Badge, Button } from '@/components/ui';
import { Brand } from '@/components/Sidebar';
import { routeHref } from '@/router';

const FEATURES = [
  {
    icon: BarChart3,
    title: 'Forecast',
    body: 'Uncertainty-aware prediction of tomorrow\u2019s meal demand from attendance, menu and historical patterns.',
  },
  {
    icon: FlaskConical,
    title: 'Counterfactual Simulation',
    body: 'Slide attendance, popularity, portion size and donation capacity to compare scenarios side by side.',
  },
  {
    icon: RefreshCw,
    title: 'Learning Loop',
    body: 'Each service records predicted vs. actual demand so the recommendation keeps improving over time.',
  },
];

export function LandingPage({ navigate }: { navigate: (to: RouteId) => void }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ambient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-grid-faint bg-[size:48px_48px] opacity-[0.5]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-accent-500/10 blur-[120px]"
      />

      <div className="relative">
        {/* top bar */}
        <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
          <Brand />
          <a
            href={routeHref('setup')}
            className="text-sm font-medium text-neutral2-300 transition-colors hover:text-white"
          >
            Open workspace
          </a>
        </header>

        {/* hero */}
        <section className="mx-auto max-w-4xl px-5 pt-16 text-center sm:px-8 sm:pt-24">
          <Badge tone="accent" className="mb-6 animate-fade-in">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
            School cafeteria food-waste prevention
          </Badge>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tightest text-white sm:text-7xl animate-fade-up">
            PlatePilot
          </h1>
          <p className="mt-4 font-display text-xl font-medium tracking-tight text-accent-300 sm:text-2xl animate-fade-up">
            Predict before you prepare.
          </p>

          <div className="mx-auto mt-10 max-w-2xl animate-fade-up">
            <p className="text-base leading-relaxed text-neutral2-300 sm:text-lg">
              School cafeterias must prepare enough food to meet demand, but
              uncertainty can lead to unnecessary overproduction. PlatePilot
              uses historical patterns, attendance, menu information and
              uncertainty-aware optimisation to recommend preparation
              quantities before food is prepared.
            </p>
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-up">
            <Button
              size="lg"
              onClick={() => navigate('setup')}
              className="group"
            >
              Launch Demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <a
              href={routeHref('forecast')}
              className="text-sm font-medium text-neutral2-300 transition-colors hover:text-white"
            >
              See the forecast
            </a>
          </div>
        </section>

        {/* feature cards */}
        <section className="mx-auto mt-24 max-w-6xl px-5 pb-24 sm:px-8">
          <div className="grid gap-5 sm:grid-cols-3">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <article
                  key={f.title}
                  className="surface-raised group p-6 transition-transform duration-200 hover:-translate-y-0.5 animate-fade-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-800/80 text-accent-300 transition-colors group-hover:bg-accent-500 group-hover:text-primary-950">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold tracking-tight text-white">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral2-400">
                    {f.body}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="mt-16 flex items-center justify-center gap-2 text-2xs text-neutral2-600">
            <Utensils className="h-3.5 w-3.5" />
            Prototype · modelled estimates, not a field trial
          </div>
        </section>
      </div>
    </div>
  );
}
