import { useMemo, useState } from 'react';
import { RotateCcw, Scale } from 'lucide-react';
import type { CounterfactualInputs, PlanComparison } from '@/types';
import { PageShell } from '@/components/Sidebar';
import { Badge, Button, Card, CardHeader, Slider } from '@/components/ui';
import { useAppState } from '@/state/AppStateContext';
import { DEMO_COUNTERFACTUAL_DEFAULTS } from '@/data/demoData';
import {
  counterfactualForecast,
  comparePlans,
  forecast as runForecast,
} from '@/model/engine';
import { cn } from '@/lib/cn';

const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;

function fmt(value: number, unit: string): string {
  if (unit === '$') return `$${value.toFixed(2)}`;
  if (unit === '') return `${(value * 100).toFixed(1)}%`;
  return `${Math.round(value)}${unit ? ` ${unit}` : ''}`;
}

export function CounterfactualPage() {
  const { config, observations } = useAppState();
  const [inputs, setInputs] = useState<CounterfactualInputs>(
    DEMO_COUNTERFACTUAL_DEFAULTS,
  );

  const reset = () => setInputs(DEMO_COUNTERFACTUAL_DEFAULTS);
  const set = <K extends keyof CounterfactualInputs>(
    k: K,
    v: CounterfactualInputs[K],
  ) => setInputs((s) => ({ ...s, [k]: v }));

  // Recompute the baseline fresh from config/observations so it is always
  // stable and never mutated by slider changes.
  const stableBaseline = useMemo(
    () => runForecast({ config, observations }),
    [config, observations],
  );

  // Scenario forecast — pure function of baseline + slider inputs.
  const scenario = useMemo(
    () =>
      counterfactualForecast(stableBaseline, { config, observations }, inputs),
    [stableBaseline, config, observations, inputs],
  );

  const rows: PlanComparison[] = useMemo(
    () => comparePlans(stableBaseline, scenario, inputs.donationCapacity),
    [stableBaseline, scenario, inputs.donationCapacity],
  );

  const isDefault =
    JSON.stringify(inputs) === JSON.stringify(DEMO_COUNTERFACTUAL_DEFAULTS);

  return (
    <PageShell
      eyebrow="Laboratory"
      title="Counterfactual Lab"
      description="Adjust the levers that influence demand and compare the current plan against a scenario plan. Every change recalculates immediately; the baseline is never modified."
      actions={
        <>
          <Badge tone={isDefault ? 'neutral' : 'accent'}>
            {isDefault ? 'Baseline' : 'Scenario active'}
          </Badge>
          <Button size="sm" variant="ghost" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* controls */}
        <Card raised>
          <CardHeader
            eyebrow="Levers"
            title="Scenario controls"
            description="Slide to model a what-if scenario."
          />
          <div className="space-y-6">
            <Slider
              label="Attendance change"
              value={inputs.attendanceChange}
              min={-0.3}
              max={0.3}
              step={0.01}
              format={pct}
              onChange={(v) => set('attendanceChange', v)}
              hint="Relative change to expected attendance."
            />
            <Slider
              label="Menu popularity change"
              value={inputs.menuPopularityChange}
              min={-0.3}
              max={0.3}
              step={0.01}
              format={pct}
              onChange={(v) => set('menuPopularityChange', v)}
              hint="Relative change to participation rate."
            />
            <Slider
              label="Portion-size change"
              value={inputs.portionSizeChange}
              min={-0.2}
              max={0.2}
              step={0.01}
              format={pct}
              onChange={(v) => set('portionSizeChange', v)}
              hint="Larger portions reduce meals needed per student."
            />
            <Slider
              label="Donation capacity"
              value={inputs.donationCapacity}
              min={0}
              max={120}
              step={5}
              format={(v) => `${v} meals`}
              onChange={(v) => set('donationCapacity', v)}
              hint="Meals that can be donated rather than wasted."
            />
          </div>
        </Card>

        {/* comparison */}
        <div className="space-y-5">
          <Card raised>
            <CardHeader
              eyebrow="Side by side"
              title="Current plan vs. scenario plan"
              description="Baseline is computed from your saved configuration and is not affected by the sliders."
              action={<Badge tone="neutral">Modelled</Badge>}
            />
            <div className="overflow-x-auto rounded-xl border border-primary-800/70">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="bg-primary-950/60 text-left text-2xs uppercase tracking-wider text-neutral2-500">
                    <th className="px-4 py-3 font-semibold">Metric</th>
                    <th className="px-4 py-3 text-right font-semibold">Current</th>
                    <th className="px-4 py-3 text-right font-semibold">Scenario</th>
                    <th className="px-4 py-3 text-right font-semibold">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-800/60">
                  {rows.map((row) => {
                    const delta = row.scenario - row.current;
                    const better = row.lowerIsBetter ? delta < 0 : delta > 0;
                    const isZero = Math.abs(delta) < 1e-9;
                    return (
                      <tr
                        key={row.metric}
                        className="transition-colors hover:bg-primary-800/20"
                      >
                        <td className="px-4 py-3 text-neutral2-300">{row.metric}</td>
                        <td className="px-4 py-3 text-right font-medium text-neutral2-200 tabular-nums">
                          {fmt(row.current, row.unit)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">
                          {fmt(row.scenario, row.unit)}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-3 text-right font-medium tabular-nums',
                            isZero
                              ? 'text-neutral2-600'
                              : better
                                ? 'text-success-400'
                                : 'text-error-400',
                          )}
                        >
                          {isZero
                            ? '—'
                            : `${delta > 0 ? '+' : ''}${row.unit === '$' ? `$${delta.toFixed(2)}` : row.unit === '' ? `${(delta * 100).toFixed(1)}%` : `${Math.round(delta)}`}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Interpretation"
              title="What changed"
              description="Plain-language summary of the scenario."
            />
            <p className="text-sm leading-relaxed text-neutral2-300">
              {isDefault ? (
                <>Sliders are at baseline. Move a control to see how the scenario plan diverges.</>
              ) : (
                <>
                  The scenario expects{' '}
                  <span className="font-semibold text-white">{scenario.predictedMeals} meals</span>{' '}
                  of demand (baseline {stableBaseline.predictedMeals}), recommends preparing{' '}
                  <span className="font-semibold text-white">{scenario.recommendedPreparation} meals</span>{' '}
                  (baseline {stableBaseline.recommendedPreparation}), and leaves an estimated{' '}
                  <span className="font-semibold text-white">
                    {Math.max(0, scenario.expectedLeftover - inputs.donationCapacity)} meals
                  </span>{' '}
                  of net waste after donation.
                </>
              )}
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-neutral2-500">
              <Scale className="h-3.5 w-3.5" />
              Portion-size changes affect servings needed, not the number of students. Donation
              capacity diverts surplus from disposal, not student demand.
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
