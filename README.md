# PlatePilot

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-jrxxnreu)

**Predict before you prepare.**

PlatePilot is a prototype decision-support tool for school cafeteria managers. It estimates how many meals to prepare for an upcoming service, balances the cost of overproduction against the cost of running short, and lets operators explore what-if scenarios — all through a transparent, uncertainty-aware model rather than a trained machine-learning system.

---

## The Problem

School cafeterias routinely over-produce food to avoid shortages, generating avoidable waste and cost. The kitchen team typically picks a preparation quantity by habit or a flat buffer above expected demand. That heuristic ignores both the natural variability of daily demand and the relative cost of over- vs. under-production: if a wasted meal is cheap but a hungry student is costly, the optimal buffer is larger than a naive 10% rule would suggest.

---

## The Solution

PlatePilot replaces the flat-buffer heuristic with a **cost-sensitive preparation optimisation** grounded in the newsvendor model. The operator enters:

- Average daily attendance
- Historical participation rate (share of students who take this meal)
- Cost of excess (per meal prepared but not served)
- Cost of shortage (per meal of unmet demand)

The engine estimates expected demand, quantifies uncertainty, and recommends a preparation quantity that minimises the expected combined cost of overproduction and shortage. Every recommendation is accompanied by a plain-language rationale, a shortage-risk percentage, and an 80% prediction interval so the operator can judge confidence.

### Intended Users

Cafeteria managers, school nutrition coordinators, or anyone responsible for deciding how many servings to prepare for a seated meal service. No statistical background is required to use the interface.

---

## How the Forecasting Model Works

### Demand Estimation

Expected demand is calculated as:

```
expectedDemand = averageAttendance × participationRate
```

When enough completed historical observations exist (5 or more), the participation rate is blended from the configured rate and the historically observed demand-to-attendance ratio. The blend weight scales with the amount of available history, up to a 60% historical weight at 12+ observations. With fewer than 5 observations, the configured rate is used directly.

Portion size is handled as a divisor: larger portions reduce the number of servings needed for the same student appetite.

### Cost-Sensitive Optimisation

For demand modelled as a normal distribution D ~ N(μ, σ²), the preparation quantity Q that minimises expected cost satisfies the **critical fractile** (newsvendor optimum):

```
Φ((Q − μ) / σ) = costShortage / (costShortage + costExcess)
```

Solved via the inverse normal CDF. Q is rounded to a whole serving and clamped to `[0, attendance]` since one cannot serve more meals than students present.

When costs are zero, negative, or non-finite, the engine falls back to expected demand with no cost-based buffer.

For the full mathematical detail, see [docs/MODEL_METHODOLOGY.md](docs/MODEL_METHODOLOGY.md).

---

## The Uncertainty Model

Demand is modelled as normally distributed around the expected mean. The standard deviation (σ) is estimated in one of two ways:

1. **Historical** — when 5+ completed observations exist, σ is derived from the sample standard deviation of the demand-to-attendance ratio, scaled to the current mean, combined with the mean absolute deviation of residuals.
2. **Fallback** — when fewer than 5 observations are available, σ = expectedDemand × 0.12 (a provisional coefficient of variation of 12%). This is a documented assumption, not a validated confidence interval.

The forecast reports which basis was used (`historical`, `fallback`, or `insufficient-data`) so the operator always knows whether the uncertainty estimate comes from real data or an assumption.

An 80% prediction interval is reported as `[μ − 1.282σ, μ + 1.282σ]`.

---

## Counterfactual Lab

The Counterfactual Lab lets operators explore what-if scenarios without altering their saved baseline. Four sliders control:

- **Attendance change** — relative change to expected attendance (−30% to +30%)
- **Menu popularity change** — relative change to the participation rate (−30% to +30%)
- **Portion-size change** — relative change to portion size (−20% to +20%); larger portions reduce servings needed
- **Donation capacity** — meals that can be donated rather than wasted (0–120)

The scenario forecast is computed as a fresh call to the forecasting engine with the adjusted inputs. The baseline is never mutated. A side-by-side comparison table shows the delta across demand, preparation, surplus, shortage probability, cost, donated meals, and net food waste.

