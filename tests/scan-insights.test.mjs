import test from "node:test";
import assert from "node:assert/strict";
import { localDateKey, periodStart, sumAnalyzedNutrition } from "../lib/scan-insights.mjs";

test("today includes scans earlier in the current local day", () => {
  const now = new Date(2026, 9, 1, 19, 30);
  const start = periodStart(1, now);
  assert.equal(start.getTime(), new Date(2026, 9, 1).getTime());
  assert.ok(new Date(2026, 9, 1, 8).getTime() >= start.getTime());
  assert.equal(periodStart(7, now).getTime(), new Date(2026, 8, 25).getTime());
  assert.equal(localDateKey(new Date(2026, 9, 1, 0, 5)), "2026-10-01");
  assert.equal(localDateKey("invalid"), null);
});

test("history totals retain unknown values and include genuine zero values", () => {
  const totals = sumAnalyzedNutrition([
    { aiData: { nutrition: { label_basis: "per_serving", calories: 120, added_sugar_g: null, sodium_mg: 0 } } },
    { aiData: { nutrition: { label_basis: "per_serving", calories: 80, added_sugar_g: "" } } },
  ]);
  assert.equal(totals.calories, 200);
  assert.equal(totals.has.calories, true);
  assert.equal(totals.has.added_sugar_g, false);
  assert.equal(totals.has.sodium_mg, true);
  assert.equal(totals.sodium_mg, 0);
});

test("history converts known serving quantities and skips unknown bases", () => {
  const totals = sumAnalyzedNutrition([
    { aiData: { nutrition: { label_basis: "per_100g", serving_size: "25 g", calories: 400 } } },
    { aiData: { nutrition: { label_basis: "per_100ml", serving_size: "200 ml", calories: 30 } } },
    { aiData: { nutrition: { label_basis: "unknown", calories: 900 } } },
    { aiData: { nutrition: { label_basis: "per_100g", calories: 800 } } },
  ]);
  assert.equal(totals.calories, 160);
});
