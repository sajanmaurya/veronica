import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  comparableNutrition, createNutritionSummary, normalizeNutrition,
  nutritionFromOpenFoodFacts, offNutritionBasis, parseServingSize,
  toFiniteNumber, toServingNutrition,
  nutritionBasisLabel,
} from "../lib/nutrition.mjs";

test("unsupported stored nutrition bases render as unavailable text", () => {
  for (const basis of ["__proto__", "constructor", "toString", null, {}, "unknown"]) {
    assert.equal(nutritionBasisLabel(basis), "Nutrition basis unavailable");
  }
});

test("missing, empty, invalid and boolean values stay unavailable", () => {
  for (const value of [null, undefined, "", " ", "Unknown", NaN, Infinity, false, [], {}]) {
    assert.equal(toFiniteNumber(value), null);
  }
  assert.equal(toFiniteNumber(0), 0);
  assert.equal(toFiniteNumber("0"), 0);
  assert.equal(toFiniteNumber("0.42"), 0.42);
});

test("normalization preserves missing values and does not claim verified evidence", () => {
  const result = normalizeNutrition({ label_basis: "per_serving", serving_size: "30 g", total_fat_g: null });
  assert.equal(result.nutrition.total_fat_g, null);
  assert.equal(result.nutrition.calories, null);
  assert.equal(result.validation.status, "needs_verification");
  assert.ok(result.validation.missing_fields.includes("total_fat_g"));
  assert.doesNotThrow(() => normalizeNutrition(null));
});

test("fat and carbohydrate subcomponents are not counted twice", () => {
  const result = normalizeNutrition({
    label_basis: "per_serving", serving_size: "50 g", calories: 255,
    total_fat_g: 15, saturated_fat_g: 10, trans_fat_g: 1,
    carbohydrates_g: 25, total_sugar_g: 20, added_sugar_g: 18,
    protein_g: 5, fiber_g: 2,
  });
  assert.equal(result.nutrition.total_fat_g, 15);
  assert.equal(result.nutrition.label_basis, "per_serving");
  assert.equal(result.validation.status, "checked");
  assert.match(result.validation.message, /does not verify/);
});

test("an implausible explicit serving is flagged instead of heuristically converted", () => {
  const result = normalizeNutrition({
    label_basis: "per_serving", serving_size: "30 g", calories: 452,
    total_fat_g: 20, carbohydrates_g: 60, protein_g: 8,
    saturated_fat_g: 8, trans_fat_g: 2, total_sugar_g: 30,
  });
  assert.equal(result.nutrition.total_fat_g, 20);
  assert.equal(result.nutrition.carbohydrates_g, 60);
  assert.equal(result.nutrition.label_basis, "per_serving");
  assert.equal(result.validation.status, "needs_verification");
});

test("explicit per-100 g display stays on its source basis", () => {
  const result = normalizeNutrition({ label_basis: "per_100g", serving_size: "25 g", total_sugar_g: 20 });
  assert.equal(result.nutrition.total_sugar_g, 20);
  assert.equal(result.nutrition.label_basis, "per_100g");
});

test("Open Food Facts hyphenated nutrients and grams of sodium normalize correctly", () => {
  const nutrition = nutritionFromOpenFoodFacts({
    serving_size: "30 g",
    nutrients_per_100g: { "energy-kcal": 420, "saturated-fat": 4.5, "trans-fat": 0, sodium: 0.36, sugars: 12, proteins: 6 },
  });
  assert.equal(nutrition.label_basis, "per_100g");
  assert.equal(nutrition.calories, 420);
  assert.equal(nutrition.saturated_fat_g, 4.5);
  assert.equal(nutrition.trans_fat_g, 0);
  assert.equal(nutrition.sodium_mg, 360);
  assert.equal(nutrition.added_sugar_g, null);
});

test("normalized OFF sodium remains grams even when the input display unit was mg", () => {
  const nutrition = nutritionFromOpenFoodFacts({
    serving_size: "30 g", nutriments: { sodium_100g: 0.2, sodium_unit: "mg", "energy-kcal_100g": 300 },
  });
  assert.equal(nutrition.sodium_mg, 200);
  assert.equal(nutrition.calories, 300);
});

