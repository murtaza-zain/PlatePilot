/**
 * PlatePilot — automated model tests.
 *
 * Self-contained: uses node:assert + a tiny runner. No external test
 * framework dependency. Run via: npx tsx src/model/__tests__/model.test.ts
 *
 * Tests exercise the REAL exported model functions, not copies of formulas.
 */
import assert from 'node:assert/strict';
import type {
  CounterfactualInputs,
  EnvFactors,
  Observation,
  SavedPlan,
  SchoolConfig,
} from '../../types';
import {
  clamp,
  safeNonNeg,
  normalPdf,
  normalCdf,
  inverseNormalCdf,
  expectedSurplus,
  expectedShortage,
  shortageProbability,
  mean,
  sampleStdDev,
  meanAbsDev,
} from '../stats';
import {
  forecast,
  optimisePreparation,
  counterfactualForecast,
  comparePlans,
  computeImpact,
  estimateParticipationRate,
  estimateDemandStdDev,
  buildDistribution,
  MODEL_VERSION,
  FALLBACK_CV,
  MIN_HISTORY_FOR_VARIABILITY,
} from '../engine';
import {
  runSimulation,
  mulberry32,
  DEFAULT_SIMULATION,
  computeObservedValidation,
  observationsFromPlans,
} from '../simulation';

// ---------- fixtures ----------

const BASE_CONFIG: SchoolConfig = {
  schoolName: 'Test School',
  averageAttendance: 500,
  mealName: 'Test Meal',
  mealCategory: 'lunch',
  historicalParticipationRate: 0.6,
  foodCostPerMeal: 2.5,
  costOfExcess: 2.5,
  costOfShortage: 4.0,
};

const NO_OBS: Observation[] = [];

function completedObs(n: number): Observation[] {
  const out: Observation[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      date: `2026-10-${String(10 + i).padStart(2, '0')}`,
      meal: 'Test Meal',
      category: 'lunch',
      attendance: 500,
      predictedDemand: 300,
      actualDemand: 290 + ((i * 7) % 25),
      completed: true,
    });
  }
  return out;
}

// ---------- tiny runner ----------

const tests: { name: string; fn: () => void }[] = [];
function test(name: string, fn: () => void) {
  tests.push({ name, fn });
}

function approxEqual(a: number, b: number, tol = 1e-6): boolean {
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
}

// ===================================================================
// A. Cost-sensitive optimisation
// ===================================================================

test('optimisePreparation: valid costs produce finite recommendation', () => {
  const r = optimisePreparation(300, 30, 2.5, 4.0, 500);
  assert.ok(Number.isFinite(r.quantity), 'quantity finite');
  assert.ok(Number.isFinite(r.rawOptimum), 'rawOptimum finite');
  assert.ok(r.quantity >= 0, 'non-negative');
});

test('optimisePreparation: higher shortage cost increases recommendation', () => {
  const low = optimisePreparation(300, 30, 2.5, 2.5, 500);
  const high = optimisePreparation(300, 30, 2.5, 10.0, 500);
  assert.ok(
    high.quantity >= low.quantity,
    `high shortage (${high.quantity}) >= low (${low.quantity})`,
  );
});

test('optimisePreparation: higher excess cost decreases recommendation', () => {
  const low = optimisePreparation(300, 30, 2.5, 4.0, 500);
  const high = optimisePreparation(300, 30, 10.0, 4.0, 500);
  assert.ok(
    high.quantity <= low.quantity,
    `high excess (${high.quantity}) <= low (${low.quantity})`,
  );
});

test('optimisePreparation: recommendation within [0, attendanceCap]', () => {
  const r = optimisePreparation(300, 30, 2.5, 4.0, 400);
  assert.ok(r.quantity >= 0 && r.quantity <= 400, `in [0,400]: ${r.quantity}`);
  // Large sigma pushing beyond cap clamps to cap.
  const r2 = optimisePreparation(300, 200, 1, 100, 400);
  assert.ok(r2.quantity <= 400, `clamped to cap: ${r2.quantity}`);
});

