import type { EnvFactors, SchoolConfig, SavedPlan } from '@/types';
import { DEMO_SCHOOL_CONFIG } from '@/data/demoData';

/**
 * Versioned localStorage persistence for PlatePilot.
 *
 * No secrets, no personal data beyond a school name entered by the
 * user. Safe JSON parsing with schema validation and graceful recovery
 * from invalid or outdated records.
 */

const STORAGE_VERSION = 1;

const KEYS = {
  version: 'platepilot.v',
  config: 'platepilot.config',
  plans: 'platepilot.plans',
  env: 'platepilot.env',
} as const;

/** Default environmental factors — 0 means unconfigured. */
export const DEFAULT_ENV_FACTORS: EnvFactors = {
  co2PerMeal: 0,
  waterPerMeal: 0,
  kgPerMeal: 0,
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (raw == null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function readString(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeString(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable (private mode, quota). Fail silently —
    // the app still works in-memory for the session.
  }
}

/** A valid school config has a non-negative attendance and rate in [0,1]. */
function isValidConfig(c: unknown): c is SchoolConfig {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  return (
    typeof o.schoolName === 'string' &&
    typeof o.mealName === 'string' &&
    typeof o.mealCategory === 'string' &&
    typeof o.averageAttendance === 'number' &&
    Number.isFinite(o.averageAttendance) &&
    o.averageAttendance >= 0 &&
    typeof o.historicalParticipationRate === 'number' &&
    Number.isFinite(o.historicalParticipationRate) &&
    o.historicalParticipationRate >= 0 &&
    o.historicalParticipationRate <= 1 &&
    typeof o.foodCostPerMeal === 'number' &&
    typeof o.costOfExcess === 'number' &&
    typeof o.costOfShortage === 'number'
  );
}

/** Validate a single saved plan loosely — drop corrupt records. */
function isValidPlan(p: unknown): p is SavedPlan {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.createdAt === 'number' &&
    typeof o.modelVersion === 'string' &&
    typeof o.date === 'string' &&
    !!o.inputs &&
    !!o.forecast
  );
}

function isValidEnv(e: unknown): e is EnvFactors {
  if (!e || typeof e !== 'object') return false;
  const o = e as Record<string, unknown>;
  return (
    typeof o.co2PerMeal === 'number' &&
    typeof o.waterPerMeal === 'number' &&
    typeof o.kgPerMeal === 'number'
  );
}

export interface PersistedState {
  config: SchoolConfig;
  plans: SavedPlan[];
  env: EnvFactors;
}

/** Load all persisted state, with defaults and recovery. */
export function loadState(): PersistedState {
  // Version check: if the version differs, we could migrate. For now we
  // just keep the version marker so future migrations are possible.
  const version = safeParse(readString(KEYS.version), 0);

  const configRaw = readString(KEYS.config);
  const configParsed = configRaw ? safeParse(configRaw, null) : null;
  const config = isValidConfig(configParsed) ? configParsed : DEMO_SCHOOL_CONFIG;

  const plansRaw = readString(KEYS.plans);
  const plansParsed = plansRaw ? safeParse<unknown[]>(plansRaw, []) : [];
  const plans = Array.isArray(plansParsed)
    ? plansParsed.filter(isValidPlan)
    : [];

  const envRaw = readString(KEYS.env);
  const envParsed = envRaw ? safeParse(envRaw, null) : null;
  const env = isValidEnv(envParsed) ? envParsed : DEFAULT_ENV_FACTORS;

  void version; // reserved for future migrations
  return { config, plans, env };
}

export function saveConfig(config: SchoolConfig): void {
  writeString(KEYS.config, JSON.stringify(config));
}

export function savePlans(plans: SavedPlan[]): void {
  writeString(KEYS.plans, JSON.stringify(plans));
}

export function saveEnv(env: EnvFactors): void {
  writeString(KEYS.env, JSON.stringify(env));
}

export function saveVersion(): void {
  writeString(KEYS.version, JSON.stringify(STORAGE_VERSION));
}
