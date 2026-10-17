/**
 * Pure statistical helpers for the PlatePilot model.
 *
 * No external dependency. All functions are deterministic and
 * independently testable. They implement the normal-distribution
 * primitives needed for uncertainty-aware preparation optimisation.
 */

/** Clamp a number into [min, max]. */
export function clamp(x: number, min: number, max: number): number {
  if (!Number.isFinite(x)) return min;
  return Math.min(Math.max(x, min), max);
}

/** Return 0 for non-finite or negative inputs, else the value. */
export function safeNonNeg(x: number): number {
  return Number.isFinite(x) && x > 0 ? x : 0;
}

/**
 * Standard normal probability density function.
 * phi(z) = (1/sqrt(2π)) * exp(-z²/2)
 */
export function normalPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

/**
 * Standard normal cumulative distribution function.
 *
 * Uses Abramowitz & Stegun 26.2.17 — a rational polynomial approximation
 * accurate to ~7e-8, which is more than sufficient for meal-level
 * preparation decisions.
 */
export function normalCdf(z: number): number {
  // Handle the tails explicitly for numerical stability.
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  if (z < -8) return 0;
  if (z > 8) return 1;

  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-0.5 * z * z); // phi(0)*exp(...)
  const p =
    d *
    t *
    (0.319381530 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}

/**
 * Inverse standard normal CDF (quantile function).
 *
 * Uses the Acklam algorithm — a rational approximation accurate to
 * ~1.15e-9 across the full (0,1) range. Inputs are clamped to avoid
 * the asymptotes at 0 and 1.
 */
export function inverseNormalCdf(p: number): number {
  const pc = clamp(p, 1e-12, 1 - 1e-12);

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549726517356137, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];

  const plow = 0.02425;
  const phigh = 1 - plow;
  let q: number;
  let r: number;

  if (pc < plow) {
    q = Math.sqrt(-2 * Math.log(pc));
    return (
      ((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]
    ) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (pc <= phigh) {
    q = pc - 0.5;
    r = q * q;
    return (
      (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
    ) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - pc));
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

/**
 * Expected surplus (overproduction) for a normal demand model.
 *
 * E[max(D - Q, 0)] = σ * φ((Q - μ)/σ) + (μ - Q) * (1 - Φ((Q - μ)/σ))
 *
 * where D ~ N(μ, σ²) and Q is the prepared quantity.
 */
export function expectedSurplus(mu: number, sigma: number, Q: number): number {
  if (sigma <= 0 || !Number.isFinite(sigma)) {
    return Math.max(mu - Q, 0);
  }
  const z = (Q - mu) / sigma;
  return sigma * normalPdf(z) + (mu - Q) * (1 - normalCdf(z));
}

/**
 * Expected unmet demand (shortage) for a normal demand model.
 *
 * E[max(Q - D, 0)] ... wait — shortage is demand above preparation:
 * E[max(D - Q, 0)] = σ * φ((Q - μ)/σ) + (μ - Q) * (1 - Φ((Q - μ)/σ))
 *
 * No: shortage = max(D - Q, 0):
 * E[max(D - Q, 0)] = σ * φ((Q - μ)/σ) - (Q - μ) * (1 - Φ((Q - μ)/σ))
 *
 * Let z = (Q - μ)/σ. Then:
 * E[max(D - Q, 0)] = σ * φ(z) - (Q - μ) * (1 - Φ(z))
 */
export function expectedShortage(mu: number, sigma: number, Q: number): number {
  if (sigma <= 0 || !Number.isFinite(sigma)) {
    return Math.max(Q - mu, 0);
  }
  const z = (Q - mu) / sigma;
  return sigma * normalPdf(z) - (Q - mu) * (1 - normalCdf(z));
}

/**
 * P(D > Q) — probability that demand exceeds preparation (shortage risk).
 */
export function shortageProbability(mu: number, sigma: number, Q: number): number {
  if (sigma <= 0 || !Number.isFinite(sigma)) {
    return mu > Q ? 1 : 0;
  }
  return 1 - normalCdf((Q - mu) / sigma);
}

/**
 * Arithmetic mean of a numeric array. Returns 0 for empty input.
 */
export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/**
 * Sample standard deviation (denominator n-1). Returns 0 for <2 points.
 */
export function sampleStdDev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) {
    const d = x - m;
    s += d * d;
  }
  return Math.sqrt(s / (xs.length - 1));
}

/**
 * Sample mean absolute deviation. Returns 0 for empty input.
 */
export function meanAbsDev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += Math.abs(x - m);
  return s / xs.length;
}