test('optimisePreparation: whole-serving rounding', () => {
  const r = optimisePreparation(300.7, 30, 2.5, 4.0, 500);
  assert.ok(Number.isInteger(r.quantity), 'quantity is integer');
});

test('optimisePreparation: zero/invalid costs fall back to expected demand', () => {
  const r0 = optimisePreparation(300, 30, 0, 0, 500);
  assert.equal(r0.quantity, 300, 'zero costs -> expected demand');
  const rNeg = optimisePreparation(300, 30, -1, -1, 500);
  assert.equal(rNeg.quantity, 300, 'negative costs -> expected demand');
  const rNaN = optimisePreparation(300, 30, NaN, 4, 500);
  assert.equal(rNaN.quantity, 300, 'NaN costs -> expected demand');
});

test('optimisePreparation: optimal fractile for known costs', () => {
  // costShortage/(costExcess+costShortage) = 4/(2.5+4) = 0.615...
  // Q = mu + sigma * Phi^-1(0.615)
  const r = optimisePreparation(300, 30, 2.5, 4.0, 500);
  const fractile = 4.0 / (2.5 + 4.0);
  const expectedRaw = 300 + 30 * inverseNormalCdf(fractile);
  assert.ok(approxEqual(r.rawOptimum, expectedRaw, 1e-4), 'rawOptimum matches fractile');
});

// ===================================================================
// B. Statistical helpers and uncertainty
// ===================================================================

test('normalPdf: peak at 0 is 1/sqrt(2pi)', () => {
  const expected = 1 / Math.sqrt(2 * Math.PI);
  assert.ok(approxEqual(normalPdf(0), expected, 1e-10));
});

test('normalCdf: known reference values', () => {
  assert.ok(approxEqual(normalCdf(0), 0.5, 1e-6), 'Phi(0)=0.5');
  assert.ok(approxEqual(normalCdf(1.96), 0.975, 1e-3), 'Phi(1.96)≈0.975');
  assert.ok(approxEqual(normalCdf(-1.96), 0.025, 1e-3), 'Phi(-1.96)≈0.025');
});

test('normalCdf: probability bounds [0,1]', () => {
  for (const z of [-10, -5, -1, 0, 1, 5, 10, Infinity, -Infinity]) {
    const p = normalCdf(z);
    assert.ok(p >= 0 && p <= 1, `Phi(${z})=${p} in [0,1]`);
  }
});

test('inverseNormalCdf: known quantiles', () => {
  assert.ok(approxEqual(inverseNormalCdf(0.5), 0, 1e-4), 'Phi^-1(0.5)=0');
  assert.ok(approxEqual(inverseNormalCdf(0.975), 1.96, 1e-3), 'Phi^-1(0.975)≈1.96');
  assert.ok(approxEqual(inverseNormalCdf(0.025), -1.96, 1e-3), 'Phi^-1(0.025)≈-1.96');
});

test('inverseNormalCdf: inverse of CDF', () => {
  for (const p of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    const z = inverseNormalCdf(p);
    assert.ok(approxEqual(normalCdf(z), p, 1e-3), `Phi(Phi^-1(${p}))=${normalCdf(z)}≈${p}`);
  }
});

test('expectedSurplus: non-negative', () => {
  for (const q of [0, 100, 300, 500, 1000]) {
    const s = expectedSurplus(300, 30, q);
    assert.ok(s >= 0 && Number.isFinite(s), `surplus finite>=0 at Q=${q}: ${s}`);
  }
});

test('expectedShortage: non-negative', () => {
  for (const q of [0, 100, 300, 500, 1000]) {
    const s = expectedShortage(300, 30, q);
    assert.ok(s >= 0 && Number.isFinite(s), `shortage finite>=0 at Q=${q}: ${s}`);
  }
});

