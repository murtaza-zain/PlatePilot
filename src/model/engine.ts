import type {
  CounterfactualInputs,
  DemandPoint,
  ForecastResult,
  ForecastSnapshot,
  ImpactBreakdown,
  ModelAssumptions,
  Observation,
  SchoolConfig,
} from '@/types';
import {
  clamp,
  expectedShortage,
  expectedSurplus,
  inverseNormalCdf,
  mean,
  meanAbsDev,
  safeNonNeg,
  shortageProbability,
  sampleStdDev,
} from './stats';

/**
 * PlatePilot forecasting & optimisation engine.
 *
 * This is an uncertainty-aware demand estimation and cost-sensitive
 * preparation optimisation model — NOT a trained machine-learning model.
 * All functions are pure (given their inputs) and deterministic.
 */

/** Current model version, persisted with each saved plan. */
export const MODEL_VERSION = 'pp-0.2.0';

/**
 * Minimum number of usable historical observations before the engine
 * trusts historical variability over the fallback assumption.
 */
export const MIN_HISTORY_FOR_VARIABILITY = 5;

/**
 * Provisional coefficient of variation used when historical data is
 * insufficient. 0.12 → demand standard deviation ≈ 12% of mean demand.
 * Documented assumption, not a validated parameter.
 */
export const FALLBACK_CV = 0.12;

/**
 * Weight given to the historically-estimated participation rate vs the
 * configured rate, once enough observations exist. Blended to smooth
 * the effect of any single unusual observation.
 */
const HISTORY_BLEND = 0.6;

/** 80% prediction interval z-bounds (central 80%). */
const Z_80 = 1.2815515655446004;

export interface ForecastInput {
  config: SchoolConfig;
  /** Eligible observations (completed preferred). */
  observations: Observation[];
  /** Optional explicit attendance override (e.g. counterfactual). */
  attendanceOverride?: number;
  /** Optional participation-rate multiplier (1 = no change). */
  popularityMultiplier?: number;
  /** Optional portion-size multiplier (1 = no change). */
  portionMultiplier?: number;
  /** Optional cost overrides for the optimisation. */
  costOverride?: {
    costOfExcess?: number;
    costOfShortage?: number;
    foodCostPerMeal?: number;
  };
  /** Optional donation capacity (meals) for net-waste reporting. */
  donationCapacity?: number;
}

/**
 * Estimate the participation rate from completed observations.
 *
 * Uses the demand-to-attendance ratio of records that have both
 * `actualDemand` and `attendance` present. Blends with the configured
 * rate so one unusual day cannot dominate the forecast.
 */
export function estimateParticipationRate(
  configuredRate: number,
  observations: Observation[],
): { rate: number; usable: number; weight: number } {
  const usable = observations.filter(
    (o): o is Observation & { attendance: number; actualDemand: number } =>
      o.completed === true &&
      o.attendance != null &&
      Number.isFinite(o.attendance) &&
      o.attendance > 0 &&
      o.actualDemand != null &&
      Number.isFinite(o.actualDemand) &&
      o.actualDemand >= 0,
  );

  if (usable.length < MIN_HISTORY_FOR_VARIABILITY) {
    return { rate: clamp(configuredRate, 0, 1), usable: usable.length, weight: 0 };
  }

  const ratios = usable.map((o) => o.actualDemand / o.attendance);
  const historicalRate = clamp(mean(ratios), 0, 1);

  // Blend: with enough history, lean toward historical; otherwise configured.
  const weight = Math.min(usable.length / 12, 1) * HISTORY_BLEND;
  const blended = configuredRate * (1 - weight) + historicalRate * weight;
  return { rate: clamp(blended, 0, 1), usable: usable.length, weight };
}

/**
 * Estimate demand variability (standard deviation) from observations.
 * Falls back to a documented CV assumption when history is insufficient.
 */
