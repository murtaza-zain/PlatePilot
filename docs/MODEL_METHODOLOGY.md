# PlatePilot — Model Methodology

This document describes the formulas and assumptions used by the PlatePilot forecasting engine, derived from the actual source code in `src/model/stats.ts`, `src/model/engine.ts`, and `src/model/simulation.ts`. It is not a design spec — it is a faithful description of what the code computes.

---

## 1. Demand Estimation

### Expected attendance

```
attendance = clamp(config.averageAttendance, 0, 100000)
```

For counterfactuals, attendance is overridden as:

```
scenarioAttendance = baseAttendance × (1 + attendanceChange)
```

### Participation rate

When fewer than 5 completed observations exist, the configured rate is used directly:

```
rate = clamp(config.historicalParticipationRate, 0, 1)
```

When 5+ completed observations exist, the historical demand-to-attendance ratio is blended with the configured rate:

```
historicalRate = clamp(mean(actualDemand / attendance for each observation), 0, 1)
weight = min(usableCount / 12, 1) × 0.6
rate = clamp(configuredRate × (1 − weight) + historicalRate × weight, 0, 1)
```

An observation is "usable" if `completed === true`, `attendance` is finite and positive, and `actualDemand` is finite and non-negative.

### Expected demand

```
effectiveRate = clamp(rate × popularityMultiplier, 0, 1)
expectedDemand = (attendance × effectiveRate) / portionMultiplier
```

Portion size is a divisor: larger portions (`portionMultiplier > 1`) reduce servings needed. Popularity multiplies the participation rate. Both are clamped to safe ranges.

---

## 2. Uncertainty (Standard Deviation)

### Historical estimation (5+ observations)

The demand-to-attendance ratio variability is the primary component:

```
ratios = [actualDemand / attendance for each usable observation]
ratioStd = sampleStdDev(ratios)          // denominator n−1
ratioComponent = ratioStd × meanDemand
```

An absolute residual component is added to capture noise not explained by the ratio:

```
absResiduals = [actualDemand − predictedDemand for each observation]
absComponent = meanAbsDev(absResiduals)
```

Combined in quadrature:

```
stdDev = sqrt(ratioComponent² + absComponent²)
```

### Fallback (fewer than 5 observations)

```
stdDev = meanDemand × 0.12
```

This is the **fallback coefficient of variation** (`FALLBACK_CV = 0.12`). It is a documented provisional assumption, not a validated confidence interval. The forecast reports `uncertaintyBasis: 'fallback'` when this is used.

### Minimum sigma

```
sigma = max(stdDev, 0.0001)
```

This prevents division-by-zero in downstream calculations without meaningfully changing results.

---

## 3. Cost-Sensitive Preparation Optimisation

### The newsvendor critical fractile

For demand D ~ N(μ, σ²), the quantity Q minimising expected total cost satisfies:

```
Φ((Q − μ) / σ) = costShortage / (costShortage + costExcess)
```

where Φ is the standard normal CDF.

### Solution

```
fractile = clamp(costShortage / (costShortage + costExcess), 0, 1)
z = Φ⁻¹(fractile)                    // inverse normal CDF (Acklam algorithm)
rawOptimum = μ + σ × z
quantity = round(clamp(rawOptimum, 0, attendance))
```

The quantity is rounded to a whole serving (you cannot prepare a fractional meal) and clamped to `[0, attendance]` since one cannot serve more meals than students present.

### Degenerate cost handling

When `costExcess + costShortage` is zero, negative, or non-finite:

```
quantity = round(clamp(μ, 0, attendance))
```

The recommendation falls back to expected demand with no cost-based buffer.

---

## 4. Statistical Primitives

All are implemented in `src/model/stats.ts`.

### Normal PDF

```
φ(z) = (1 / √(2π)) × exp(−z² / 2)
```

### Normal CDF (Abramowitz & Stegun 26.2.17)

