import { useMemo, useState } from 'react';
import { DollarSign, Leaf, Scale, Utensils, Settings2 } from 'lucide-react';
import { PageShell } from '@/components/Sidebar';
import { Badge, Button, Card, CardHeader, Field, StatCard, inputClass } from '@/components/ui';
import { useAppState } from '@/state/AppStateContext';
import { computeImpact } from '@/model/engine';
import { BASELINE_METHOD } from '@/data/demoData';

function money(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `$${n.toFixed(2)}`;
}

export function ImpactPage() {
  const { forecast, config, env, setEnv } = useAppState();
  const [daysModelled, setDaysModelled] = useState(20);
  const [envDraft, setEnvDraft] = useState(env);
  const [envSaved, setEnvSaved] = useState(false);

  const impact = useMemo(
    () => computeImpact(forecast, config, env, daysModelled),
    [forecast, config, env, daysModelled],
  );

  const saveEnv = () => {
    setEnv(envDraft);
    setEnvSaved(true);
    setTimeout(() => setEnvSaved(false), 2500);
  };

  const ppCheaper = impact.costDifference >= 0;
  const costDiff = impact.costDifference;

  return (
    <PageShell
      eyebrow="Outcomes"
      title="Impact"
      description="Modelled impact of the PlatePilot recommendation against a clearly defined baseline policy. These are modelled estimates, not results from a real-world field trial."
      actions={<Badge tone="warning">Modelled estimates</Badge>}
    >
      {/* Baseline definition */}
      <Card className="mb-6">
        <CardHeader
          eyebrow="Baseline"
          title="What is being compared"
          description="The baseline policy is explicitly defined so the comparison is honest."
        />
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg bg-primary-950/40 p-3">
            <p className="label-eyebrow mb-1">Baseline policy</p>
            <p className="text-neutral2-200">{BASELINE_METHOD}</p>
          </div>
          <div className="rounded-lg bg-primary-950/40 p-3">
            <p className="label-eyebrow mb-1">PlatePilot policy</p>
            <p className="text-neutral2-200">
              Cost-optimised preparation from the uncertainty-aware model
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <label className="text-sm text-neutral2-300">Days modelled</label>
          <input
            type="number"
            min={1}
            max={365}
            value={daysModelled}
            onChange={(e) => {
              const n = Number(e.target.value);
              setDaysModelled(Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 365) : 1);
            }}
            className={`${inputClass} h-9 w-24`}
          />
          <span className="text-xs text-neutral2-500">Both policies use the same demand model over this horizon.</span>
        </div>
      </Card>

      {/* Core stat cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="PlatePilot net waste"
          value={impact.platePilotNetWaste.toLocaleString()}
          unit="meals"
          icon={<Scale className="h-4 w-4" />}
          hint={`Baseline: ${impact.baselineNetWaste.toLocaleString()} meals`}
        />
        <StatCard
          label="Cost difference"
          value={money(Math.abs(costDiff))}
          icon={<DollarSign className="h-4 w-4" />}
          hint={
            costDiff === 0
              ? 'No difference vs. baseline.'
              : ppCheaper
                ? `PlatePilot cheaper by ${money(costDiff)} (modelled).`
                : `PlatePilot more expensive by ${money(-costDiff)} (modelled).`
          }
          delta={
            costDiff === 0
              ? undefined
              : { value: ppCheaper ? 'cheaper' : 'costlier', positive: ppCheaper }
          }
        />
        <StatCard
          label="Meals served (PlatePilot)"
          value={impact.platePilotMealsServed.toLocaleString()}
          unit="meals"
          icon={<Utensils className="h-4 w-4" />}
          hint={`Baseline: ${impact.baselineMealsServed.toLocaleString()} meals`}
        />
        <StatCard
          label="Surplus (PlatePilot)"
          value={impact.platePilotSurplus.toLocaleString()}
          unit="meals"
          icon={<Scale className="h-4 w-4" />}
          hint={`Baseline surplus: ${impact.baselineSurplus.toLocaleString()} meals`}
        />
      </div>

      {/* Honest cost summary */}
      <Card raised className="mt-6">
        <CardHeader
          eyebrow="Cost"
          title="Modelled cost comparison"
          description="Signed difference. A negative value means PlatePilot costs more — reported honestly, not converted into a saving."
          action={<Badge tone="neutral">Modelled</Badge>}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <CostBlock label="PlatePilot cost" value={money(impact.platePilotCost)} />
          <CostBlock label="Baseline cost" value={money(impact.baselineCost)} />
          <CostBlock
            label="Difference (baseline − PlatePilot)"
            value={`${costDiff >= 0 ? '+' : ''}${money(costDiff)}`}
            tone={costDiff >= 0 ? 'good' : 'bad'}
          />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-neutral2-500">
          This is an estimated cost difference under the stated demand model and cost
          assumptions, not a measured saving. {ppCheaper ? 'A positive value indicates PlatePilot is modelled as cheaper.' : 'A negative value indicates PlatePilot is modelled as more expensive under current costs.'}
        </p>
      </Card>

      {/* Environmental — only shown when configured */}
      <Card raised className="mt-6">
        <CardHeader
          eyebrow="Environmental"
          title="Environmental impact"
          description="CO₂e and water savings are only shown when conversion factors are configured and traceable. Unconfigured factors are reported as unavailable."
          action={
            impact.environmentalConfigured ? (
              <Badge tone="accent">Configured</Badge>
            ) : (
              <Badge tone="neutral">Unconfigured</Badge>
            )
          }
        />
        {impact.environmentalConfigured ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {env.co2PerMeal > 0 && (
              <CostBlock
                label="CO₂e avoided"
                value={`${impact.co2AvoidedKg.toLocaleString()} kg`}
                tone="good"
              />
            )}
            {env.waterPerMeal > 0 && (
              <CostBlock
                label="Water avoided"
                value={`${impact.waterAvoidedL.toLocaleString()} L`}
                tone="good"
              />
            )}
            {env.kgPerMeal > 0 && (
              <CostBlock
                label="Food waste avoided"
                value={`${impact.foodWasteAvoidedKg.toLocaleString()} kg`}
                tone="good"
              />
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-primary-800/70 bg-primary-950/30 p-4 text-sm text-neutral2-500">
            Environmental conversion factors are not configured. To display CO₂e and water
            estimates, set the per-meal factors below. PlatePilot does not invent default
            environmental coefficients.
          </div>
        )}

        {/* Factor configuration */}
        <div className="mt-5 border-t border-primary-800/60 pt-4">
          <p className="label-eyebrow mb-3 flex items-center gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Conversion factors
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="kg CO₂e per wasted meal" hint="0 = unconfigured">
              <input
                type="number"
                min={0}
                step={0.01}
                className={inputClass}
                value={envDraft.co2PerMeal || ''}
                placeholder="0.00"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setEnvDraft((d) => ({
                    ...d,
                    co2PerMeal: Number.isFinite(n) && n >= 0 ? n : 0,
                  }));
                  setEnvSaved(false);
                }}
              />
            </Field>
            <Field label="litres water per wasted meal" hint="0 = unconfigured">
              <input
                type="number"
                min={0}
                step={1}
                className={inputClass}
                value={envDraft.waterPerMeal || ''}
                placeholder="0"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setEnvDraft((d) => ({
                    ...d,
                    waterPerMeal: Number.isFinite(n) && n >= 0 ? n : 0,
                  }));
                  setEnvSaved(false);
                }}
              />
            </Field>
            <Field label="kg food per wasted meal" hint="0 = unconfigured">
              <input
                type="number"
                min={0}
                step={0.01}
                className={inputClass}
                value={envDraft.kgPerMeal || ''}
                placeholder="0.00"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setEnvDraft((d) => ({
                    ...d,
                    kgPerMeal: Number.isFinite(n) && n >= 0 ? n : 0,
                  }));
                  setEnvSaved(false);
                }}
              />
            </Field>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button size="sm" onClick={saveEnv} disabled={JSON.stringify(envDraft) === JSON.stringify(env)}>
              <Leaf className="h-4 w-4" />
              Save factors
            </Button>
            {envSaved && <span className="text-sm text-success-400">Saved</span>}
          </div>
          <p className="mt-3 text-2xs leading-relaxed text-neutral2-600">
            Factors must be sourced from your own data or a cited reference. PlatePilot does
            not bundle default environmental coefficients.
          </p>
        </div>
      </Card>
    </PageShell>
  );
}

function CostBlock({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'bad';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-success-400'
      : tone === 'bad'
        ? 'text-error-400'
        : 'text-white';
  return (
    <div className="rounded-lg bg-primary-950/40 p-4">
      <p className="label-eyebrow mb-1.5">{label}</p>
      <p className={`font-display text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}
