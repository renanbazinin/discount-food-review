import type { Dish, MyRating } from '$lib/types';
import type { LoadedCatalog } from '$lib/catalog/load';

export function getQueue(catalog: LoadedCatalog, myRatings: MyRating[]): Dish[] {
  const rated = new Set(myRatings.map((r) => r.dishId));
  return catalog
    .allDishes()
    .filter((d) => !rated.has(d.id))
    .sort((a, b) => {
      const pa = a.popularity ?? 0;
      const pb = b.popularity ?? 0;
      if (pa !== pb) return pb - pa;
      return a.id.localeCompare(b.id);
    });
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