A rational polynomial approximation accurate to ~7e-8. Tails beyond ±8σ are clamped to 0 and 1 for numerical stability.

### Inverse Normal CDF (Acklam algorithm)

A rational approximation accurate to ~1.15e-9 across the full (0,1) range. Inputs are clamped to `[1e-12, 1 − 1e-12]` to avoid asymptotes.

### Expected surplus (overproduction)

```
E[max(Q − D, 0)] = σ × φ(z) + (μ − Q) × (1 − Φ(z))
```

where `z = (Q − μ) / σ`. When σ = 0, returns `max(μ − Q, 0)`.

### Expected shortage (unmet demand)

```
E[max(D − Q, 0)] = σ × φ(z) − (Q − μ) × (1 − Φ(z))
```

When σ = 0, returns `max(Q − μ, 0)`.

### Shortage probability

```
P(D > Q) = 1 − Φ((Q − μ) / σ)
```

When σ = 0, returns 1 if μ > Q, else 0.

---

## 5. Prediction Interval

The central 80% prediction interval:

```
intervalLow  = max(0, μ − 1.2816σ)
intervalHigh = μ + 1.2816σ
```

where 1.2816 is `Φ⁻¹(0.90)`, the 90th percentile of the standard normal.

---

## 6. Cost Outputs

At the recommended preparation quantity Q:

```
expectedExcessCost   = expectedSurplus(μ, σ, Q) × costExcess
expectedShortageCost = expectedShortage(μ, σ, Q) × costShortage
totalModelledCost    = expectedExcessCost + expectedShortageCost
```

---

## 7. Counterfactual Scenarios

Counterfactuals are computed by calling the same `forecast()` function with adjusted inputs — no separate model logic:

```
scenarioAttendance    = baseAttendance × (1 + attendanceChange)
popularityMultiplier  = 1 + menuPopularityChange
portionMultiplier     = 1 + portionSizeChange
```

The baseline forecast object is passed in but never mutated. A fresh `ForecastResult` is returned.

### Comparison rows

`comparePlans()` produces side-by-side metrics. Donation capacity affects only the **net food waste** row:

```
donated   = min(expectedLeftover, donationCapacity)
netWaste  = max(0, expectedLeftover − donated)
```

Donation does not affect demand, preparation, or shortage probability.

---

## 8. Impact Computation

Compares the PlatePilot recommendation against a **fixed-buffer baseline** (expected demand + 10%), over a configurable number of days.

Both policies use the same demand model (μ, σ) and the same cost structure:

```
baselinePrepared = clamp(round(μ × 1.10), 0, attendance)
ppPrepared       = recommendedPreparation

ppSurplus    = expectedSurplus(μ, σ, ppPrepared)
baseSurplus  = expectedSurplus(μ, σ, baselinePrepared)
ppUnmet      = expectedShortage(μ, σ, ppPrepared)
baseUnmet    = expectedShortage(μ, σ, baselinePrepared)

ppCost   = (ppSurplus × costExcess + ppUnmet × costShortage) × days
baseCost = (baseSurplus × costExcess + baseUnmet × costShortage) × days
```

### Signed cost difference

```
costDifference = baseCost − ppCost
```

**Positive** means PlatePilot is modelled as cheaper. **Negative** means PlatePilot is modelled as more expensive. The sign is preserved honestly — negative differences are not converted into savings.

### Environmental factors

Environmental estimates are computed only when at least one factor is configured (non-zero):

```
envConfigured = (co2PerMeal > 0) OR (waterPerMeal > 0) OR (kgPerMeal > 0)

wasteDiff = max(0, baselineNetWaste − platePilotNetWaste)

co2AvoidedKg       = envConfigured && co2PerMeal > 0  ?  wasteDiff × co2PerMeal  :  0
waterAvoidedL      = envConfigured && waterPerMeal > 0 ?  wasteDiff × waterPerMeal :  0
foodWasteAvoidedKg = envConfigured && kgPerMeal > 0   ?  wasteDiff × kgPerMeal    :  0
```

