import { useState } from 'react';
import { AlertTriangle, FlaskConical, Info, Play, RotateCcw } from 'lucide-react';
import type { SimulationResult } from '@/types';
import { PageShell } from '@/components/Sidebar';
import { Badge, Button, Card, CardHeader, EmptyState, Field, inputClass } from '@/components/ui';
import { useAppState } from '@/state/AppStateContext';
import {
  runSimulation,
  DEFAULT_SIMULATION,
  type SimulationConfig,
} from '@/model/simulation';
import { BASELINE_METHOD } from '@/data/demoData';

function money(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `$${n.toFixed(2)}`;
}

export function ValidationPage() {
  const { config, observations } = useAppState();
  const [simConfig, setSimConfig] = useState<SimulationConfig>(DEFAULT_SIMULATION);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);

  // Run synchronously inside a setTimeout so the UI can show a "running"
  // state without blocking paint. 1000 trials is fast (<50ms).
  const run = () => {
    setRunning(true);
    setTimeout(() => {
      const r = runSimulation(config, observations, simConfig);
      setResult(r);
      setRunning(false);
    }, 30);
  };

  const reset = () => {
    setSimConfig(DEFAULT_SIMULATION);
    setResult(null);
  };

  const observed = result?.observed ?? null;

  return (
    <PageShell
      eyebrow="Laboratory"
      title="Validation Lab"
      description="Compare a fixed-buffer baseline against the PlatePilot cost-optimised policy using a deterministic Monte Carlo simulation. Simulated results are kept separate from real observations."
      actions={
        <>
          <Button size="sm" variant="ghost" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button size="sm" onClick={run} disabled={running} className="group">
            <Play className="h-4 w-4" />
            {running ? 'Running…' : result ? 'Re-run simulation' : 'Run simulation'}
          </Button>
        </>
      }
    >
      {/* Mandatory disclaimer */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning-500/25 bg-warning-500/10 p-4 text-sm leading-relaxed text-warning-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        These results are model-based simulations under stated assumptions. They are not
        evidence of measured real-world food-waste reduction or cafeteria savings.
      </div>

      {/* Method cards */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card raised>
          <CardHeader
            eyebrow="Reference"
            title="Baseline method"
            description="The simple heuristic PlatePilot is measured against."
          />
          <div className="rounded-xl bg-primary-950/50 p-4">
            <p className="text-sm text-neutral2-300">{BASELINE_METHOD}</p>
          </div>
        </Card>

        <Card raised>
          <CardHeader
            eyebrow="Candidate"
            title="PlatePilot method"
            description="Uncertainty-aware optimisation across the cost model."
          />
          <div className="rounded-xl bg-primary-950/50 p-4">
            <p className="text-sm text-neutral2-300">
              Historical patterns + attendance + menu signals, optimised against configured
              excess and shortage costs.
            </p>
          </div>
        </Card>
      </div>

      {/* Simulation configuration */}
      <Card raised className="mt-6">
        <CardHeader
          eyebrow="Configuration"
          title="Simulation settings"
          description="Same seed + same config = identical results (deterministic)."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Random seed" hint="Integer. Same seed reproduces results.">
            <input
              type="number"
              min={1}
              className={inputClass}
              value={simConfig.seed}
              onChange={(e) => {
                const n = Math.floor(Number(e.target.value));
                setSimConfig((s) => ({ ...s, seed: Number.isFinite(n) && n > 0 ? n : 1 }));
              }}
            />
          </Field>
          <Field label="Trials" hint="Number of simulated days. Default 1000.">
            <input
              type="number"
              min={10}
              max={50000}
              className={inputClass}
              value={simConfig.trials}
              onChange={(e) => {
                const n = Math.floor(Number(e.target.value));
                setSimConfig((s) => ({
                  ...s,
                  trials: Number.isFinite(n) && n >= 10 ? Math.min(n, 50000) : 10,
                }));
              }}
            />
          </Field>
          <Field label="Baseline buffer" hint="Fraction above expected demand. Default 0.10.">
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              className={inputClass}
              value={simConfig.baselineBuffer}
              onChange={(e) => {
                const n = Number(e.target.value);
                setSimConfig((s) => ({
                  ...s,
                  baselineBuffer: Number.isFinite(n) && n >= 0 ? Math.min(n, 1) : 0,
                }));
              }}
            />
          </Field>
        </div>
      </Card>

      {/* Simulation results */}
      <Card raised className="mt-6">
        <CardHeader
          eyebrow="Results"
          title="Policy comparison"
          description={
            result
              ? `${result.trials.toLocaleString()} trials · seed ${result.seed} · identical demand draws for both policies.`
              : 'Run the simulation to see results.'
          }
          action={
            result ? (
              <Badge tone="accent">Simulated</Badge>
            ) : (
              <Badge tone="neutral">Not run</Badge>
            )
          }
        />
        {result ? (
          <>
            <div className="overflow-x-auto rounded-xl border border-primary-800/70">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="bg-primary-950/60 text-left text-2xs uppercase tracking-wider text-neutral2-500">
                    <th className="px-4 py-3 font-semibold">Metric</th>
                    <th className="px-4 py-3 text-right font-semibold">Baseline</th>
                    <th className="px-4 py-3 text-right font-semibold">PlatePilot</th>
                    <th className="px-4 py-3 text-right font-semibold">Difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-800/60">
                  <SimRow
                    label="Avg excess servings"
                    unit="meals/day"
                    baseline={result.baseline.avgExcess}
                    pp={result.platePilot.avgExcess}
                    lowerIsBetter
                  />
                  <SimRow
                    label="Avg unmet demand"
                    unit="meals/day"
                    baseline={result.baseline.avgUnmet}
                    pp={result.platePilot.avgUnmet}
                    lowerIsBetter
                  />
                  <SimRow
                    label="Shortage frequency"
                    unit="%"
                    baseline={result.baseline.shortageFrequency * 100}
                    pp={result.platePilot.shortageFrequency * 100}
                    lowerIsBetter
                  />
                  <SimRow
                    label="Avg cost"
                    unit="$/day"
                    baseline={result.baseline.avgCost}
                    pp={result.platePilot.avgCost}
                    lowerIsBetter
                  />
                  <SimRow
                    label="Total cost"
                    unit="$"
                    baseline={result.baseline.totalCost}
                    pp={result.platePilot.totalCost}
                    lowerIsBetter
                  />
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-primary-950/40 p-4">
                <p className="label-eyebrow mb-1">Modelled cost difference</p>
                <p
                  className={`font-display text-lg font-semibold tabular-nums ${
                    result.costDifference >= 0 ? 'text-success-400' : 'text-error-400'
                  }`}
                >
                  {result.costDifference >= 0 ? '+' : ''}
                  {money(result.costDifference)}
                </p>
                <p className="mt-1 text-xs text-neutral2-500">
                  {result.costDifference >= 0
                    ? 'PlatePilot is modelled as cheaper over the simulated horizon.'
                    : 'PlatePilot is modelled as more expensive under current costs.'}
                </p>
              </div>
              <div className="rounded-lg bg-primary-950/40 p-4">
                <p className="label-eyebrow mb-1">Modelled waste difference</p>
                <p
                  className={`font-display text-lg font-semibold tabular-nums ${
                    result.wasteDifference >= 0 ? 'text-success-400' : 'text-error-400'
                  }`}
                >
                  {result.wasteDifference >= 0 ? '+' : ''}
                  {Math.round(result.wasteDifference)} meals
                </p>
                <p className="mt-1 text-xs text-neutral2-500">
                  {result.wasteDifference >= 0
                    ? 'PlatePilot produces less excess over the horizon.'
                    : 'PlatePilot produces more excess under current costs.'}
                </p>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            icon={<FlaskConical className="h-6 w-6" />}
            title="No simulation run yet"
            description="Press Run simulation to compare the two policies. Results are deterministic for a given seed and configuration."
            action={
              <Button size="sm" onClick={run} disabled={running}>
                <Play className="h-4 w-4" />
                {running ? 'Running…' : 'Run simulation'}
              </Button>
            }
          />
        )}
      </Card>

      {/* Observed real-world validation — kept visually separate */}
      <Card raised className="mt-6 border-l-2 border-l-accent-500/40">
        <CardHeader
          eyebrow="Real-world evidence"
          title="Observed validation"
          description="Computed only from genuine saved predictions with compatible actual observations. This is separate from the simulation above."
          action={observed ? <Badge tone="accent">Observed</Badge> : <Badge tone="neutral">Unavailable</Badge>}
        />
        {observed ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <ObservedBlock label="Completed plans" value={String(observed.completedPlans)} />
            <ObservedBlock label="MAE (meals)" value={observed.mae.toFixed(1)} />
            <ObservedBlock
              label="Bias (meals)"
              value={`${observed.bias >= 0 ? '+' : ''}${observed.bias.toFixed(1)}`}
            />
          </div>
        ) : (
          <EmptyState
            title="Real-world validation unavailable"
            description="Save forecast plans and enter actual demand in the History page. Once at least three completed observations exist, observed error metrics will appear here."
          />
        )}
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-primary-950/40 p-3 text-xs leading-relaxed text-neutral2-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-400" />
          Observed metrics reflect actual saved outcomes, not the simulated policy comparison.
          They are distinct from the Monte Carlo results above.
        </div>
      </Card>
    </PageShell>
  );
}