Donation capacity affects **net waste**, not student demand — it diverts surplus from disposal after the service, not before it.

---

## Validation Lab

The Validation Lab compares two policies using a **deterministic Monte Carlo simulation**:

- **Baseline policy**: prepare expected demand + 10% buffer
- **PlatePilot policy**: cost-optimised quantity from the engine

Both policies are evaluated against the **same sequence of simulated daily demand draws**, making the comparison paired and repeatable. Random draws use a mulberry32 PRNG seeded with a user-provided integer, so the same seed and configuration always produce identical results.

The simulation reports average excess servings, average unmet demand, shortage frequency, average cost, and total cost for each policy, plus signed cost and waste differences.

### Simulated Results vs. Observed Real-World Data

A critical distinction is maintained throughout the application:

- **Simulated** results come from the Monte Carlo engine under stated distributional assumptions. They are model-based estimates, not evidence of measured real-world food-waste reduction or cafeteria savings. A mandatory disclaimer stating this is shown on the Validation page.
- **Observed** results come only from saved forecast plans where the operator has entered the actual demand that occurred. Observed validation (mean absolute error and bias) requires at least 3 completed observations and is displayed in a visually separate section from the simulation output.

The two are never conflated. The application does not claim that simulation results prove real-world savings.

---

## Environmental Impact

Environmental conversion factors (CO₂e per wasted meal, litres of water per wasted meal, kg of food per wasted meal) are **not bundled with defaults**. The Impact page reports environmental estimates only when the operator explicitly configures these factors, sourced from their own data or a cited reference. When factors are unconfigured, the page reports them as unavailable rather than inventing coefficients.

---

## Technology Stack

| Layer | Technology |
|---|---|
| UI framework | React 18 |
| Language | TypeScript 5.5 (strict mode) |
| Build tool | Vite 5.4 |
| Styling | Tailwind CSS 3.4 |
| Icons | lucide-react |
| Router | Custom hash-based router (no external dependency) |
| State | React Context + hooks (shared `AppStateProvider`) |
| Persistence | Browser localStorage (versioned, schema-validated) |
| Testing | `tsx` + `node:assert` (self-contained, no test framework) |

No backend server, database, or external API is required. All computation runs in the browser.

---

## Architecture

```
src/
├── App.tsx                      # Root: wraps app in AppStateProvider, routes
├── router.ts                    # Minimal hash-based router (7 routes)
│
├── components/
│   ├── Sidebar.tsx              # Navigation + PageShell layout wrapper
│   └── ui/                      # Reusable UI primitives (Button, Card, etc.)
│
├── pages/                       # One file per route
│   ├── LandingPage.tsx
│   ├── SetupPage.tsx            # School config input → shared state
│   ├── ForecastPage.tsx         # Live forecast + save plan
│   ├── CounterfactualPage.tsx   # What-if sliders + comparison
│   ├── ImpactPage.tsx           # Modelled impact vs. baseline
│   ├── ValidationPage.tsx       # Monte Carlo simulation + observed data
│   └── HistoryPage.tsx          # Saved plans + observation entry
│
├── state/
│   └── AppStateContext.tsx      # Single shared provider: config, plans,
│                                #   env, observations, live forecast
│
├── model/                       # Pure, deterministic, independently testable
│   ├── stats.ts                 # Normal PDF/CDF/inverse-CDF, surplus/shortage
│   ├── engine.ts                # Forecast, optimisation, counterfactual, impact
│   ├── simulation.ts            # Seeded Monte Carlo, observed validation
│   └── __tests__/model.test.ts  # 47 automated tests
│
├── lib/
│   ├── storage.ts               # Versioned localStorage with schema validation
│   └── cn.ts                    # Classname merge utility
│
├── data/
│   └── demoData.ts              # Seed config, slider defaults, demo history rows
│
└── types/
    └── index.ts                 # All shared domain types
```

### Separation of Concerns