PlatePilot does not bundle default environmental coefficients.

---

## 9. Monte Carlo Validation Simulation

### PRNG

Uses `mulberry32`, a small deterministic PRNG seeded with a user-provided integer. The same seed always produces the same sequence.

### Demand generation

For each trial, a standard normal sample is generated via the Box-Muller transform:

```
u1 = rng()  (clamped to ≥ 1e-12)
u2 = rng()
z = sqrt(−2 × ln(u1)) × cos(2π × u2)
demand = max(0, μ + σ × z)
```

### Paired comparison

Both policies see the **same demand draw** in each trial:

```
baselineExcess = max(baselineQuantity − demand, 0)
baselineUnmet  = max(demand − baselineQuantity, 0)
ppExcess       = max(ppQuantity − demand, 0)
ppUnmet        = max(demand − ppQuantity, 0)
```

Costs accumulate per trial:

```
baseCost += baselineExcess × costExcess + baselineUnmet × costShortage
ppCost   += ppExcess × costExcess + ppUnmet × costShortage
```

A shortage day is counted when unmet demand exceeds 0.5 meals.

### Output

```
avgExcess          = totalExcess / trials
avgUnmet           = totalUnmet / trials
shortageFrequency  = shortageDays / trials
avgCost            = totalCost / trials
totalCost          = sum of per-trial costs

costDifference = baselineTotalCost − platePilotTotalCost
wasteDifference = baselineTotalExcess − platePilotTotalExcess
```

### Observed validation (separate from simulation)

Computed from completed observations only (saved plans with actual demand entered):

```
completed = observations where completed === true, predictedDemand finite, actualDemand finite
if completed.length < 3: return null

errors = [actualDemand − predictedDemand for each completed observation]
mae    = mean(|errors|)
bias   = mean(errors)
```

Observed metrics are displayed in a separate UI section from the simulation results and are never conflated with them.

---

## 10. Persistence

### Storage keys

```
platepilot.v      — storage version (integer)
platepilot.config — SchoolConfig JSON
platepilot.plans  — SavedPlan[] JSON
platepilot.env    — EnvFactors JSON
```

### Schema validation

On load, each persisted object is validated:

- **Config**: checks field types, finite non-negative attendance, participation rate in [0,1]. Invalid config falls back to the demo configuration.
- **Plans**: checks for required `id`, `createdAt`, `modelVersion`, `date`, `inputs`, `forecast` fields. Corrupt individual plans are filtered out; valid plans are retained.
- **Env**: checks numeric fields. Invalid env falls back to all-zeros (unconfigured).

This means invalid, outdated, or partially corrupt localStorage data does not crash the application — it degrades gracefully to defaults.

### Plan versioning

Each saved plan stores `modelVersion` (currently `'pp-0.2.0'`) so future model changes can detect and migrate older plans.

---

## Key Assumptions Summary

| Assumption | Value | Source |
|---|---|---|
| Demand distribution | Normal (Gaussian) | Model design |
| Fallback coefficient of variation | 12% of mean demand | `FALLBACK_CV = 0.12` |
| Min observations for historical variability | 5 | `MIN_HISTORY_FOR_VARIABILITY = 5` |
| Historical blend ceiling | 60% weight at 12+ observations | `HISTORY_BLEND = 0.6` |
| Prediction interval | Central 80% (±1.282σ) | `Z_80 = 1.2815515655446004` |
| Baseline policy | Expected demand + 10% buffer | `BASELINE_METHOD` |
| Default simulation | 1000 trials, seed 42, 10% buffer | `DEFAULT_SIMULATION` |
| Serving granularity | Whole meals (integer rounding) | `Math.round` in optimisation |

All of these are documented assumptions, not fitted or validated parameters. They are chosen to be transparent and reasonable for a prototype, and every one is visible in the source code.
