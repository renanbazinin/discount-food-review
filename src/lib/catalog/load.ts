import type { CatalogDataset, Dish, Restaurant } from '$lib/types';

let cache: LoadedCatalog | null = null;

export interface LoadedCatalog {
  dataset: CatalogDataset;
  allDishes(): Dish[];
  getById(id: string): Dish | undefined;
  areTwins(a: Dish, b: Dish): boolean;
}

function deriveRootId(id: string): string {
  if (id.endsWith('-t') || id.endsWith('-r')) return id.slice(0, -2);
  return id;
}

function hydrateRestaurant(r: Restaurant): Restaurant {
  return {
    ...r,
    dishes: r.dishes.map((d) => ({
      ...d,
      rootId: d.rootId || deriveRootId(String(d.id)),
      id: String(d.id),
      restaurantId: r.id,
      restaurantName: r.name,
      orderMethod: d.orderMethod ?? 'regular'
    }))
  };
}

export async function loadCatalog(fetchFn: typeof fetch = fetch): Promise<LoadedCatalog> {
  if (cache) return cache;
  const res = await fetchFn('/restaurants.json');
  if (!res.ok) throw new Error(`Failed to load catalog: ${res.status}`);
  const raw = (await res.json()) as CatalogDataset;
  const dataset: CatalogDataset = {
    restaurants: raw.restaurants.map(hydrateRestaurant)
  };

  const flat = dataset.restaurants.flatMap((r) => r.dishes);
  const index = new Map<string, Dish>();
  for (const d of flat) index.set(d.id, d);

  cache = {
    dataset,
    allDishes: () => flat,
    getById: (id) => index.get(id),
    areTwins: (a, b) => a.rootId === b.rootId
  };
  return cache;
}

export function resetCatalogCache(): void {
  cache = null;
}