function SimRow({
  label,
  unit,
  baseline,
  pp,
  lowerIsBetter,
}: {
  label: string;
  unit: string;
  baseline: number;
  pp: number;
  lowerIsBetter: boolean;
}) {
  const diff = pp - baseline;
  const better = lowerIsBetter ? diff < 0 : diff > 0;
  const isZero = Math.abs(diff) < 1e-9;
  const fmt = (v: number) => {
    if (unit === '$' || unit === '$/day') return money(v);
    if (unit === '%') return `${v.toFixed(1)}%`;
    return `${v.toFixed(1)} ${unit}`;
  };
  return (
    <tr className="transition-colors hover:bg-primary-800/20">
      <td className="px-4 py-3 text-neutral2-300">{label}</td>
      <td className="px-4 py-3 text-right font-medium text-neutral2-200 tabular-nums">{fmt(baseline)}</td>
      <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">{fmt(pp)}</td>
      <td
        className={`px-4 py-3 text-right font-medium tabular-nums ${
          isZero ? 'text-neutral2-600' : better ? 'text-success-400' : 'text-error-400'
        }`}
      >
        {isZero ? '—' : `${diff > 0 ? '+' : ''}${fmt(diff)}`}
      </td>
    </tr>
  );
}

function ObservedBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-primary-950/40 p-4">
      <p className="label-eyebrow mb-1">{label}</p>
      <p className="font-display text-lg font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}
