import type {
  ObservedValidation,
  Observation,
  PolicyStats,
  SavedPlan,
  SimulationResult,
  SchoolConfig,
} from '@/types';
import { clamp, safeNonNeg } from './stats';
import {
  MODEL_VERSION,
  estimateDemandStdDev,
  estimateParticipationRate,
  optimisePreparation,
} from './engine';

/**
 * Deterministic Monte Carlo policy simulation.
 *
 * Uses a mulberry32 PRNG seeded with a user-provided integer so that
 * repeating a run with the same seed produces identical results. The
 * same simulated demand cases are fed to both policies, making the
 * comparison fair and repeatable.
 */

/** mulberry32 — small, fast, deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box–Muller transform to convert uniform [0,1) samples to a standard
 * normal sample.
 */
function standardNormal(rng: () => number): number {
  let u = rng();
  if (u < 1e-12) u = 1e-12;
  const v = rng();
  const r = Math.sqrt(-2 * Math.log(u));
  return r * Math.cos(2 * Math.PI * v);
}

export interface SimulationConfig {
  seed: number;
  trials: number;
  /** Buffer above expected demand for the baseline policy. Default 0.10. */
  baselineBuffer: number;
}

export const DEFAULT_SIMULATION: SimulationConfig = {
  seed: 42,
  trials: 1000,
  baselineBuffer: 0.1,
};

/**
 * Run a policy simulation comparing a fixed-buffer baseline against
 * the PlatePilot cost-optimised policy.
 *
 * Both policies are evaluated against the SAME sequence of simulated
 * demand draws, so the comparison is paired and repeatable.
 *
 * Does not block the UI — callers should invoke this from a worker or
 * chunk it. For the default 1000 trials it is fast enough to run
 * synchronously in a setTimeout, which is how the UI triggers it.
 */
export function runSimulation(
  config: SchoolConfig,
  observations: Observation[],
  simConfig: SimulationConfig,
): SimulationResult {
  const attendance = safeNonNeg(config.averageAttendance);
  const { rate } = estimateParticipationRate(
    clamp(config.historicalParticipationRate, 0, 1),
    observations,
  );
  const meanDemand = attendance * rate;

  const { stdDev } = estimateDemandStdDev(meanDemand, observations);
  const sigma = Math.max(stdDev, 0.0001);

  const costExcess = safeNonNeg(config.costOfExcess);
  const costShortage = safeNonNeg(config.costOfShortage);

  // PlatePilot policy: cost-optimised quantity (computed once, deterministic).
  const pp = optimisePreparation(
    meanDemand,
    sigma,
    costExcess,
    costShortage,
    attendance,
  );
  const ppQuantity = pp.quantity;

  // Baseline policy: expected demand + buffer.
  const baselineQuantity = clamp(
    Math.round(meanDemand * (1 + simConfig.baselineBuffer)),
    0,
    attendance,
  );

  const rng = mulberry32(simConfig.seed);

  let baseExcess = 0;
  let baseUnmet = 0;
  let baseShortageDays = 0;
  let baseCost = 0;

  let ppExcess = 0;
  let ppUnmet = 0;
  let ppShortageDays = 0;
  let ppCost = 0;

  for (let i = 0; i < simConfig.trials; i++) {
    // Same draw used for both policies (paired comparison).
    const demand = Math.max(0, meanDemand + sigma * standardNormal(rng));

    // Baseline
    const bEx = Math.max(baselineQuantity - demand, 0);
    const bUn = Math.max(demand - baselineQuantity, 0);
    baseExcess += bEx;
    baseUnmet += bUn;
    if (bUn > 0.5) baseShortageDays++;
    baseCost += bEx * costExcess + bUn * costShortage;

    // PlatePilot
    const pEx = Math.max(ppQuantity - demand, 0);
    const pUn = Math.max(demand - ppQuantity, 0);
    ppExcess += pEx;
    ppUnmet += pUn;
    if (pUn > 0.5) ppShortageDays++;
    ppCost += pEx * costExcess + pUn * costShortage;
  }

  const n = simConfig.trials;
  const baseline: PolicyStats = {
    avgExcess: baseExcess / n,
    avgUnmet: baseUnmet / n,
    shortageFrequency: baseShortageDays / n,
    avgCost: baseCost / n,
    totalCost: baseCost,
  };
  const platePilot: PolicyStats = {
    avgExcess: ppExcess / n,
    avgUnmet: ppUnmet / n,
    shortageFrequency: ppShortageDays / n,
    avgCost: ppCost / n,
    totalCost: ppCost,
  };

  return {
    seed: simConfig.seed,
    trials: n,
    baseline,
    platePilot,
    costDifference: baseCost - ppCost,
    wasteDifference: baseExcess - ppExcess,
    observed: computeObservedValidation(observations),
  };
}

/**
 * Compute observed real-world validation from completed observations.
 * Returns null when there is insufficient observed data.
 */
export function computeObservedValidation(
  observations: Observation[],
): ObservedValidation | null {
  const completed = observations.filter(
    (o) =>
      o.completed === true &&
      Number.isFinite(o.predictedDemand) &&
      Number.isFinite(o.actualDemand),
  );
  if (completed.length < 3) return null;

  const errors = completed.map((o) => o.actualDemand! - o.predictedDemand!);
  const mae = errors.reduce((s, e) => s + Math.abs(e), 0) / errors.length;
  const bias = errors.reduce((s, e) => s + e, 0) / errors.length;

  return { completedPlans: completed.length, mae, bias };
}

/**
 * Build observations from saved plans. Only plans with a recorded
 * observation are eligible to feed back into later forecasts.
 */
export function observationsFromPlans(plans: SavedPlan[]): Observation[] {
  return plans
    .filter((p) => p.observation && p.observation.actualDemand >= 0)
    .map((p) => ({
      date: p.date,
      meal: p.mealName,
      category: p.mealCategory,
      attendance: p.inputs.averageAttendance,
      predictedDemand: p.forecast.predictedMeals,
      actualDemand: p.observation!.actualDemand,
      observedLeftover: p.observation!.observedLeftover,
      completed: true,
    }));
}

/** Re-export for callers that need the model version with simulation. */
export { MODEL_VERSION };
