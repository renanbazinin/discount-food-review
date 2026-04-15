#!/usr/bin/env tsx
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isSkippedCategory,
  isGenericCategory,
  isSkippedDish,
  containsTelbank
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

async function processRestaurant(
  cfg: ConfigEntry,
  existingIds: Set<string> | null = null,
  existingNames: Set<string> | null = null
): Promise<OutRestaurant | null> {
  const menu = await fetchMenu(cfg.id);
  if (!menu || !menu.Success) return null;
  const dishes: OutDish[] = [];
  const seen = new Set<number>();
  const report: CategoryReport[] = [];
  const appendMode = existingIds !== null;
  let skippedExisting = 0;

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
      // Skip any dish still carrying a טלבנק marker — phone-only variants are
      // not main courses we want in the catalog.
      if (containsTelbank(dish.dishName)) continue;
      if (appendMode && existingIds!.has(String(dish.dishId))) {
        seen.add(dish.dishId);
        skippedExisting += 1;
        continue;
      }
      seen.add(dish.dishId);
      const img = dish.dishImageUrl ? await downloadImage(dish.dishImageUrl, dish.dishId) : null;
      const rootId = String(dish.dishId);
      const dishName = dish.dishName.trim();
      if (appendMode && existingNames && existingNames.has(dishName.toLowerCase())) {
        console.warn(
          `  ! name collision: restaurant ${cfg.id} already has a dish named "${dishName}" — appending anyway (different dishId ${dish.dishId})`
        );
      }
      dishes.push({
        id: rootId,
        rootId,
        name: dishName,
        description: (dish.dishDescription ?? '').trim(),
        price: dish.dishPrice,
        image: img,
        imageUrl: dish.dishImageUrl ?? null,
        category: cat.categoryName,
        popularity: dish.dishPopularityScore ?? 0,
        isPopular: !!dish.isPopularDish,
        orderMethod: 'regular'
      });
      kept += 1;
    }
    report.push({
      tag: generic ? 'KEEP/filtered' : 'KEEP',
      name: cat.categoryName,
      total: dishList.length,
      kept
    });
  }

  // Within this batch only, dedupe newly-fetched dishes by normalized name so
  // parallel categories (e.g. Take-Away and regular) do not produce duplicates.
  // In append mode this runs against the freshly-fetched batch only; we do not
  // dedupe against historical entries (id-based identity wins — see design.md).
  const seenNames = new Set<string>();
  const deduped: OutDish[] = [];
  for (const d of dishes) {
    const key = d.name.trim().toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    deduped.push(d);
  }
  dishes.length = 0;
  dishes.push(...deduped);

  console.log(`\n${cfg.id}  ${cfg.name}`);
  for (const r of report) {
    console.log(`  ${r.tag.padEnd(14)}  ${r.kept}/${r.total}  ${r.name}`);
  }
  if (appendMode) {
    console.log(`  append         +${dishes.length} new  (${skippedExisting} existing kept)`);
  }
  return { id: cfg.id, name: cfg.name, dishes };
}

async function main() {
  if (!existsSync(CONFIG_PATH)) {
    console.error(`Missing ${CONFIG_PATH}. Create it with [{id, name}, ...] entries.`);
    process.exit(1);
  }
  const appendMode = process.argv.includes('--append');
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as ConfigEntry[];

  console.log(`mode: ${appendMode ? 'append' : 'full-rebuild'}`);

  let existingByRestId: Map<number, OutRestaurant> = new Map();
  if (appendMode) {
    if (!existsSync(OUT_PATH)) {
      console.error(
        `append mode requires an existing ${OUT_PATH} to merge into, but none was found.`
      );
      process.exit(1);
    }
    let parsed: { restaurants: OutRestaurant[] };
    try {
      parsed = JSON.parse(readFileSync(OUT_PATH, 'utf-8')) as { restaurants: OutRestaurant[] };
    } catch (e) {
      console.error(`append mode: failed to parse ${OUT_PATH}:`, e);
      process.exit(1);
    }
    for (const r of parsed.restaurants) existingByRestId.set(r.id, r);
  }

  const restaurants: OutRestaurant[] = [];
  let totalNewAppended = 0;
  for (const cfg of config) {
    if (appendMode) {
      const existing = existingByRestId.get(cfg.id);
      const existingIds = new Set<string>((existing?.dishes ?? []).map((d) => d.id));
      const existingNames = new Set<string>(
        (existing?.dishes ?? []).map((d) => d.name.trim().toLowerCase())
      );
      const r = await processRestaurant(cfg, existingIds, existingNames);
      if (!r) {
        // Fetch failed — keep the existing record untouched if we have one.
        if (existing) restaurants.push(existing);
        continue;
      }
      const merged: OutRestaurant = {
        id: cfg.id,
        name: cfg.name,
        dishes: [...(existing?.dishes ?? []), ...r.dishes]
      };
      totalNewAppended += r.dishes.length;
      restaurants.push(merged);
    } else {
      const r = await processRestaurant(cfg);
      if (r) restaurants.push(r);
    }
  }

  // Preserve any restaurants present in the existing file but not in the
  // current config (defensive — append mode must never drop records).
  if (appendMode) {
    const configIds = new Set(config.map((c) => c.id));
    for (const [id, rest] of existingByRestId.entries()) {
      if (!configIds.has(id)) restaurants.push(rest);
    }
  }

  writeFileSync(OUT_PATH, JSON.stringify({ restaurants }, null, 2), 'utf-8');
  const totalDishes = restaurants.reduce((n, r) => n + r.dishes.length, 0);
  const totalImages = restaurants.reduce(
    (n, r) => n + r.dishes.filter((d) => d.image).length,
    0
  );
  if (appendMode) {
    console.log(
      `\n==> append mode: +${totalNewAppended} new dishes across ${restaurants.length} restaurants (${totalDishes} total now in catalog)`
    );
  } else {
    console.log(`\n==> ${totalDishes} main-course dishes, ${totalImages} images`);
  }
  console.log(`==> wrote ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
