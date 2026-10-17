import { useMemo } from 'react';
import type { DemandPoint } from '@/types';

interface DemandChartProps {
  data: DemandPoint[];
  /** Optional vertical marker for the recommended preparation value. */
  preparationMarker?: number;
  height?: number;
}

/**
 * Lightweight inline SVG distribution chart.
 * No chart library — keeps the bundle lean for Phase 1.
 */
export function DemandChart({
  data,
  preparationMarker,
  height = 200,
}: DemandChartProps) {
  const { bars, markerX } = useMemo(() => {
    if (data.length === 0) {
      return { bars: [], markerX: null as number | null };
    }
    const maxProb = Math.max(...data.map((d) => d.probability), 0.0001);
    const minMeals = Math.min(...data.map((d) => d.meals));
    const maxMeals = Math.max(...data.map((d) => d.meals));
    const range = Math.max(maxMeals - minMeals, 1);

    const width = 100; // viewBox units, scales fluidly
    const pad = 2;
    const innerW = width - pad * 2;
    const computed = data.map((d, i) => {
      const barW = innerW / data.length - 1.5;
      const h = (d.probability / maxProb) * (height - 40);
      return {
        x: pad + (i * innerW) / data.length + barW * 0.25,
        y: height - 24 - h,
        w: barW,
        h,
        meals: d.meals,
        prob: d.probability,
      };
    });

    let mx: number | null = null;
    if (preparationMarker != null) {
      const t = (preparationMarker - minMeals) / range;
      mx = pad + Math.min(Math.max(t, 0), 1) * innerW;
    }
    return { bars: computed, markerX: mx };
  }, [data, preparationMarker, height]);

  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-neutral2-500">
        No distribution data
      </div>
    );
  }

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="h-[200px] w-full"
        role="img"
        aria-label="Predicted meal demand distribution"
      >
        <defs>
          <linearGradient id="demandFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        {/* baseline */}
        <line
          x1="2"
          x2="98"
          y1={height - 24}
          y2={height - 24}
          stroke="#1c3151"
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />
        {bars.map((b) => (
          <g key={b.meals}>
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx="0.8"
              fill="url(#demandFill)"
            />
          </g>
        ))}
        {markerX != null && (
          <line
            x1={markerX}
            x2={markerX}
            y1="6"
            y2={height - 24}
            stroke="#7f98ba"
            strokeWidth="0.6"
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div className="mt-2 flex items-center justify-between text-2xs text-neutral2-500 tabular-nums">
        <span>{Math.round(bars[0]?.meals ?? 0)} meals</span>
        <span className="text-neutral2-400">Predicted demand distribution</span>
        <span>{Math.round(bars[bars.length - 1]?.meals ?? 0)} meals</span>
      </div>
    </div>
  );
}