| Concern | Location | Responsibility |
|---|---|---|
| **UI** | `pages/`, `components/` | Rendering, user interaction, form validation |
| **Shared state** | `state/AppStateContext.tsx` | Single source of truth for config, plans, env, observations; derives live forecast |
| **Storage** | `lib/storage.ts` | Versioned localStorage with safe JSON parsing, schema validation, graceful recovery from corrupt data |
| **Forecasting** | `model/engine.ts` | Demand estimation, participation blending, cost-sensitive optimisation, counterfactual scenarios, impact computation |
| **Statistics** | `model/stats.ts` | Normal distribution primitives (PDF, CDF, inverse CDF), expected surplus/shortage, summary statistics |
| **Simulation** | `model/simulation.ts` | Deterministic Monte Carlo with mulberry32 PRNG, observed validation from completed plans |

Model functions are **pure**: given the same inputs, they always produce the same outputs. They have no side effects and no access to React state. This makes them independently testable without rendering any UI.

---

## Installation

```bash
npm install
```

Requires Node.js 18+.

## Development

```bash
npm run dev
```

Starts the Vite dev server with hot module replacement.

## Testing

```bash
npm run test
```

Runs 47 automated tests against the real exported model functions using `tsx` (TypeScript execution) and `node:assert/strict`. No external test framework. Tests cover:

- **Cost-sensitive optimisation** (7 tests): finite recommendations, cost direction, serving bounds, whole-serving rounding, invalid-cost fallback, fractile correctness.
- **Statistical helpers** (12 tests): normal PDF/CDF/inverse-CDF reference values, probability bounds, non-negative surplus/shortage, zero-sigma edge cases, fallback CV, interval ordering, clamp/safeNonNeg, mean/sampleStdDev/meanAbsDev.
- **Counterfactuals** (5 tests): attendance/popularity/portion effects, baseline immutability, donation affects waste not demand.
- **Simulation** (6 tests): deterministic same-seed results, finite bounds, paired comparison, invalid config safety, observed/simulated separation, PRNG determinism.
- **Persistence & observations** (6 tests): completed-only filtering, missing-not-zero, observed validation thresholds, incomplete record handling.
- **Impact** (3 tests): honest signed cost difference, env factors only when configured, no fabricated CO₂.
- **Engine integration** (3 tests): invalid config safety, attendance/rate changes propagate to forecast.

These are automated unit tests of model logic. No browser-level or end-to-end UI tests were performed.

## Linting

```bash
npm run lint
```

Runs ESLint with TypeScript-eslint. One non-blocking warning is expected: `react-refresh/only-export-components` on `AppStateContext.tsx`, which is inherent to React context files that export both a provider component and a `useAppState` hook.

## Typechecking

```bash
npm run typecheck
```

Runs `tsc --noEmit` with strict mode enabled. Zero errors expected.

## Production Build

```bash
npm run build
```

Builds the production bundle via Vite into `dist/`.

---

## Current Limitations

- **Not a trained ML model.** PlatePilot is an uncertainty-aware demand estimation and cost-sensitive optimisation model. It does not learn from data in the machine-learning sense; it uses a documented statistical approach (newsvendor critical fractile under a normal demand assumption).
- **No real-world field trial.** The Impact and Validation results are model-based estimates under stated assumptions. They are not evidence of measured real-waste reduction or cafeteria savings. The application makes this distinction explicitly in its UI and disclaimers.
- **Normal distribution assumption.** Demand is modelled as normally distributed. Real cafeteria demand may be skewed (e.g. by weather, events, or day-of-week effects) in ways the model does not capture.
- **Fallback uncertainty.** With fewer than 5 completed historical observations, variability is estimated as 12% of mean demand — a provisional assumption, not a validated confidence interval.
- **No external data sources.** Environmental conversion factors, cost figures, and participation rates are entered by the operator. PlatePilot does not bundle or fetch external datasets.
- **Browser-only persistence.** All data is stored in the browser's localStorage. There is no server-side database, account system, or cross-device sync.
- **Single-meal planning.** The model plans one meal at a time. Multi-meal or multi-station coordination is not supported.

---

## Repository

GitHub: `murtaza-zain/PlatePilot`

The repository has not been verified as synced or made public as part of this documentation task. That action, if needed, must be performed and confirmed separately.

---

## License

Prototype for educational and evaluation purposes. No warranty is provided regarding the accuracy of modelled estimates for real-world operational decisions.
