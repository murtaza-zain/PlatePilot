import { useState } from 'react';
import {
  AlertTriangle,
  GitBranch,
  Hash,
  Layers,
  Save,
  Scale,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { PageShell } from '@/components/Sidebar';
import { Badge, Button, Card, CardHeader, DemandChart, StatCard } from '@/components/ui';
import { useAppState } from '@/state/AppStateContext';
import { routeHref } from '@/router';

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function ForecastPage() {
  const { forecast: f, config, saveCurrentPlan } = useAppState();
  const assumptions = f.assumptions;
  const [saved, setSaved] = useState(false);

  const riskPct = Math.round(f.shortageRisk * 100);
  const riskTone =
    f.shortageRisk < 0.1 ? 'low' : f.shortageRisk < 0.2 ? 'moderate' : 'elevated';

  const save = () => {
    saveCurrentPlan();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const diff = f.recommendedPreparation - f.predictedMeals;
  const basisLabel =
    f.uncertaintyBasis === 'historical'
      ? `Historical · ${assumptions.usableObservations} obs`
      : f.uncertaintyBasis === 'fallback'
        ? 'Fallback assumption'
        : 'Insufficient data';

  return (
    <PageShell
      eyebrow="Step 2"
      title="Forecast"
      description="Tomorrow's expected demand and the preparation quantity PlatePilot recommends, computed live from your setup values and available observations."
      actions={
        <Badge tone={f.uncertaintyBasis === 'historical' ? 'accent' : 'warning'}>
          {basisLabel}
        </Badge>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Expected attendance"
          value={f.expectedAttendance}
          unit="students"
          icon={<Users className="h-4 w-4" />}
          hint="From configured average attendance."
        />
        <StatCard
          label="Predicted meals"
          value={f.predictedMeals}
          unit="meals"
          icon={<Hash className="h-4 w-4" />}
          hint={`Participation rate ${(assumptions.estimatedParticipationRate * 100).toFixed(0)}%.`}
        />
        <StatCard
          label="Recommended preparation"
          value={f.recommendedPreparation}
          unit="meals"
          icon={<Layers className="h-4 w-4" />}
          delta={{
            value: `${diff > 0 ? '+' : ''}${diff} vs. predicted`,
            positive: diff >= 0,
          }}
          hint="Cost-optimised against excess & shortage costs."
        />
        <StatCard
          label="Expected leftover"
          value={f.expectedLeftover}
          unit="meals"
          icon={<Scale className="h-4 w-4" />}
          hint="Expected surplus servings (overproduction)."
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card raised>
          <CardHeader
            eyebrow="Demand distribution"
            title="Predicted meal demand"
            description={`80% prediction interval: ${f.intervalLow}–${f.intervalHigh} meals. The dashed marker is the recommended preparation.`}
            action={<Badge tone="neutral">Modelled</Badge>}
          />
          <DemandChart data={f.distribution} preparationMarker={f.recommendedPreparation} />
          <p className="mt-3 text-xs leading-relaxed text-neutral2-500">
            {f.uncertaintyBasis === 'historical'
              ? 'Variability estimated from completed historical observations.'
              : 'Variability uses a provisional coefficient-of-variation assumption (12% of mean) because sufficient history is not yet available. This is not a validated confidence interval.'}
          </p>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader eyebrow="Risk" title="Shortage risk" />
            <div className="flex items-center gap-4">
              <div className="relative grid h-24 w-24 place-items-center">
                <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#162740" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke={riskTone === 'low' ? '#34d399' : riskTone === 'moderate' ? '#fbbf24' : '#f87171'}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${f.shortageRisk * 97.4} 97.4`}
                  />
                </svg>
                <span className="absolute font-display text-lg font-semibold text-white tabular-nums">
                  {riskPct}%
                </span>
              </div>
              <div className="text-sm text-neutral2-400">
                <p className="font-medium text-neutral2-200">Probability demand exceeds preparation</p>
                <p className="mt-1">Tone: <span className="font-medium text-warning-300">{riskTone}</span></p>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning-500/10 p-3 text-xs leading-relaxed text-warning-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Recommended preparation balances excess cost against this shortage probability — it is not a hard cap.
            </div>
          </Card>

          <Card>
            <CardHeader eyebrow="Decision" title="Recommended action" />
            <p className="text-sm leading-relaxed text-neutral2-300">
              Prepare <span className="font-semibold text-white">{f.recommendedPreparation} meals</span> of
              the planned menu. This leaves an expected{' '}
              <span className="font-semibold text-white">{f.expectedLeftover}-meal</span> surplus with a{' '}
              <span className="font-semibold text-white">{riskPct}%</span> shortage risk.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-neutral2-500">{f.rationale}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <CostRow label="Expected excess cost" value={money(f.expectedExcessCost)} />
              <CostRow label="Expected shortage cost" value={money(f.expectedShortageCost)} />
              <CostRow label="Total modelled cost" value={money(f.totalModelledCost)} />
              <CostRow label="Expected unmet demand" value={`${f.expectedUnmet} meals`} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={save} className="group">
                {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saved ? 'Plan saved' : 'Save forecast plan'}
              </Button>
              <a href={routeHref('counterfactual')}>
                <Button size="sm" variant="secondary" className="group w-full">
                  <GitBranch className="h-4 w-4" />
                  Run counterfactual
                </Button>
              </a>
              <a href={routeHref('history')}>
                <Button size="sm" variant="ghost">View history</Button>
              </a>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader eyebrow="Assumptions" title="Model assumptions" description="This is an uncertainty-aware demand estimation and cost-sensitive optimisation model, not a trained machine-learning model." />
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <AssumptionRow label="Estimated participation" value={`${(assumptions.estimatedParticipationRate * 100).toFixed(1)}%`} />
            <AssumptionRow label="Historical weight" value={`${(assumptions.historicalWeight * 100).toFixed(0)}%`} />
            <AssumptionRow label="Usable observations" value={String(assumptions.usableObservations)} />
            <AssumptionRow label="Demand std dev" value={`${f.demandStdDev.toFixed(1)} meals`} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-neutral2-500">
            Configured for <span className="text-neutral2-300">{config.schoolName || 'unnamed school'}</span> · {config.mealName || 'unnamed meal'} ({config.mealCategory}). Costs: excess {money(config.costOfExcess)}, shortage {money(config.costOfShortage)}.
          </p>
        </Card>
      </div>
    </PageShell>
  );
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-primary-950/40 px-3 py-2">
      <p className="text-2xs uppercase tracking-wider text-neutral2-500">{label}</p>
      <p className="font-mono font-medium text-neutral2-200 tabular-nums">{value}</p>
    </div>
  );
}

function AssumptionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-primary-950/40 px-3 py-2.5">
      <p className="text-2xs uppercase tracking-wider text-neutral2-500">{label}</p>
      <p className="mt-0.5 font-mono font-medium text-white tabular-nums">{value}</p>
    </div>
  );
}
