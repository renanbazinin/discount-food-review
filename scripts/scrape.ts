#!/usr/bin/env tsx
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import {
  isSkippedCategory,
  isGenericCategory,
  isSkippedDish,
  containsTelbank,
  cleanTelbankName
} from './classifier.ts';

const ROOT = resolve(import.meta.dirname, '..');
const CONFIG_PATH = resolve(ROOT, 'data/restaurants.config.json');
const OUT_PATH = resolve(ROOT, 'data/restaurants.json');
const IMAGES_DIR = resolve(ROOT, 'data/images');

interface ConfigEntry {
  id: number;
  name: string;
}

interface RawDish {
  dishId: number;
  dishName: string;
  dishDescription?: string | null;
  dishPrice: number;
  dishImageUrl?: string | null;
  isPopularDish?: boolean;
  dishPopularityScore?: number | null;
}

interface RawCategory {
  categoryName: string;
  dishList?: RawDish[];
}

interface MenuResponse {
  Success: boolean;
  Data: { resId: number; categoriesList: RawCategory[] };
}

interface OutDish {
  id: string;
  rootId: string;
  name: string;
  description: string;
  price: number;
  image: string | null;
  imageUrl: string | null;
  category: string;
  popularity: number;
  isPopular: boolean;
  orderMethod: 'regular' | 'telbank';
}

interface OutRestaurant {
  id: number;
  name: string;
  dishes: OutDish[];
}

async function fetchMenu(id: number): Promise<MenuResponse | null> {
  const url = `https://www.10bis.co.il/NextApi/getRestaurantMenu?restaurantId=${id}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) {
      console.warn(`  ! HTTP ${res.status} for ${id}`);
      return null;
    }
    return (await res.json()) as MenuResponse;
  } catch (e) {
    console.warn(`  ! fetch failed for ${id}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

async function downloadImage(url: string, dishId: number): Promise<string | null> {
  if (!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR, { recursive: true });
  const extMatch = url.match(/\.(jpg|jpeg|png|webp)(\?|$)/i);
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '.jpg';
  const rel = `images/${dishId}${ext}`;
  const abs = resolve(ROOT, 'data', rel);
  if (existsSync(abs)) return rel;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`  ! image HTTP ${res.status} for dish ${dishId}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(abs, buf);
    return rel;
  } catch (e) {
    console.warn(`  ! image failed for dish ${dishId}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

interface CategoryReport {
  tag: 'SKIP' | 'KEEP' | 'KEEP/filtered';
  name: string;
  total: number;
  kept: number;
}

async function processRestaurant(cfg: ConfigEntry): Promise<OutRestaurant | null> {
  const menu = await fetchMenu(cfg.id);
  if (!menu || !menu.Success) return null;
  const dishes: OutDish[] = [];
  const seen = new Set<number>();
  const report: CategoryReport[] = [];

  for (const cat of menu.Data.categoriesList) {
    const dishList = cat.dishList ?? [];
    if (isSkippedCategory(cat.categoryName)) {
      report.push({ tag: 'SKIP', name: cat.categoryName, total: dishList.length, kept: 0 });
      continue;
    }
    const generic = isGenericCategory(cat.categoryName);
    let kept = 0;
    for (const dish of dishList) {
      if (seen.has(dish.dishId)) continue;
      if (generic && isSkippedDish(dish.dishName)) continue;
      seen.add(dish.dishId);
      const img = dish.dishImageUrl ? await downloadImage(dish.dishImageUrl, dish.dishId) : null;
      const rootId = String(dish.dishId);
      const base: OutDish = {
        id: rootId,
        rootId,
        name: dish.dishName.trim(),
        description: (dish.dishDescription ?? '').trim(),
        price: dish.dishPrice,
        image: img,
        imageUrl: dish.dishImageUrl ?? null,
        category: cat.categoryName,
        popularity: dish.dishPopularityScore ?? 0,
        isPopular: !!dish.isPopularDish,
        orderMethod: 'regular'
      };
      if (containsTelbank(dish.dishName)) {
        dishes.push({ ...base, id: `${rootId}-t`, orderMethod: 'telbank' });
        dishes.push({
          ...base,
          id: `${rootId}-r`,
          name: cleanTelbankName(dish.dishName),
          orderMethod: 'regular'
        });
        kept += 2;
      } else {
        dishes.push(base);
        kept += 1;
      }
    }
    report.push({
      tag: generic ? 'KEEP/filtered' : 'KEEP',
      name: cat.categoryName,
      total: dishList.length,
      kept
    });
  }

  console.log(`\n${cfg.id}  ${cfg.name}`);
  for (const r of report) {
    console.log(`  ${r.tag.padEnd(14)}  ${r.kept}/${r.total}  ${r.name}`);
  }
  return { id: cfg.id, name: cfg.name, dishes };
}

async function main() {
  if (!existsSync(CONFIG_PATH)) {
    console.error(`Missing ${CONFIG_PATH}. Create it with [{id, name}, ...] entries.`);
    process.exit(1);
  }
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as ConfigEntry[];
  const restaurants: OutRestaurant[] = [];
  for (const cfg of config) {
    const r = await processRestaurant(cfg);
    if (r) restaurants.push(r);
  }
  writeFileSync(OUT_PATH, JSON.stringify({ restaurants }, null, 2), 'utf-8');
  const totalDishes = restaurants.reduce((n, r) => n + r.dishes.length, 0);
  const totalImages = restaurants.reduce(
    (n, r) => n + r.dishes.filter((d) => d.image).length,
    0
  );
  console.log(`\n==> ${totalDishes} main-course dishes, ${totalImages} images`);
  console.log(`==> wrote ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