export function estimateDemandStdDev(
  meanDemand: number,
  observations: Observation[],
): { stdDev: number; fromFallback: boolean; usable: number } {
  const usable = observations.filter(
    (o): o is Observation & { attendance: number; actualDemand: number } =>
      o.completed === true &&
      o.actualDemand != null &&
      Number.isFinite(o.actualDemand) &&
      o.attendance != null &&
      Number.isFinite(o.attendance) &&
      o.attendance > 0,
  );

  if (usable.length < MIN_HISTORY_FOR_VARIABILITY) {
    return {
      stdDev: meanDemand * FALLBACK_CV,
      fromFallback: true,
      usable: usable.length,
    };
  }

  // Variability of the demand-to-attendance ratio, scaled to current mean.
  const ratios = usable.map((o) => o.actualDemand / o.attendance);
  const ratioStd = sampleStdDev(ratios);
  // Also account for absolute demand noise around the ratio prediction.
  const absResiduals = usable.map((o) => {
    const pred = (o.actualDemand / o.attendance) * o.attendance; // = actualDemand
    return o.actualDemand - pred;
  });
  // ratioStd * meanAttendance is the dominant term; add small abs residual noise.
  const ratioComponent = ratioStd * meanDemand;
  const absComponent = meanAbsDev(absResiduals);
  const stdDev = Math.sqrt(ratioComponent * ratioComponent + absComponent * absComponent);
  return { stdDev, fromFallback: false, usable: usable.length };
}

/**
 * Core forecast: estimate demand, quantify uncertainty, optimise preparation.
 */
export function forecast(input: ForecastInput): ForecastResult {
  const { config, observations } = input;

  const attendance = safeNonNeg(
    input.attendanceOverride ?? config.averageAttendance,
  );
  const attendanceClamped = clamp(attendance, 0, 100000);

  const popMult = clamp(input.popularityMultiplier ?? 1, 0, 10);
  const portionMult = clamp(input.portionMultiplier ?? 1, 0.1, 10);

  const { rate, usable, weight } = estimateParticipationRate(
    clamp(config.historicalParticipationRate, 0, 1),
    observations,
  );
  const effectiveRate = clamp(rate * popMult, 0, 1);

  // Expected demand. Portion size affects servings needed: larger portions
  // reduce the number of servings required for the same appetite.
  const rawDemand = attendanceClamped * effectiveRate;
  const expectedDemand = safeNonNeg(rawDemand / portionMult);

  const { stdDev, fromFallback } = estimateDemandStdDev(expectedDemand, observations);
  const sigma = Math.max(stdDev, 0.0001);

  // Cost-sensitive optimisation.
  const costExcess = safeNonNeg(input.costOverride?.costOfExcess ?? config.costOfExcess);
  const costShortage = safeNonNeg(
    input.costOverride?.costOfShortage ?? config.costOfShortage,
  );

  const recommendation = optimisePreparation(expectedDemand, sigma, costExcess, costShortage, attendanceClamped);

  // Uncertainty interval (central 80%).
  const intervalLow = Math.max(0, expectedDemand - Z_80 * sigma);
  const intervalHigh = expectedDemand + Z_80 * sigma;

  // Expected outcomes at the recommended preparation.
  const expSurplus = expectedSurplus(expectedDemand, sigma, recommendation.quantity);
  const expUnmet = expectedShortage(expectedDemand, sigma, recommendation.quantity);
  const shortageRisk = shortageProbability(expectedDemand, sigma, recommendation.quantity);

  const expExcessCost = expSurplus * costExcess;
  const expShortageCost = expUnmet * costShortage;
  const totalCost = expExcessCost + expShortageCost;

  const assumptions: ModelAssumptions = {
    estimatedParticipationRate: effectiveRate,
    historicalWeight: weight,
    usableObservations: usable,
    fallbackCV: FALLBACK_CV,
    uncertaintyFromFallback: fromFallback,
  };

  const snapshot: ForecastSnapshot = {
    expectedAttendance: Math.round(attendanceClamped),
    predictedMeals: Math.round(expectedDemand),
    recommendedPreparation: recommendation.quantity,
    expectedLeftover: Math.round(expSurplus),
    expectedUnmet: Math.round(expUnmet),
    shortageRisk,
    demandStdDev: sigma,
    intervalLow: Math.round(intervalLow),
    intervalHigh: Math.round(intervalHigh),
    expectedExcessCost: expExcessCost,
    expectedShortageCost: expShortageCost,
    totalModelledCost: totalCost,
    uncertaintyBasis: fromFallback ? 'fallback' : usable === 0 ? 'insufficient-data' : 'historical',
    rationale: recommendation.rationale,
  };

  const distribution = buildDistribution(expectedDemand, sigma);

  return { ...snapshot, distribution, assumptions };
}

export interface PreparationRecommendation {
  quantity: number;
  /** Unconstrained continuous optimum before rounding/limits. */
  rawOptimum: number;
  rationale: string;
}