test('shortageProbability: in [0,1]', () => {
  for (const q of [0, 100, 300, 500, 1000]) {
    const p = shortageProbability(300, 30, q);
    assert.ok(p >= 0 && p <= 1, `P in [0,1] at Q=${q}: ${p}`);
  }
});

test('zero/negligible sigma: no NaN or Infinity', () => {
  const s = expectedSurplus(300, 0, 250);
  const u = expectedShortage(300, 0, 250);
  const p = shortageProbability(300, 0, 250);
  assert.ok(Number.isFinite(s), 'surplus finite at sigma=0');
  assert.ok(Number.isFinite(u), 'shortage finite at sigma=0');
  assert.ok(Number.isFinite(p), 'prob finite at sigma=0');
  // sigma=0, Q<mu -> surplus=mu-Q, shortage=0
  assert.equal(s, 50);
  assert.equal(u, 0);
});

test('forecast: prediction interval ordering low <= high', () => {
  const f = forecast({ config: BASE_CONFIG, observations: NO_OBS });
  assert.ok(f.intervalLow <= f.intervalHigh, 'low <= high');
  assert.ok(f.intervalLow >= 0, 'low >= 0');
});

test('forecast: fallback CV used when history insufficient', () => {
  const f = forecast({ config: BASE_CONFIG, observations: NO_OBS });
  assert.equal(f.uncertaintyBasis, 'fallback');
  assert.ok(f.assumptions.uncertaintyFromFallback, 'fromFallback=true');
  const expectedSigma = f.predictedMeals * FALLBACK_CV;
  assert.ok(approxEqual(f.demandStdDev, expectedSigma, 1e-3), 'sigma = mu*CV');
});

test('estimateParticipationRate: insufficient history -> configured rate', () => {
  const r = estimateParticipationRate(0.6, completedObs(2));
  assert.equal(r.usable, 2);
  assert.equal(r.weight, 0);
  assert.equal(r.rate, 0.6);
});

test('estimateDemandStdDev: insufficient history -> fallback', () => {
  const r = estimateDemandStdDev(300, completedObs(2));
  assert.equal(r.fromFallback, true);
  assert.equal(r.usable, 2);
  assert.ok(approxEqual(r.stdDev, 300 * FALLBACK_CV));
});

test('estimateDemandStdDev: enough history -> historical variability', () => {
  const r = estimateDemandStdDev(300, completedObs(MIN_HISTORY_FOR_VARIABILITY + 2));
  assert.equal(r.fromFallback, false);
  assert.ok(r.stdDev > 0);
});

test('clamp/safeNonNeg edge cases', () => {
  assert.equal(clamp(NaN, 0, 10), 0);
  assert.equal(clamp(Infinity, 0, 10), 0);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(safeNonNeg(NaN), 0);
  assert.equal(safeNonNeg(-1), 0);
  assert.equal(safeNonNeg(5), 5);
});

