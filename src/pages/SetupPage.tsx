import { useState } from 'react';
import { Database, Save, Utensils, CheckCircle2 } from 'lucide-react';
import type { MealCategory, SchoolConfig } from '@/types';
import { PageShell } from '@/components/Sidebar';
import { Badge, Button, Card, CardHeader, Field, inputClass } from '@/components/ui';
import { useAppState } from '@/state/AppStateContext';
import { DEMO_SCHOOL_CONFIG as DEMO_SCHOOL_CONFIG_IMPORT } from '@/data/demoData';
import { cn } from '@/lib/cn';

const CATEGORIES: { id: MealCategory; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'snack', label: 'Snack' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'special', label: 'Special' },
];

const EMPTY: SchoolConfig = {
  schoolName: '',
  averageAttendance: 0,
  mealName: '',
  mealCategory: 'lunch',
  historicalParticipationRate: 0,
  foodCostPerMeal: 0,
  costOfExcess: 0,
  costOfShortage: 0,
};

export function SetupPage() {
  const { config, setConfig, loadDemoConfig, isCustomConfig } = useAppState();
  // Local draft so changes aren't applied until "Save".
  const [draft, setDraft] = useState<SchoolConfig>(config);
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof SchoolConfig>(key: K, value: SchoolConfig[K]) => {
    setDraft((c) => ({ ...c, [key]: value }));
    setSaved(false);
  };

  // Numeric fields are sanitised to finite non-negative values so the
  // engine never receives NaN/Infinity from an empty or malformed input.
  const updateNum = (key: keyof SchoolConfig, raw: string, opts?: { max?: number }) => {
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n) || n < 0) {
      setDraft((c) => ({ ...c, [key]: 0 }));
    } else {
      const v = opts?.max != null ? Math.min(n, opts.max) : n;
      setDraft((c) => ({ ...c, [key]: v }));
    }
    setSaved(false);
  };

  const loadDemo = () => {
    loadDemoConfig();
    setDraft(DEMO_SCHOOL_CONFIG_IMPORT);
    setSaved(false);
  };
  const reset = () => {
    setDraft(EMPTY);
    setSaved(false);
  };
  const save = () => {
    setConfig(draft);
    setSaved(true);
  };

  const isDemo = draft.schoolName === DEMO_SCHOOL_CONFIG_IMPORT.schoolName;
  const isValid =
    draft.schoolName.trim().length > 0 &&
    draft.averageAttendance > 0 &&
    draft.historicalParticipationRate > 0;
  const dirty = JSON.stringify(draft) !== JSON.stringify(config);

  return (
    <PageShell
      eyebrow="Step 1"
      title="Setup"
      description="Define the school, the meal being planned and the cost structure that drives the optimisation. Saved changes feed every downstream screen."
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={reset}>
            Reset
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadDemo}
            className="group"
          >
            <Database className="h-4 w-4 transition-transform group-hover:scale-110" />
            Load Demo Dataset
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card raised className="p-6">
          <CardHeader
            eyebrow="School"
            title="School & meal"
            description="Basic context for the forecast."
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="School name" className="sm:col-span-2">
              <input
                className={inputClass}
                value={draft.schoolName}
                placeholder="e.g. Riverside Secondary School"
                onChange={(e) => update('schoolName', e.target.value)}
              />
            </Field>
            <Field label="Average attendance" hint="Students present on a typical day.">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={draft.averageAttendance || ''}
                placeholder="0"
                onChange={(e) => updateNum('averageAttendance', e.target.value)}
              />
            </Field>
            <Field label="Meal name">
              <input
                className={inputClass}
                value={draft.mealName}
                placeholder="e.g. Chicken Rice Bowl"
                onChange={(e) => update('mealName', e.target.value)}
              />
            </Field>
            <Field label="Meal category" className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => {
                  const active = draft.mealCategory === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => update('mealCategory', c.id)}
                      className={cn(
                        'h-9 rounded-lg border px-3 text-sm font-medium transition-colors focus-ring',
                        active
                          ? 'border-accent-500/50 bg-accent-500/15 text-accent-300'
                          : 'border-primary-800/70 bg-primary-950/40 text-neutral2-400 hover:border-primary-700 hover:text-neutral2-200',
                      )}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field
              label="Historical participation rate"
              hint="Share of attending students who typically take this meal (0–1)."
              className="sm:col-span-2"
            >
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                className={inputClass}
                value={draft.historicalParticipationRate || ''}
                placeholder="0.62"
                onChange={(e) =>
                  updateNum('historicalParticipationRate', e.target.value, { max: 1 })
                }
              />
            </Field>
          </div>

          <CardHeader
            eyebrow="Cost model"
            title="Cost structure"
            description="Used to balance overproduction against unmet demand."
          />
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Food cost per meal" hint="Currency cost to produce one meal.">
              <input
                type="number"
                min={0}
                step={0.01}
                className={inputClass}
                value={draft.foodCostPerMeal || ''}
                placeholder="0.00"
                onChange={(e) => updateNum('foodCostPerMeal', e.target.value)}
              />
            </Field>
            <Field label="Cost of excess" hint="Cost per meal prepared but not served.">
              <input
                type="number"
                min={0}
                step={0.01}
                className={inputClass}
                value={draft.costOfExcess || ''}
                placeholder="0.00"
                onChange={(e) => updateNum('costOfExcess', e.target.value)}
              />
            </Field>
            <Field label="Cost of shortage" hint="Opportunity cost per meal of unmet demand.">
              <input
                type="number"
                min={0}
                step={0.01}
                className={inputClass}
                value={draft.costOfShortage || ''}
                placeholder="0.00"
                onChange={(e) => updateNum('costOfShortage', e.target.value)}
              />
            </Field>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm text-success-400">
                <CheckCircle2 className="h-4 w-4" />
                Saved
              </span>
            )}
            <Button onClick={save} disabled={!dirty || !isValid} className="group">
              <Save className="h-4 w-4" />
              Save configuration
            </Button>
          </div>
        </Card>

        {/* summary rail */}
        <div className="space-y-4">
          <Card>
            <CardHeader eyebrow="Preview" title="Configuration summary" />
            <dl className="space-y-2.5 text-sm">
              <SummaryRow label="School" value={draft.schoolName || '—'} />
              <SummaryRow label="Attendance" value={draft.averageAttendance ? String(draft.averageAttendance) : '—'} />
              <SummaryRow label="Meal" value={draft.mealName || '—'} />
              <SummaryRow label="Category" value={CATEGORIES.find((c) => c.id === draft.mealCategory)?.label ?? '—'} />
              <SummaryRow
                label="Participation"
                value={draft.historicalParticipationRate ? draft.historicalParticipationRate.toFixed(2) : '—'}
              />
              <SummaryRow
                label="Cost / meal"
                value={draft.foodCostPerMeal ? `$${draft.foodCostPerMeal.toFixed(2)}` : '—'}
              />
              <SummaryRow
                label="Excess cost"
                value={draft.costOfExcess ? `$${draft.costOfExcess.toFixed(2)}` : '—'}
              />
              <SummaryRow
                label="Shortage cost"
                value={draft.costOfShortage ? `$${draft.costOfShortage.toFixed(2)}` : '—'}
              />
            </dl>
            {isDemo && (
              <div className="mt-4">
                <Badge tone="accent">
                  <Utensils className="h-3 w-3" />
                  Demo dataset loaded
                </Badge>
              </div>
            )}
            {isCustomConfig && !dirty && (
              <div className="mt-4">
                <Badge tone="neutral">Custom configuration active</Badge>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader eyebrow="Persistence" title="Where is this stored?" />
            <p className="text-sm leading-relaxed text-neutral2-400">
              Your configuration is saved to this browser only (localStorage).
              Saved forecast plans are also stored locally and survive a refresh.
              No external database is contacted.
            </p>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-neutral2-500">{label}</dt>
      <dd className="truncate font-medium text-neutral2-200">{value}</dd>
    </div>
  );
}