/**
 * Cost-sensitive preparation optimisation.
 *
 * For normal demand D ~ N(μ, σ²), the quantity that minimises
 * E[excess cost + shortage cost] satisfies:
 *
 *   Φ((Q - μ)/σ) = costShortage / (costShortage + costExcess)
 *
 * i.e. the critical fractile (newsvendor optimum). Solved via the
 * inverse normal CDF. Q is then rounded to a whole serving and
 * clamped to [0, attendance] since one cannot serve more meals than
 * students present.
 */
export function optimisePreparation(
  meanDemand: number,
  sigma: number,
  costExcess: number,
  costShortage: number,
  attendanceCap: number,
): PreparationRecommendation {
  // Degenerate cost combinations: fall back to expected demand.
  const total = costExcess + costShortage;
  if (!Number.isFinite(total) || total <= 0) {
    const q = Math.round(clamp(meanDemand, 0, attendanceCap));
    return {
      quantity: q,
      rawOptimum: meanDemand,
      rationale:
        'Costs are zero or invalid — recommended preparation equals expected demand with no cost-based buffer.',
    };
  }

  const fractile = clamp(costShortage / total, 0, 1);
  const z = inverseNormalCdf(fractile);
  const rawOptimum = meanDemand + sigma * z;

  // Round to nearest whole serving, clamp to physical limits.
  const capped = clamp(rawOptimum, 0, Math.max(0, attendanceCap));
  const quantity = Math.round(capped);

  const direction =
    quantity > meanDemand
      ? `higher than expected demand because shortage cost ($${costShortage.toFixed(2)}) exceeds excess cost ($${costExcess.toFixed(2)}).`
      : quantity < meanDemand
        ? `lower than expected demand because excess cost ($${costExcess.toFixed(2)}) exceeds shortage cost ($${costShortage.toFixed(2)}).`
        : `equal to expected demand because excess and shortage costs are balanced.`;

  const rationale = `Recommended preparation is ${direction} Optimal service level: ${(fractile * 100).toFixed(0)}% (cost ratio).`;

  return { quantity, rawOptimum, rationale };
}

/**
 * Build a discrete distribution sample for charting, centred on μ.
 * 21 points across ±2.5σ.
 */
export function buildDistribution(meanDemand: number, sigma: number): DemandPoint[] {
  const points: DemandPoint[] = [];
  const span = 2.5;
  const n = 21;
  for (let i = 0; i < n; i++) {
    const z = -span + (2 * span * i) / (n - 1);
    const meals = Math.max(0, Math.round(meanDemand + z * sigma));
    const probability = Math.exp(-0.5 * z * z); // unnormalised phi
    points.push({ meals, probability });
  }
  return points;
}

/**
 * Counterfactual scenario forecast. Does NOT mutate the baseline.
 * Returns a fresh ForecastResult for the scenario inputs.
 */
export function counterfactualForecast(
  baseline: ForecastResult,
  input: ForecastInput,
  scenario: CounterfactualInputs,
): ForecastResult {
  const baseAttendance = baseline.expectedAttendance || input.config.averageAttendance;
  const scenarioAttendance = baseAttendance * (1 + scenario.attendanceChange);
  const popularityMultiplier = 1 + scenario.menuPopularityChange;
  const portionMultiplier = 1 + scenario.portionSizeChange;

  return forecast({
    ...input,
    attendanceOverride: scenarioAttendance,
    popularityMultiplier,
    portionMultiplier,
    donationCapacity: scenario.donationCapacity,
  });
}

/**
 * Build the comparison rows between a baseline and a scenario forecast.
 */
