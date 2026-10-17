import type {
  CounterfactualInputs,
  EnvFactors,
  HistoricalRecord,
  SchoolConfig,
} from '@/types';

/**
 * Demo data for PlatePilot.
 *
 * Phase 2 wires the engine to real computation; these constants now
 * only provide the seed configuration, slider defaults, and a few
 * illustrative historical rows for the History table. Forecast,
 * counterfactual, impact, and validation values are computed live.
 */

export const DEMO_SCHOOL_CONFIG: SchoolConfig = {
  schoolName: 'Riverside Secondary School',
  averageAttendance: 820,
  mealName: 'Chicken Rice Bowl',
  mealCategory: 'lunch',
  historicalParticipationRate: 0.62,
  foodCostPerMeal: 2.4,
  costOfExcess: 2.4,
  costOfShortage: 3.1,
};

export const DEMO_COUNTERFACTUAL_DEFAULTS: CounterfactualInputs = {
  attendanceChange: 0,
  menuPopularityChange: 0,
  portionSizeChange: 0,
  donationCapacity: 40,
};

/**
 * Illustrative historical rows shown alongside saved plans in the
 * History table. These are legacy demo records: they do NOT have the
 * full observation schema and are not fed back into the forecasting
 * engine. They are displayed for context only.
 */
export const DEMO_HISTORY: HistoricalRecord[] = [
  {
    date: '2026-10-16',
    meal: 'Chicken Rice Bowl',
    category: 'lunch',
    attendance: 815,
    predictedDemand: 504,
    actualDemand: 498,
    predictionError: -6,
    waste: 40,
    recommendation: 'Reduce preparation by 6 meals',
  },
  {
    date: '2026-10-15',
    meal: 'Vegetable Pasta',
    category: 'lunch',
    attendance: 808,
    predictedDemand: 486,
    actualDemand: 512,
    predictionError: 26,
    waste: 0,
    recommendation: 'Increase preparation by 20 meals',
  },
  {
    date: '2026-10-14',
    meal: 'Fish & Salad',
    category: 'lunch',
    attendance: 821,
    predictedDemand: 511,
    actualDemand: 503,
    predictionError: -8,
    waste: 37,
    recommendation: 'Hold preparation steady',
  },
  {
    date: '2026-10-13',
    meal: 'Beef Noodle Soup',
    category: 'lunch',
    attendance: 812,
    predictedDemand: 499,
    actualDemand: 505,
    predictionError: 6,
    waste: 31,
    recommendation: 'Hold preparation steady',
  },
];

/** Default environmental factors — 0 means unconfigured. */
export const DEFAULT_ENV_FACTORS: EnvFactors = {
  co2PerMeal: 0,
  waterPerMeal: 0,
  kgPerMeal: 0,
};

/** The baseline policy label used in Impact and Validation. */
export const BASELINE_METHOD = 'Fixed buffer: expected demand + 10%';
