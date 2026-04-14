import type { Dish, MyRating } from '$lib/types';
import type { LoadedCatalog } from '$lib/catalog/load';

// Restaurant IDs deprioritized to the end of the queue because they're
// "build your own" concepts rather than distinct main courses the user
// cares about rating. Right now just בר סלטים (salad bar).
const DEPRIORITIZED_RESTAURANT_IDS = new Set<number>([39158]);

export function getQueue(catalog: LoadedCatalog, myRatings: MyRating[]): Dish[] {
  const rated = new Set(myRatings.map((r) => r.dishId));
  return catalog
    .allDishes()
    .filter((d) => !rated.has(d.id))
    .sort(compareDishes);
}

export function getOrderedAll(catalog: LoadedCatalog): Dish[] {
  return catalog.allDishes().slice().sort(compareDishes);
}

function compareDishes(a: Dish, b: Dish): number {
  const aDemoted = DEPRIORITIZED_RESTAURANT_IDS.has(a.restaurantId);
  const bDemoted = DEPRIORITIZED_RESTAURANT_IDS.has(b.restaurantId);
  if (aDemoted !== bDemoted) return aDemoted ? 1 : -1;
  const pa = a.popularity ?? 0;
  const pb = b.popularity ?? 0;
  if (pa !== pb) return pb - pa;
  return a.id.localeCompare(b.id);
}

export function getNext(
  catalog: LoadedCatalog,
  myRatings: MyRating[],
  skipped: Set<string>
): Dish | null {
  const queue = getQueue(catalog, myRatings);
  const next = queue.find((d) => !skipped.has(d.id));
  return next ?? queue[0] ?? null;
}