test("kilojoules convert only when kcal is unavailable", () => {
  const product = { serving_size: "25 g", nutrients_per_100g: { energy: 418.4 } };
  assert.equal(nutritionFromOpenFoodFacts(product).calories, 100);
  product.nutrients_per_100g["energy-kcal"] = 0;
  assert.equal(nutritionFromOpenFoodFacts(product).calories, 0);
});

test("OFF missing sodium is not represented as zero", () => {
  const product = { serving_size: "25 g", nutrients_per_100g: { sodium: null, sugars: 0 } };
  assert.equal(nutritionFromOpenFoodFacts(product).sodium_mg, null);
  assert.equal(comparableNutrition(product).sodium, null);
  assert.equal(comparableNutrition(product).sugar, 0);
});

test("photo and database comparison use the same sodium unit", () => {
  const photo = comparableNutrition({ nutrition: { label_basis: "per_serving", serving_size: "25 g", sodium_mg: 100 } });
  const database = comparableNutrition({ serving_size: "25 g", nutrients_per_100g: { sodium: 0.4 } });
  assert.equal(photo.sodium, 400);
  assert.equal(photo.sodium, database.sodium);
  assert.equal(photo.basis, database.basis);
});

test("liquid comparisons keep their volume basis", () => {
  const photo = comparableNutrition({ nutrition: { label_basis: "per_serving", serving_size: "250 ml", sodium_mg: 50, total_sugar_g: 20 } });
  const database = comparableNutrition({ serving_size: "250 ml", nutriments: { sodium_100g: 0.02, sugars_100g: 8 } });
  assert.equal(photo.basis, "per_100ml");
  assert.equal(database.basis, "per_100ml");
  assert.equal(photo.sodium, database.sodium);
  assert.equal(photo.sugar, 8);
});

test("missing basis and ambiguous serving do not become comparable data", () => {
  assert.equal(offNutritionBasis({ nutrition_data_per: "100g" }), "unknown");
  assert.equal(comparableNutrition({ nutrients_per_100g: { sodium: 0.3 } }), null);
  assert.equal(comparableNutrition({ nutrition: { label_basis: "per_serving", sodium_mg: 50 } }), null);
  assert.equal(parseServingSize("1 cup (240 ml / 250 g)"), null);
});

test("serving totals convert only known matching mass or volume bases", () => {
  const solid = toServingNutrition({ label_basis: "per_100g", serving_size: "25 g", calories: 400, sodium_mg: 200, added_sugar_g: null });
  assert.equal(solid.calories, 100);
  assert.equal(solid.sodium_mg, 50);
  assert.equal(solid.added_sugar_g, null);
  assert.equal(solid.label_basis, "per_serving");
  const drink = toServingNutrition({ label_basis: "per_100ml", serving_size: "0.25 l", total_sugar_g: 8 });
  assert.equal(drink.total_sugar_g, 20);
  assert.equal(toServingNutrition({ label_basis: "per_100g", serving_size: "250 ml", calories: 100 }), null);
  assert.equal(toServingNutrition({ label_basis: "per_100ml", serving_size: "250 g", calories: 100 }), null);
  assert.equal(toServingNutrition({ label_basis: "unknown", serving_size: "25 g", calories: 100 }), null);
});

test("explicit serving values do not require a guessed size", () => {
  const result = toServingNutrition({ label_basis: "per_serving", calories: 80, sodium_mg: null });
  assert.equal(result.calories, 80);
  assert.equal(result.sodium_mg, null);
});

test("decimal serving sizes and summaries retain values, source and missing fields", () => {
  assert.deepEqual(parseServingSize("1 portion (12,5 g)"), { quantity: 12.5, unit: "g" });
  const source = { name: "Uploaded label photo", kind: "label_photo", url: null };
  const summary = createNutritionSummary({ label_basis: "per_100ml", sodium_mg: 0 }, source);
  assert.equal(summary.basis, "per_100ml");
  assert.equal(summary.nutrients.sodium_mg, 0);
  assert.equal(summary.nutrients.calories, null);
  assert.deepEqual(summary.source, source);
  assert.ok(summary.missing_fields.includes("calories"));
});