export function comparePlans(
  baseline: ForecastResult,
  scenario: ForecastResult,
  donationCapacity: number,
): import('@/types').PlanComparison[] {
  const baseDonated = Math.min(baseline.expectedLeftover, donationCapacity);
  const scenDonated = Math.min(scenario.expectedLeftover, donationCapacity);
  const baseNetWaste = Math.max(0, baseline.expectedLeftover - baseDonated);
  const scenNetWaste = Math.max(0, scenario.expectedLeftover - scenDonated);

  return [
    {
      metric: 'Expected demand',
      current: baseline.predictedMeals,
      scenario: scenario.predictedMeals,
      unit: 'meals',
      lowerIsBetter: false,
    },
    {
      metric: 'Recommended preparation',
      current: baseline.recommendedPreparation,
      scenario: scenario.recommendedPreparation,
      unit: 'meals',
      lowerIsBetter: false,
    },
    {
      metric: 'Expected surplus',
      current: baseline.expectedLeftover,
      scenario: scenario.expectedLeftover,
      unit: 'meals',
      lowerIsBetter: true,
    },
    {
      metric: 'Shortage probability',
      current: baseline.shortageRisk,
      scenario: scenario.shortageRisk,
      unit: '',
      lowerIsBetter: true,
    },
    {
      metric: 'Expected modelled cost',
      current: baseline.totalModelledCost,
      scenario: scenario.totalModelledCost,
      unit: '$',
      lowerIsBetter: true,
    },
    {
      metric: 'Donated meals',
      current: Math.round(baseDonated),
      scenario: Math.round(scenDonated),
      unit: 'meals',
      lowerIsBetter: false,
    },
    {
      metric: 'Estimated net food waste',
      current: Math.round(baseNetWaste),
      scenario: Math.round(scenNetWaste),
      unit: 'meals',
      lowerIsBetter: true,
    },
  ];
}

/**
 * Compute the modelled impact of PlatePilot vs a fixed-buffer baseline.
 *
 * Baseline policy: prepare expectedDemand × 1.10 (10% buffer).
 * Both policies are evaluated against the SAME demand model, so the
 * comparison is internally consistent.
 */
export function computeImpact(
  baseline: ForecastResult,
  config: SchoolConfig,
  envFactors: import('@/types').EnvFactors,
  daysModelled: number,
): ImpactBreakdown {
  const baselinePreparedRaw = Math.round(baseline.predictedMeals * 1.1);
  const baselinePrepared = clamp(baselinePreparedRaw, 0, baseline.expectedAttendance);

  const ppPrepared = baseline.recommendedPreparation;
  const mu = baseline.predictedMeals;
  const sigma = baseline.demandStdDev;

  const ppSurplus = expectedSurplus(mu, sigma, ppPrepared);
  const baseSurplus = expectedSurplus(mu, sigma, baselinePrepared);
  const ppUnmet = expectedShortage(mu, sigma, ppPrepared);
  const baseUnmet = expectedShortage(mu, sigma, baselinePrepared);

  const costExcess = safeNonNeg(config.costOfExcess);
  const costShortage = safeNonNeg(config.costOfShortage);

  const ppCost = (ppSurplus * costExcess + ppUnmet * costShortage) * daysModelled;
  const baseCost = (baseSurplus * costExcess + baseUnmet * costShortage) * daysModelled;
  const costDifference = baseCost - ppCost; // positive = PlatePilot cheaper

  const ppDonated = Math.min(ppSurplus, 0) * daysModelled; // placeholder, donation handled per-day
  const ppNetWaste = Math.max(0, ppSurplus) * daysModelled;
  const baseNetWaste = Math.max(0, baseSurplus) * daysModelled;

  const ppMealsServed = (mu - ppUnmet) * daysModelled;
  const baseMealsServed = (mu - baseUnmet) * daysModelled;

  const envConfigured =
    envFactors.co2PerMeal > 0 || envFactors.waterPerMeal > 0 || envFactors.kgPerMeal > 0;
  const wasteDiff = Math.max(0, baseNetWaste - ppNetWaste);

  return {
    platePilotPrepared: ppPrepared,
    baselinePrepared,
    platePilotSurplus: Math.round(ppSurplus * daysModelled),
    baselineSurplus: Math.round(baseSurplus * daysModelled),
    platePilotDonated: Math.round(ppDonated),
    platePilotNetWaste: Math.round(ppNetWaste),
    baselineNetWaste: Math.round(baseNetWaste),
    platePilotMealsServed: Math.round(ppMealsServed),
    baselineMealsServed: Math.round(baseMealsServed),
    platePilotCost: ppCost,
    baselineCost: baseCost,
    costDifference,
    daysModelled,
    environmentalConfigured: envConfigured,
    co2AvoidedKg: envFactors.co2PerMeal > 0 ? wasteDiff * envFactors.co2PerMeal : 0,
    waterAvoidedL: envFactors.waterPerMeal > 0 ? wasteDiff * envFactors.waterPerMeal : 0,
    foodWasteAvoidedKg: envFactors.kgPerMeal > 0 ? wasteDiff * envFactors.kgPerMeal : 0,
  };
}
