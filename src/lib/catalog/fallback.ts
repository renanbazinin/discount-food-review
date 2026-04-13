import type { Dish } from '$lib/types';

export function dishEmoji(dish: Pick<Dish, 'name' | 'category'>): string {
  const hay = `${dish.name} ${dish.category ?? ''}`.toLowerCase();
  if (/סלט|salad|🥗/.test(hay)) return '🥗';
  if (/פיצה|pizza|🍕/.test(hay)) return '🍕';
  if (/פסטה|ספגטי|נודל|נוד|noodle|pasta/.test(hay)) return '🍝';
  if (/המבורגר|burger|צ'יזבורגר/.test(hay)) return '🍔';
  if (/סושי|מאקי|sushi/.test(hay)) return '🍣';
  if (/מרק|soup/.test(hay)) return '🍲';
  if (/אורז|rice/.test(hay)) return '🍚';
  if (/עוף|chicken|שניצל/.test(hay)) return '🍗';
  if (/דג|סלמון|אמנון|טונה|לברק|fish|salmon/.test(hay)) return '🐟';
  if (/בשר|סטייק|steak|meat/.test(hay)) return '🥩';
  if (/כריך|סנדוויץ|sandwich|טוסט/.test(hay)) return '🥪';
  if (/בוריטו|טאקו|burrito|taco/.test(hay)) return '🌯';
  return '🍽️';
}

// Pairs a stable gradient to each dish by hashing its name, so fallback tiles
// are distinguishable from each other instead of a single uniform color.
const GRADIENTS: [string, string][] = [
  ['#ff7a5c', '#b93a22'], // orange
  ['#7c6cff', '#4a2fb9'], // violet
  ['#34c18d', '#1e6b4f'], // green
  ['#ffb347', '#b96a1e'], // amber
  ['#4fb3ff', '#1e57b9'], // blue
  ['#ff5fa2', '#9c1e5a']  // pink
];

export function dishGradient(dish: Pick<Dish, 'id' | 'name'>): { from: string; to: string } {
  const key = dish.id ?? dish.name ?? '';
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const [from, to] = GRADIENTS[Math.abs(h) % GRADIENTS.length];
  return { from, to };
}
