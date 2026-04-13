import type { Dish, RatingAggregate } from '$lib/types';

export interface PickSurpriseOpts {
  minRatings?: number;
  excludeId?: string | null;
}

const DEFAULT_MIN_RATINGS = 2;
const FALLBACK_THRESHOLD = 4;

export function pickSurprise(
  dishes: Dish[],
  aggregates: Map<string, RatingAggregate>,
  opts: PickSurpriseOpts = {}
): Dish | null {
  const minRatings = opts.minRatings ?? DEFAULT_MIN_RATINGS;
  const excludeId = opts.excludeId ?? null;

  const rated = dishes.filter((d) => {
    const a = aggregates.get(d.id);
    return a && a.ratingCount >= 1;
  });
  if (rated.length === 0) return null;

  let eligible: Dish[];
  if (rated.length < FALLBACK_THRESHOLD) {
    eligible = rated;
  } else {
    const qualified = rated.filter((d) => {
      const a = aggregates.get(d.id)!;
      return a.ratingCount >= minRatings;
    });
    const pool = qualified.length > 0 ? qualified : rated;
    const p75 = percentile(
      pool.map((d) => aggregates.get(d.id)!.averageStars),
      0.75
    );
    eligible = pool.filter((d) => aggregates.get(d.id)!.averageStars >= p75);
    if (eligible.length === 0) eligible = pool;
  }

  if (eligible.length === 0) return null;

  let candidates = eligible;
  if (excludeId && eligible.length > 1) {
    candidates = eligible.filter((d) => d.id !== excludeId);
    if (candidates.length === 0) candidates = eligible;
  }

  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx];
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = p * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}
