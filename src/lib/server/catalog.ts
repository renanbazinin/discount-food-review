import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CatalogDataset } from '$lib/types';

let cache: Set<string> | null = null;

function load(): Set<string> {
  if (cache) return cache;
  const path = resolve(process.cwd(), 'data/restaurants.json');
  const raw = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(raw) as CatalogDataset;
  cache = new Set();
  for (const r of parsed.restaurants) {
    for (const d of r.dishes) {
      cache.add(String(d.id));
    }
  }
  return cache;
}

export function hasDish(dishId: string): boolean {
  return load().has(dishId);
}
