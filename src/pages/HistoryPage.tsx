import { useState } from 'react';
import { CheckCircle2, History as HistoryIcon, Pencil, Trash2, X } from 'lucide-react';
import type { HistoricalRecord, SavedPlan } from '@/types';
import { PageShell } from '@/components/Sidebar';
import { Badge, Button, Card, CardHeader, EmptyState, inputClass } from '@/components/ui';
import { useAppState } from '@/state/AppStateContext';
import { DEMO_HISTORY } from '@/data/demoData';
import { cn } from '@/lib/cn';

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export function HistoryPage() {
  const { plans, addObservation, deletePlan } = useAppState();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ actualDemand: '', observedLeftover: '' });
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const hasPlans = plans.length > 0;

  const openEditor = (plan: SavedPlan) => {
    setEditingId(plan.id);
    setForm({
      actualDemand: plan.observation ? String(plan.observation.actualDemand) : '',
      observedLeftover: plan.observation ? String(plan.observation.observedLeftover) : '',
    });
    setError(null);
  };
  const closeEditor = () => {
    setEditingId(null);
    setError(null);
  };

  const submitObservation = (plan: SavedPlan) => {
    const actual = Number(form.actualDemand);
    const leftover = Number(form.observedLeftover);

    if (form.actualDemand === '' || !Number.isFinite(actual) || actual < 0) {
      setError('Actual demand must be a non-negative number.');
      return;
    }
    if (form.observedLeftover !== '' && (!Number.isFinite(leftover) || leftover < 0)) {
      setError('Observed leftover must be a non-negative number.');
      return;
    }
    addObservation(plan.id, Math.round(actual), Number.isFinite(leftover) && leftover >= 0 ? Math.round(leftover) : 0);
    setEditingId(null);
    setSavedId(plan.id);
    setTimeout(() => setSavedId(null), 2500);
  };

  return (
    <PageShell
      eyebrow="Outcomes"
      title="History"
      description="Saved forecast plans with their predicted values and, when recorded, actual observations. Legacy demo rows are shown for context and are not fed back into the engine."
      actions={<Badge tone="neutral">{plans.length} saved plan{plans.length === 1 ? '' : 's'}</Badge>}
    >
      {/* Saved plans */}
      <Card raised className="mb-6">
        <CardHeader
          eyebrow="Saved plans"
          title="Prediction log"
          description="Plans saved from the Forecast page. Enter actual demand and observed leftover to generate real-world validation data."
        />
        {hasPlans ? (
          <div className="overflow-x-auto rounded-xl border border-primary-800/70">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="bg-primary-950/60 text-left text-2xs uppercase tracking-wider text-neutral2-500">
                  <Th>Date</Th>
                  <Th>Meal</Th>
                  <Th className="text-right">Predicted</Th>
                  <Th className="text-right">Recommended</Th>
                  <Th className="text-right">Actual demand</Th>
                  <Th className="text-right">Observed leftover</Th>
                  <Th className="text-right">Error</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-800/60">
                {plans.map((plan) => (
                  <PlanRow
                    key={plan.id}
                    plan={plan}
                    editing={editingId === plan.id}
                    saved={savedId === plan.id}
                    form={form}
                    error={editingId === plan.id ? error : null}
                    onEdit={() => openEditor(plan)}
                    onClose={closeEditor}
                    onFormChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
                    onSubmit={() => submitObservation(plan)}
                    onDelete={() => deletePlan(plan.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<HistoryIcon className="h-6 w-6" />}
            title="No saved plans yet"
            description="Go to the Forecast page and save a plan. It will appear here, and you can enter actual demand after the service."
          />
        )}
      </Card>

      {/* Legacy demo records */}
      <Card>
        <CardHeader
          eyebrow="Context"
          title="Legacy demo records"
          description="Illustrative rows for layout. These are not saved plans and are not fed back into the forecasting engine."
          action={<Badge tone="neutral">Demo</Badge>}
        />
        <div className="overflow-x-auto rounded-xl border border-primary-800/70">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="bg-primary-950/60 text-left text-2xs uppercase tracking-wider text-neutral2-500">
                <Th>Date</Th>
                <Th>Meal</Th>
                <Th className="text-right">Predicted</Th>
                <Th className="text-right">Actual</Th>
                <Th className="text-right">Error</Th>
                <Th className="text-right">Waste</Th>
                <Th>Recommendation</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-800/60">
              {DEMO_HISTORY.map((r) => (
                <DemoRow key={r.date} r={r} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </PageShell>
  );
}

function PlanRow({
  plan,
  editing,
  saved,
  form,
  error,
  onEdit,
  onClose,
  onFormChange,
  onSubmit,
  onDelete,
}: {
  plan: SavedPlan;
  editing: boolean;
  saved: boolean;
  form: { actualDemand: string; observedLeftover: string };
  error: string | null;
  onEdit: () => void;
  onClose: () => void;
  onFormChange: (k: 'actualDemand' | 'observedLeftover', v: string) => void;
  onSubmit: () => void;
  onDelete: () => void;
}) {
  const obs = plan.observation;
  const errorVal = obs ? obs.actualDemand - plan.forecast.predictedMeals : null;

  return (
    <tr className="transition-colors hover:bg-primary-800/20">
      <td className="whitespace-nowrap px-4 py-3 font-mono text-2xs text-neutral2-400 tabular-nums">
        {formatDate(plan.date)}
      </td>
      <td className="px-4 py-3 font-medium text-neutral2-200">{plan.mealName || '—'}</td>
      <td className="px-4 py-3 text-right tabular-nums text-neutral2-300">
        {plan.forecast.predictedMeals}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-neutral2-300">
        {plan.forecast.recommendedPreparation}
      </td>
      {editing ? (
        <td className="px-4 py-2" colSpan={4}>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={0}
              className={`${inputClass} h-8 w-28`}
              placeholder="Actual demand"
              value={form.actualDemand}
              onChange={(e) => onFormChange('actualDemand', e.target.value)}
            />
            <input
              type="number"
              min={0}
              className={`${inputClass} h-8 w-28`}
              placeholder="Observed leftover"
              value={form.observedLeftover}
              onChange={(e) => onFormChange('observedLeftover', e.target.value)}
            />
            <Button size="sm" onClick={onSubmit}>
              <CheckCircle2 className="h-4 w-4" />
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} className="text-error-400 hover:text-error-300">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            {error && <span className="text-xs text-error-400">{error}</span>}
          </div>
        </td>
      ) : (
        <>
          <td className="px-4 py-3 text-right tabular-nums text-neutral2-300">
            {obs ? obs.actualDemand : <span className="text-neutral2-600">—</span>}
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-neutral2-300">
            {obs ? obs.observedLeftover : <span className="text-neutral2-600">—</span>}
          </td>
          <td
            className={cn(
              'px-4 py-3 text-right font-medium tabular-nums',
              errorVal == null
                ? 'text-neutral2-600'
                : Math.abs(errorVal) <= 10
                  ? 'text-success-400'
                  : Math.abs(errorVal) <= 20
                    ? 'text-warning-300'
                    : 'text-error-400',
            )}
          >
            {errorVal == null ? '—' : `${errorVal > 0 ? '+' : ''}${errorVal}`}
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-1.5">
              {saved ? (
                <span className="inline-flex items-center gap-1 text-xs text-success-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Saved
                </span>
              ) : (
                <button
                  className="grid h-7 w-7 place-items-center rounded-lg text-neutral2-400 hover:bg-primary-800 hover:text-white focus-ring"
                  onClick={onEdit}
                  aria-label="Edit observation"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {obs && (
                <Badge tone="accent">
                  <CheckCircle2 className="h-3 w-3" />
                  Observed
                </Badge>
              )}
            </div>
          </td>
        </>
      )}
    </tr>
  );
}

function DemoRow({ r }: { r: HistoricalRecord }) {
  const errorTone =
    Math.abs(r.predictionError) <= 10
      ? 'text-success-400'
      : Math.abs(r.predictionError) <= 20
        ? 'text-warning-300'
        : 'text-error-400';
  return (
    <tr className="transition-colors hover:bg-primary-800/20">
      <td className="whitespace-nowrap px-4 py-3 font-mono text-2xs text-neutral2-400 tabular-nums">
        {formatDate(r.date)}
      </td>
      <td className="px-4 py-3 font-medium text-neutral2-200">{r.meal}</td>
      <td className="px-4 py-3 text-right tabular-nums text-neutral2-300">{r.predictedDemand}</td>
      <td className="px-4 py-3 text-right tabular-nums text-neutral2-300">{r.actualDemand}</td>
      <td className={cn('px-4 py-3 text-right font-medium tabular-nums', errorTone)}>
        {r.predictionError > 0 ? '+' : ''}
        {r.predictionError}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-neutral2-300">{r.waste}</td>
      <td className="px-4 py-3 text-neutral2-400">{r.recommendation}</td>
    </tr>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={cn('px-4 py-3 font-semibold', className)}>{children}</th>;
}