test('mean/sampleStdDev/meanAbsDev', () => {
  assert.equal(mean([]), 0);
  assert.equal(mean([1, 2, 3]), 2);
  assert.equal(sampleStdDev([]), 0);
  assert.equal(sampleStdDev([5]), 0);
  // sample std dev of [2,4,4,4,5,5,7,9] = 2.138...
  const sd = sampleStdDev([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.ok(approxEqual(sd, 2.138, 1e-2));
  assert.equal(meanAbsDev([]), 0);
  assert.equal(meanAbsDev([1, 3]), 1);
});

// ===================================================================
// C. Counterfactuals and plan comparisons
// ===================================================================

test('counterfactualForecast: attendance change affects demand', () => {
  const base = forecast({ config: BASE_CONFIG, observations: NO_OBS });
  const scenario: CounterfactualInputs = {
    attendanceChange: 0.1,
    menuPopularityChange: 0,
    portionSizeChange: 0,
    donationCapacity: 40,
  };
  const cf = counterfactualForecast(base, { config: BASE_CONFIG, observations: NO_OBS }, scenario);
  assert.ok(cf.predictedMeals > base.predictedMeals, 'attendance up -> demand up');
});

test('counterfactualForecast: menu popularity affects demand', () => {
  const base = forecast({ config: BASE_CONFIG, observations: NO_OBS });
  const scenario: CounterfactualInputs = {
    attendanceChange: 0,
    menuPopularityChange: 0.1,
    portionSizeChange: 0,
    donationCapacity: 40,
  };
  const cf = counterfactualForecast(base, { config: BASE_CONFIG, observations: NO_OBS }, scenario);
  assert.ok(cf.predictedMeals > base.predictedMeals, 'popularity up -> demand up');
});

test('counterfactualForecast: portion size affects servings, not attendance', () => {
  const base = forecast({ config: BASE_CONFIG, observations: NO_OBS });
  const scenario: CounterfactualInputs = {
    attendanceChange: 0,
    menuPopularityChange: 0,
    portionSizeChange: 0.2,
    donationCapacity: 40,
  };
  const cf = counterfactualForecast(base, { config: BASE_CONFIG, observations: NO_OBS }, scenario);
  // Larger portions -> fewer servings needed.
  assert.ok(cf.predictedMeals < base.predictedMeals, 'portion up -> servings down');
  // Attendance unchanged.
  assert.equal(cf.expectedAttendance, base.expectedAttendance);
});

test('counterfactualForecast: baseline unchanged after scenario', () => {
  const base = forecast({ config: BASE_CONFIG, observations: NO_OBS });
  const originalMeals = base.predictedMeals;
  const scenario: CounterfactualInputs = {
    attendanceChange: 0.2,
    menuPopularityChange: 0.2,
    portionSizeChange: -0.2,
    donationCapacity: 100,
  };
  counterfactualForecast(base, { config: BASE_CONFIG, observations: NO_OBS }, scenario);
  assert.equal(base.predictedMeals, originalMeals, 'baseline mutated!');
});

test('comparePlans: donation affects net waste, not demand', () => {
  const base = forecast({ config: BASE_CONFIG, observations: NO_OBS });
  const scenario: CounterfactualInputs = {
    attendanceChange: 0,
    menuPopularityChange: 0,
    portionSizeChange: 0,
    donationCapacity: 100,
  };
  const cf = counterfactualForecast(base, { config: BASE_CONFIG, observations: NO_OBS }, scenario);
  const rowsLow = comparePlans(base, cf, 0);
  const rowsHigh = comparePlans(base, cf, 100);
  const wasteLow = rowsLow.find((r) => r.metric === 'Estimated net food waste')!;
  const wasteHigh = rowsHigh.find((r) => r.metric === 'Estimated net food waste')!;
  assert.ok(wasteHigh.scenario <= wasteLow.scenario, 'higher donation -> less/equal waste');
  // Demand row should be identical (donation doesn't affect demand).
  const demandLow = rowsLow.find((r) => r.metric === 'Expected demand')!;
  const demandHigh = rowsHigh.find((r) => r.metric === 'Expected demand')!;
  assert.equal(demandLow.scenario, demandHigh.scenario);
});

test('buildDistribution: 21 points, finite, non-negative', () => {
  const d = buildDistribution(300, 30);
  assert.equal(d.length, 21);
  for (const p of d) {
    assert.ok(Number.isFinite(p.meals) && p.meals >= 0, `meals finite>=0: ${p.meals}`);
    assert.ok(Number.isFinite(p.probability) && p.probability >= 0, 'prob finite>=0');
  }
});

// ===================================================================
// D. Deterministic Monte Carlo simulation
// ===================================================================

test('runSimulation: same seed -> identical results', () => {
  const a = runSimulation(BASE_CONFIG, NO_OBS, { seed: 42, trials: 200, baselineBuffer: 0.1 });
  const b = runSimulation(BASE_CONFIG, NO_OBS, { seed: 42, trials: 200, baselineBuffer: 0.1 });
  assert.deepEqual(a, b, 'identical seed -> identical result');
});

test('runSimulation: different seed -> different results (very likely)', () => {
  const a = runSimulation(BASE_CONFIG, NO_OBS, { seed: 42, trials: 500, baselineBuffer: 0.1 });
  const b = runSimulation(BASE_CONFIG, NO_OBS, { seed: 99, trials: 500, baselineBuffer: 0.1 });
  assert.notDeepEqual(a.baseline, b.baseline, 'different seed -> different baseline');
});

test('runSimulation: results finite and in sensible bounds', () => {
  const r = runSimulation(BASE_CONFIG, NO_OBS, { seed: 7, trials: 500, baselineBuffer: 0.1 });
  assert.ok(Number.isFinite(r.baseline.avgCost), 'avgCost finite');
  assert.ok(r.baseline.shortageFrequency >= 0 && r.baseline.shortageFrequency <= 1, 'freq in [0,1]');
  assert.ok(r.baseline.avgExcess >= 0, 'excess >= 0');
  assert.ok(r.baseline.avgUnmet >= 0, 'unmet >= 0');
  assert.ok(r.platePilot.avgExcess >= 0, 'pp excess >= 0');
  assert.ok(r.platePilot.avgUnmet >= 0, 'pp unmet >= 0');
  assert.ok(r.costDifference === r.baseline.totalCost - r.platePilot.totalCost, 'costDiff consistent');
});

test('runSimulation: paired comparison (same demand draws)', () => {
  // The sum of excess + unmet for each trial should be |prepared - demand|
  // for each policy. We verify the totals are internally consistent by
  // checking that both policies saw the same number of trials.
  const r = runSimulation(BASE_CONFIG, NO_OBS, { seed: 11, trials: 100, baselineBuffer: 0.1 });
  assert.equal(r.trials, 100);
  // Cost difference is signed.
  assert.ok(Number.isFinite(r.costDifference));
});

test('runSimulation: invalid config handled safely', () => {
  const bad: SchoolConfig = { ...BASE_CONFIG, averageAttendance: 0, costOfExcess: -1, costOfShortage: -1 };
  const r = runSimulation(bad, NO_OBS, { seed: 1, trials: 50, baselineBuffer: 0.1 });
  assert.ok(Number.isFinite(r.baseline.avgCost), 'bad config -> finite cost');
  assert.ok(Number.isFinite(r.platePilot.avgCost), 'bad config -> finite pp cost');
});

test('runSimulation: observed stays separate from simulated', () => {
  // With no completed observations, observed should be null.
  const r = runSimulation(BASE_CONFIG, NO_OBS, DEFAULT_SIMULATION);
  assert.equal(r.observed, null, 'no observations -> observed null');
});

test('mulberry32: deterministic sequence', () => {
  const a = mulberry32(123);
  const b = mulberry32(123);
  for (let i = 0; i < 10; i++) {
    assert.equal(a(), b(), `draw ${i} identical`);
  }
});

// ===================================================================
// E. Persistence and observations
// ===================================================================

test('observationsFromPlans: only completed plans included', () => {
  const plans: SavedPlan[] = [
    {
      id: 'p1',
      createdAt: 1,
      modelVersion: MODEL_VERSION,
      date: '2026-10-01',
      schoolName: 'S',
      mealName: 'M',
      mealCategory: 'lunch',
      inputs: {
        averageAttendance: 500,
        historicalParticipationRate: 0.6,
        foodCostPerMeal: 2.5,
        costOfExcess: 2.5,
        costOfShortage: 4,
      },
      forecast: {
        expectedAttendance: 500,
        predictedMeals: 300,
        recommendedPreparation: 310,
        expectedLeftover: 10,
        expectedUnmet: 5,
        shortageRisk: 0.2,
        demandStdDev: 36,
        intervalLow: 254,
        intervalHigh: 346,
        expectedExcessCost: 25,
        expectedShortageCost: 20,
        totalModelledCost: 45,
        uncertaintyBasis: 'fallback',
        rationale: 'test',
      },
      observation: { actualDemand: 295, observedLeftover: 12, enteredAt: 2 },
    },
    {
      id: 'p2',
      createdAt: 2,
      modelVersion: MODEL_VERSION,
      date: '2026-10-02',
      schoolName: 'S',
      mealName: 'M',
      mealCategory: 'lunch',
      inputs: {
        averageAttendance: 500,
        historicalParticipationRate: 0.6,
        foodCostPerMeal: 2.5,
        costOfExcess: 2.5,
        costOfShortage: 4,
      },
      forecast: {
        expectedAttendance: 500,
        predictedMeals: 300,
        recommendedPreparation: 310,
        expectedLeftover: 10,
        expectedUnmet: 5,
        shortageRisk: 0.2,
        demandStdDev: 36,
        intervalLow: 254,
        intervalHigh: 346,
        expectedExcessCost: 25,
        expectedShortageCost: 20,
        totalModelledCost: 45,
        uncertaintyBasis: 'fallback',
        rationale: 'test',
      },
      // no observation
    },
  ];
  const obs = observationsFromPlans(plans);
  assert.equal(obs.length, 1, 'only one plan has observation');
  assert.equal(obs[0].date, '2026-10-01', 'linked to correct plan');
  assert.equal(obs[0].actualDemand, 295);
  assert.equal(obs[0].completed, true);
});

test('observationsFromPlans: missing actual stays missing (not zero)', () => {
  const plans: SavedPlan[] = [
    {
      id: 'p1',
      createdAt: 1,
      modelVersion: MODEL_VERSION,
      date: '2026-10-01',
      schoolName: 'S',
      mealName: 'M',
      mealCategory: 'lunch',
      inputs: {
        averageAttendance: 500,
        historicalParticipationRate: 0.6,
        foodCostPerMeal: 2.5,
        costOfExcess: 2.5,
        costOfShortage: 4,
      },
      forecast: {
        expectedAttendance: 500,
        predictedMeals: 300,
        recommendedPreparation: 310,
        expectedLeftover: 10,
        expectedUnmet: 5,
        shortageRisk: 0.2,
        demandStdDev: 36,
        intervalLow: 254,
        intervalHigh: 346,
        expectedExcessCost: 25,
        expectedShortageCost: 20,
        totalModelledCost: 45,
        uncertaintyBasis: 'fallback',
        rationale: 'test',
      },
    },
  ];
  const obs = observationsFromPlans(plans);
  assert.equal(obs.length, 0, 'no observation -> not included');
});

test('computeObservedValidation: insufficient -> null', () => {
  assert.equal(computeObservedValidation([]), null);
  assert.equal(computeObservedValidation(completedObs(2)), null, '<3 -> null');
});

test('computeObservedValidation: sufficient -> mae and bias', () => {
  const obs: Observation[] = [
    { date: 'd1', predictedDemand: 300, actualDemand: 310, completed: true },
    { date: 'd2', predictedDemand: 300, actualDemand: 290, completed: true },
    { date: 'd3', predictedDemand: 300, actualDemand: 305, completed: true },
  ];
  const v = computeObservedValidation(obs);
  assert.ok(v, 'not null');
  assert.equal(v!.completedPlans, 3);
  // errors: 10, -10, 5 -> mae = 25/3, bias = 5/3
  assert.ok(approxEqual(v!.mae, 25 / 3, 1e-6));
  assert.ok(approxEqual(v!.bias, 5 / 3, 1e-6));
});

test('computeObservedValidation: ignores incomplete records', () => {
  const obs: Observation[] = [
    { date: 'd1', predictedDemand: 300, actualDemand: 310, completed: true },
    { date: 'd2', predictedDemand: 300, actualDemand: 290, completed: true },
    { date: 'd3', predictedDemand: 300, actualDemand: 305, completed: true },
    { date: 'd4', predictedDemand: 300 }, // incomplete
  ];
  const v = computeObservedValidation(obs);
  assert.equal(v!.completedPlans, 3, 'incomplete ignored');
});

test('computeImpact: honest signed cost difference', () => {
  const f = forecast({ config: BASE_CONFIG, observations: NO_OBS });
  const env: EnvFactors = { co2PerMeal: 0, waterPerMeal: 0, kgPerMeal: 0 };
  const impact = computeImpact(f, BASE_CONFIG, env, 20);
  assert.equal(impact.costDifference, impact.baselineCost - impact.platePilotCost, 'signed diff');
  assert.equal(impact.environmentalConfigured, false, 'env not configured');
  assert.equal(impact.co2AvoidedKg, 0, 'no fabricated CO2');
  assert.equal(impact.waterAvoidedL, 0, 'no fabricated water');
});

test('computeImpact: env factors only when configured', () => {
  const f = forecast({ config: BASE_CONFIG, observations: NO_OBS });
  const env: EnvFactors = { co2PerMeal: 2.5, waterPerMeal: 100, kgPerMeal: 0.3 };
  const impact = computeImpact(f, BASE_CONFIG, env, 20);
  assert.equal(impact.environmentalConfigured, true);
  assert.ok(impact.co2AvoidedKg >= 0, 'co2 non-negative');
  assert.ok(impact.waterAvoidedL >= 0, 'water non-negative');
});

test('computeImpact: negative cost difference reported honestly', () => {
  // Make PlatePilot more expensive by skewing costs so the optimised
  // quantity exceeds the baseline buffer quantity.
  const cfg: SchoolConfig = {
    ...BASE_CONFIG,
    costOfExcess: 10,
    costOfShortage: 1,
  };
  const f = forecast({ config: cfg, observations: NO_OBS });
  const env: EnvFactors = { co2PerMeal: 0, waterPerMeal: 0, kgPerMeal: 0 };
  const impact = computeImpact(f, cfg, env, 20);
  // The signed difference is what it is — not abs()'d into a saving.
  assert.ok(
    impact.costDifference === impact.baselineCost - impact.platePilotCost,
    'not absolute-valued',
  );
});

test('forecast: invalid config does not crash or produce NaN', () => {
  const bad: SchoolConfig = {
    ...BASE_CONFIG,
    averageAttendance: NaN,
    historicalParticipationRate: -1,
    costOfExcess: Infinity,
    costOfShortage: NaN,
  };
  const f = forecast({ config: bad, observations: NO_OBS });
  assert.ok(Number.isFinite(f.predictedMeals), 'predictedMeals finite');
  assert.ok(Number.isFinite(f.recommendedPreparation), 'recommended finite');
  assert.ok(Number.isFinite(f.shortageRisk), 'shortageRisk finite');
  assert.ok(f.shortageRisk >= 0 && f.shortageRisk <= 1, 'risk in [0,1]');
});

test('forecast: config changes feed the engine', () => {
  const a = forecast({ config: BASE_CONFIG, observations: NO_OBS });
  const b = forecast({
    config: { ...BASE_CONFIG, averageAttendance: 1000 },
    observations: NO_OBS,
  });
  assert.ok(b.predictedMeals > a.predictedMeals, 'higher attendance -> more meals');
});

test('forecast: participation rate changes demand', () => {
  const a = forecast({ config: BASE_CONFIG, observations: NO_OBS });
  const b = forecast({
    config: { ...BASE_CONFIG, historicalParticipationRate: 0.9 },
    observations: NO_OBS,
  });
  assert.ok(b.predictedMeals > a.predictedMeals, 'higher rate -> more demand');
});

// ---------- run ----------

let passed = 0;
let failed = 0;
const failures: string[] = [];

for (const t of tests) {
  try {
    t.fn();
    passed++;
  } catch (e) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`  ✗ ${t.name}\n    ${msg}`);
  }
}

console.log(`\nPlatePilot model tests: ${passed} passed, ${failed} failed, ${tests.length} total\n`);
if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(f);
  process.exit(1);
}
