import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  EnvFactors,
  ForecastResult,
  Observation,
  SavedPlan,
  SchoolConfig,
} from '@/types';
import {
  DEFAULT_ENV_FACTORS,
  loadState,
  saveConfig,
  saveEnv,
  savePlans,
  saveVersion,
} from '@/lib/storage';
import { forecast as runForecast, MODEL_VERSION } from '@/model/engine';
import { observationsFromPlans } from '@/model/simulation';
import { DEMO_SCHOOL_CONFIG } from '@/data/demoData';

interface AppState {
  config: SchoolConfig;
  plans: SavedPlan[];
  env: EnvFactors;
  /** Observations derived from completed plans, fed back into forecasts. */
  observations: Observation[];
  /** Current forecast derived from config + observations. */
  forecast: ForecastResult;
  /** Whether the current config differs from the demo baseline. */
  isCustomConfig: boolean;

  setConfig: (c: SchoolConfig) => void;
  loadDemoConfig: () => void;
  setEnv: (e: EnvFactors) => void;
  saveCurrentPlan: () => SavedPlan;
  addObservation: (planId: string, actualDemand: number, observedLeftover: number) => void;
  deletePlan: (planId: string) => void;
}

const Ctx = createContext<AppState | null>(null);

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function genId(): string {
  return `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => {
    // On the server there is no window; guard for safety.
    if (typeof window === 'undefined') {
      return {
        config: DEMO_SCHOOL_CONFIG,
        plans: [] as SavedPlan[],
        env: DEFAULT_ENV_FACTORS,
      };
    }
    return loadState();
  }, []);

  const [config, setConfigState] = useState<SchoolConfig>(initial.config);
  const [plans, setPlans] = useState<SavedPlan[]>(initial.plans);
  const [env, setEnvState] = useState<EnvFactors>(initial.env);

  // Persist on change.
  useEffect(() => {
    saveVersion();
  }, []);
  useEffect(() => {
    saveConfig(config);
  }, [config]);
  useEffect(() => {
    savePlans(plans);
  }, [plans]);
  useEffect(() => {
    saveEnv(env);
  }, [env]);

  // Observations derived from completed plans feed back into forecasts.
  const observations = useMemo(() => observationsFromPlans(plans), [plans]);

  // Current forecast derived from config + observations.
  const currentForecast = useMemo<ForecastResult>(
    () => runForecast({ config, observations }),
    [config, observations],
  );

  const setConfig = useCallback((c: SchoolConfig) => setConfigState(c), []);
  const loadDemoConfig = useCallback(() => setConfigState(DEMO_SCHOOL_CONFIG), []);
  const setEnv = useCallback((e: EnvFactors) => setEnvState(e), []);

  const saveCurrentPlan = useCallback((): SavedPlan => {
    const plan: SavedPlan = {
      id: genId(),
      createdAt: Date.now(),
      modelVersion: MODEL_VERSION,
      date: todayISO(),
      schoolName: config.schoolName,
      mealName: config.mealName,
      mealCategory: config.mealCategory,
      inputs: {
        averageAttendance: config.averageAttendance,
        historicalParticipationRate: config.historicalParticipationRate,
        foodCostPerMeal: config.foodCostPerMeal,
        costOfExcess: config.costOfExcess,
        costOfShortage: config.costOfShortage,
      },
      forecast: {
        expectedAttendance: currentForecast.expectedAttendance,
        predictedMeals: currentForecast.predictedMeals,
        recommendedPreparation: currentForecast.recommendedPreparation,
        expectedLeftover: currentForecast.expectedLeftover,
        expectedUnmet: currentForecast.expectedUnmet,
        shortageRisk: currentForecast.shortageRisk,
        demandStdDev: currentForecast.demandStdDev,
        intervalLow: currentForecast.intervalLow,
        intervalHigh: currentForecast.intervalHigh,
        expectedExcessCost: currentForecast.expectedExcessCost,
        expectedShortageCost: currentForecast.expectedShortageCost,
        totalModelledCost: currentForecast.totalModelledCost,
        uncertaintyBasis: currentForecast.uncertaintyBasis,
        rationale: currentForecast.rationale,
      },
    };
    setPlans((prev) => [plan, ...prev]);
    return plan;
  }, [config, currentForecast]);

  const addObservation = useCallback(
    (planId: string, actualDemand: number, observedLeftover: number) => {
      setPlans((prev) =>
        prev.map((p) =>
          p.id === planId
            ? {
                ...p,
                observation: {
                  actualDemand,
                  observedLeftover,
                  enteredAt: Date.now(),
                },
              }
            : p,
        ),
      );
    },
    [],
  );

  const deletePlan = useCallback((planId: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== planId));
  }, []);

  const isCustomConfig = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(DEMO_SCHOOL_CONFIG),
    [config],
  );

  const value: AppState = {
    config,
    plans,
    env,
    observations,
    forecast: currentForecast,
    isCustomConfig,
    setConfig,
    loadDemoConfig,
    setEnv,
    saveCurrentPlan,
    addObservation,
    deletePlan,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return ctx;
}