// Resolve the Next.js alias to the same real module for dependency-free API tests.
async function loadApi(relativePath) {
  const source = (await readFile(new URL(relativePath, import.meta.url), "utf8"))
    .replaceAll("@/lib/nutrition.mjs", new URL("../lib/nutrition.mjs", import.meta.url).href);
  return (await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)).default;
}

function responseRecorder() {
  return {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("barcode analysis preserves identity, source nutrients and zero Nutri-Score", async (t) => {
  const handler = await loadApi("../pages/api/analyzeBarcode.js");
  const oldKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = "fixture-key";
  t.after(() => {
    if (oldKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = oldKey;
  });
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      rating: 7, harmful_ingredients: [], summary: "A cereal product.", user_specific_summary: "", ingredient_explanations: [],
    }) } }] }),
  }));
  const product = {
    barcode: "1234567890123", product_name: "Fixture cereal", brand: "Fixture", categories: "en:breakfast-cereals",
    ingredients: "Oats, sugar", serving_size: "30 g", nutriscore_grade: "b", nutriscore_score: 0,
    nutrients_per_100g: { "energy-kcal": 350, sugars: 10, sodium: 0.2, "saturated-fat": 1 },
  };
  const response = responseRecorder();
  await handler({ method: "POST", body: { product } }, response);
  assert.equal(response.statusCode, 200);
  const result = response.body.data;
  assert.equal(result.barcode, product.barcode);
  assert.equal(result.product_name, product.product_name);
  assert.equal(result.categories, product.categories);
  assert.deepEqual(result.nutrients_per_100g, product.nutrients_per_100g);
  assert.deepEqual(result.ingredients, ["Oats", "sugar"]);
  assert.equal(result.nutriscore_score, 0);
  assert.equal(result.nutrition.sodium_mg, 200);
  assert.equal(result.nutrition.label_basis, "per_100g");
  assert.equal(result.nutrition_source.url, "https://world.openfoodfacts.org/product/1234567890123");
});

test("alternatives compare equal bases and mg sodium, excluding volume and unknown candidates", async (t) => {
  const handler = await loadApi("../pages/api/alternatives/index.js");
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({ products: [
      { code: "solid", product_name: "Comparable cereal", serving_size: "25 g", nutriments: { sodium_100g: 0.2, sugars_100g: 10 } },
      { code: "liquid", product_name: "Volume values", serving_size: "250 ml", nutriments: { sodium_100g: 0.01, sugars_100g: 1 } },
      { code: "unknown", product_name: "Unknown basis", nutriments: { sodium_100g: 0, sugars_100g: 0 } },
      { code: "missing", product_name: "Missing nutrients", serving_size: "25 g", nutriments: { sodium_100g: null, sugars_100g: null } },
    ] }),
  }));
  const response = responseRecorder();
  await handler({ method: "POST", body: { product: {
    product_category: "cereals", nutrition: { label_basis: "per_100g", sodium_mg: 400, total_sugar_g: 20 },
  } } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.comparison_basis, "per_100g");
  assert.equal(response.body.data.sodium_unit, "mg");
  assert.deepEqual(response.body.data.alternatives.map((item) => item.barcode), ["solid"]);
  const candidate = response.body.data.alternatives[0];
  assert.equal(candidate.nutrients.sodium, 200);
  assert.ok(candidate.reasons.some((reason) => reason.text === "50% less sodium"));
});

test("an unknown source Nutri-Score cannot create an improvement claim", async (t) => {
  const handler = await loadApi("../pages/api/alternatives/index.js");
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({ products: [{
      code: "same", product_name: "Equivalent cereal", serving_size: "25 g", nutriscore_grade: "a",
      nutriments: { sodium_100g: 0.2, sugars_100g: 10 },
    }] }),
  }));
  const response = responseRecorder();
  await handler({ method: "POST", body: { product: {
    product_category: "cereals", nutriscore_grade: "Unknown",
    nutrition: { label_basis: "per_100g", sodium_mg: 200, total_sugar_g: 10 },
  } } }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.data.alternatives, []);
});
