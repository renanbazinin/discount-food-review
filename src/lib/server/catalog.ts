import type { CatalogDataset } from '$lib/types';
import catalogData from '../../../data/restaurants.json';

const dataset = catalogData as CatalogDataset;

const dishIds = new Set<string>();
for (const r of dataset.restaurants) {
  for (const d of r.dishes) {
    dishIds.add(String(d.id));
  }
}

export function hasDish(dishId: string): boolean {
  return dishIds.has(dishId);
}
