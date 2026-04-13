export const CATEGORY_SKIP_PATTERNS = [
  'פופולרי',
  'תוספות',
  'תוספת',
  'שתייה',
  'משקאות',
  'משקה',
  'קינוח',
  'מתוק',
  'עוגות',
  'עוגה',
  'גלידה',
  'רטבים',
  'ממרחים',
  'מרק',
  'ילדים',
  'פתיחים',
  'ראשונות'
];

export const GENERIC_CATEGORY_PATTERNS = ['תפריט', 'Take Away', 'טלבנק', 'Grab'];

export const DISH_SKIP_PATTERNS = [
  'בקבוק',
  'פחית',
  'קולה',
  'סודה',
  'ספרייט',
  'פאנטה',
  'מים מינרלים',
  'מים ',
  'זירו',
  'בירה',
  'יין',
  'שייק',
  'סמוזי',
  'נס קפה',
  'קפה',
  ' תה ',
  "צ'יפס",
  'טבעות בצל',
  'תפו"א',
  'ממרח',
  'עוגה',
  'עוגיות',
  'גלידה',
  'קינוח',
  'מוס'
];

export function isSkippedCategory(name: string): boolean {
  return CATEGORY_SKIP_PATTERNS.some((p) => name.includes(p));
}

export function isGenericCategory(name: string): boolean {
  return GENERIC_CATEGORY_PATTERNS.some((p) => name.includes(p));
}

export function isSkippedDish(name: string): boolean {
  return DISH_SKIP_PATTERNS.some((p) => name.includes(p));
}

const TELBANK_CLEAN_RE = /\s*[-–]?\s*["']?\s*טלבנק\s*["']?\s*/gu;

export function cleanTelbankName(name: string): string {
  return name.replace(TELBANK_CLEAN_RE, ' ').replace(/\s+/g, ' ').trim();
}

export function containsTelbank(name: string): boolean {
  return name.includes('טלבנק');
}
