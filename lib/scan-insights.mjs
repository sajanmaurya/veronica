import { toFiniteNumber, toServingNutrition } from "./nutrition.mjs";

export const TRACKED_KEYS = [
  "calories", "added_sugar_g", "saturated_fat_g", "sodium_mg", "fiber_g", "protein_g",
];

export function sumAnalyzedNutrition(searches) {
  const totals = Object.fromEntries(TRACKED_KEYS.map((key) => [key, 0]));
  totals.has = Object.fromEntries(TRACKED_KEYS.map((key) => [key, false]));

  for (const search of searches) {
    const nutrition = toServingNutrition(search?.aiData?.nutrition);
    if (!nutrition) continue;
    for (const key of TRACKED_KEYS) {
      const value = toFiniteNumber(nutrition[key]);
      if (value !== null) {
        totals[key] += value;
        totals.has[key] = true;
      }
    }
  }
  return totals;
}

export function periodStart(days, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Math.max(0, Number(days) - 1));
  return start;
}

export function localDateKey(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
