// PlatePilot — Core domain types
// Shared across UI, demo data, and model logic.

/** Meal categories supported by the system. */
export type MealCategory =
  | 'breakfast'
  | 'lunch'
  | 'snack'
  | 'dinner'
  | 'special';

/** Configuration captured on the Setup screen. */
export interface SchoolConfig {
  schoolName: string;
  averageAttendance: number;
  mealName: string;
  mealCategory: MealCategory;
  /** 0–1 share of attending students expected to take the meal. */
  historicalParticipationRate: number;
  /** Currency cost to produce one meal. */
  foodCostPerMeal: number;
  /** Currency cost per excess meal produced but not served. */
  costOfExcess: number;
  /** Currency opportunity cost per meal of unmet demand. */
  costOfShortage: number;
}

/**
 * A historical observation used by the engine to refine forecasts.
 * All fields are optional except the ratio inputs so legacy demo
 * records (which may lack some fields) are supported without being
 * reinterpreted as measurements.
 */
export interface Observation {
  /** ISO yyyy-mm-dd, or any stable id. */
  date: string;
  meal?: string;
  category?: MealCategory;
  attendance?: number;
  predictedDemand?: number;
  actualDemand?: number;
  /** Excess meals produced but unserved. */
  observedLeftover?: number;
  /** True when actualDemand & attendance have been recorded. */
  completed?: boolean;
}

/** A saved forecast plan, separate from observations. */
export interface SavedPlan {
  id: string;
  createdAt: number;
  /** Incremented when the model logic changes. */
  modelVersion: string;
  date: string;
  schoolName: string;
  mealName: string;
  mealCategory: MealCategory;
  /** Snapshot of inputs used to produce this forecast. */
  inputs: {
    averageAttendance: number;
    historicalParticipationRate: number;
    foodCostPerMeal: number;
    costOfExcess: number;
    costOfShortage: number;
  };
  /** Snapshot of the forecast result. */
  forecast: ForecastSnapshot;
  /** Optional observed outcome, entered later. */
  observation?: {
    actualDemand: number;
    observedLeftover: number;
    enteredAt: number;
  };
}

/** Persistable forecast snapshot (no live distribution array needed). */
export interface ForecastSnapshot {
  expectedAttendance: number;
  predictedMeals: number;
  recommendedPreparation: number;
  expectedLeftover: number;
  expectedUnmet: number;
  shortageRisk: number;
  demandStdDev: number;
  intervalLow: number;
  intervalHigh: number;
  expectedExcessCost: number;
  expectedShortageCost: number;
  totalModelledCost: number;
  uncertaintyBasis: UncertaintyBasis;
  rationale: string;
}

export type UncertaintyBasis =
  | 'historical'
  | 'fallback'
  | 'insufficient-data';

/** Distribution-shaped forecast output (uncertainty-aware). */
export interface ForecastResult extends ForecastSnapshot {
  expectedAttendance: number;
  /** Demand distribution samples for charting. */
  distribution: DemandPoint[];
  /** Assumptions used to produce this forecast. */
  assumptions: ModelAssumptions;
}

export interface DemandPoint {
  /** Number of meals. */
  meals: number;
  /** Relative likelihood (unnormalised is fine for charting). */
  probability: number;
}

/** Documented modelling assumptions. */
export interface ModelAssumptions {
  estimatedParticipationRate: number;
  /** Weight of historical evidence vs configured rate, 0–1. */
  historicalWeight: number;
  /** Number of usable historical records. */
  usableObservations: number;
  /** Provisional CV used when history is insufficient. */
  fallbackCV: number;
  /** Whether the uncertainty estimate is assumption-based. */
  uncertaintyFromFallback: boolean;
}

/** Slider inputs for the Counterfactual Lab. */
export interface CounterfactualInputs {
  /** Delta applied to attendance, as a fraction (e.g. -0.1 = -10%). */
  attendanceChange: number;
  /** Delta applied to menu popularity, as a fraction. */
  menuPopularityChange: number;
  /** Delta applied to portion size, as a fraction. */
  portionSizeChange: number;
  /** Number of meals that can be donated rather than wasted. */
  donationCapacity: number;
}

/** A single row in the side-by-side counterfactual comparison. */
export interface PlanComparison {
  metric: string;
  current: number;
  scenario: number;
  unit: string;
  /** When true, lower is better. */
  lowerIsBetter: boolean;
}

/** Aggregated, honestly-labelled impact metrics. */
export interface ImpactBreakdown {
  /** Servings modelled as prepared by PlatePilot recommendation. */
  platePilotPrepared: number;
  /** Servings modelled as prepared by baseline policy. */
  baselinePrepared: number;
  /** Expected surplus under PlatePilot (meals). */
  platePilotSurplus: number;
  /** Expected surplus under baseline (meals). */
  baselineSurplus: number;
  /** Surplus diverted to donation under PlatePilot (meals). */
  platePilotDonated: number;
  /** Net food waste under PlatePilot after donation (meals). */
  platePilotNetWaste: number;
  /** Net food waste under baseline after donation (meals). */
  baselineNetWaste: number;
  /** Expected meals served under PlatePilot. */
  platePilotMealsServed: number;
  /** Expected meals served under baseline. */
  baselineMealsServed: number;
  /** Modelled cost under PlatePilot. */
  platePilotCost: number;
  /** Modelled cost under baseline. */
  baselineCost: number;
  /** Honest signed difference (baseline - platePilot). Positive = PlatePilot cheaper. */
  costDifference: number;
  /** Average servings per day modelled. */
  daysModelled: number;
  /** Whether environmental factors are configured. */
  environmentalConfigured: boolean;
  co2AvoidedKg: number;
  waterAvoidedL: number;
  /** Kg of food waste avoided (requires configured kg-per-meal factor). */
  foodWasteAvoidedKg: number;
}

/** Environmental conversion factors. When zero, factor is unconfigured. */
export interface EnvFactors {
  /** Kg CO2e per wasted meal. 0 = unconfigured. */
  co2PerMeal: number;
  /** Litres of water per wasted meal. 0 = unconfigured. */
  waterPerMeal: number;
  /** Kg of food per wasted meal. 0 = unconfigured. */
  kgPerMeal: number;
}

/** Validation comparison between a baseline method and PlatePilot. */
export interface ValidationRow {
  metric: string;
  baseline: number | null;
  platePilot: number | null;
  unit: string;
}

/** Result of a Monte Carlo policy simulation. */
export interface SimulationResult {
  seed: number;
  trials: number;
  baseline: PolicyStats;
  platePilot: PolicyStats;
  /** Signed: baseline cost - platePilot cost (positive = PlatePilot cheaper). */
  costDifference: number;
  /** Signed: baseline waste - platePilot waste (positive = PlatePilot less waste). */
  wasteDifference: number;
  /** Observed real-world error, when enough completed plans exist. */
  observed: ObservedValidation | null;
}

export interface PolicyStats {
  avgExcess: number;
  avgUnmet: number;
  shortageFrequency: number;
  avgCost: number;
  totalCost: number;
}

export interface ObservedValidation {
  completedPlans: number;
  mae: number;
  /** Mean signed error (actual - predicted). */
  bias: number;
}

/** Legacy demo historical record (for the History table only). */
export interface HistoricalRecord {
  date: string;
  meal: string;
  category: MealCategory;
  attendance: number;
  predictedDemand: number;
  actualDemand: number;
  predictionError: number;
  waste: number;
  recommendation: string;
}

export type RouteId =
  | 'landing'
  | 'setup'
  | 'forecast'
  | 'counterfactual'
  | 'impact'
  | 'validation'
  | 'history';
