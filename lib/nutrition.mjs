export const NUTRIENT_FIELDS = [
  "calories", "total_fat_g", "saturated_fat_g", "trans_fat_g",
  "carbohydrates_g", "fiber_g", "total_sugar_g", "added_sugar_g",
  "protein_g", "sodium_mg",
];

export function nutritionBasisLabel(basis) {
  switch (basis) {
    case "per_100g": return "Per 100 g";
    case "per_100ml": return "Per 100 ml";
    case "per_serving": return "Per serving";
    default: return "Nutrition basis unavailable";
  }
}

// Unknown is different from zero, especially when comparing products.
export function toFiniteNumber(value) {
  if (value == null || typeof value === "boolean" ||
      (typeof value === "string" && !value.trim())) return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value) {
  return value == null ? null : Math.round(value * 10000) / 10000;
}

export function parseServingSize(value) {
  if (typeof value !== "string") return null;
  const matches = [...value.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|grams?|g|millilit(?:er|re)s?|ml|lit(?:er|re)s?|l)\b/gi)];
  // A dual mass/volume serving does not establish density or one clear basis.
  const sizes = matches.map((match) => {
    const unit = match[2].toLowerCase();
    const quantity = Number(match[1].replace(",", "."));
    return {
      quantity: quantity * (unit === "kg" || unit === "l" || /^lit/.test(unit) ? 1000 : 1),
      unit: unit === "kg" || unit === "g" || /^gram/.test(unit) ? "g" : "ml",
    };
  }).filter((size) => size.quantity > 0);
  if (sizes.length !== 1) return null;
  return sizes[0];
}

function canonicalNutrition(nutrition = {}) {
  if (!nutrition || typeof nutrition !== "object") nutrition = {};
  return {
    serving_size: typeof nutrition.serving_size === "string" ? nutrition.serving_size : null,
    label_basis: ["per_100g", "per_100ml", "per_serving"].includes(nutrition.label_basis)
      ? nutrition.label_basis : "unknown",
    servings_per_container: toFiniteNumber(nutrition.servings_per_container),
    ...Object.fromEntries(NUTRIENT_FIELDS.map((field) => {
      const value = toFiniteNumber(nutrition[field]);
      return [field, value != null && value >= 0 ? value : null];
    })),
  };
}

export function normalizeNutrition(input) {
  const nutrition = canonicalNutrition(input);
  const missingFields = NUTRIENT_FIELDS.filter((field) => nutrition[field] == null);
  const issues = [];
  if (nutrition.label_basis === "unknown") issues.push("The nutrition-panel basis is unavailable.");
  if (NUTRIENT_FIELDS.some((field) => toFiniteNumber(input?.[field]) < 0)) {
    issues.push("Negative nutrient values were omitted.");
  }
  const serving = parseServingSize(nutrition.serving_size);
  const mass = nutrition.label_basis === "per_100g" ? 100
    : nutrition.label_basis === "per_serving" && serving?.unit === "g" ? serving.quantity : null;
  // Saturated/trans fats are part of fat; sugars are part of carbohydrates.
  // Count only the three top-level macros in this rough mass check.
  const macros = [nutrition.total_fat_g, nutrition.carbohydrates_g, nutrition.protein_g];
  if (mass && macros.every((value) => value != null) &&
      macros.reduce((sum, value) => sum + value, 0) > mass * 1.1) {
    issues.push("The macronutrient quantities exceed the stated nutrition basis.");
  }
  const massFields = NUTRIENT_FIELDS.filter((field) => field.endsWith("_g"));
  if (mass && massFields.some((field) => nutrition[field] != null && nutrition[field] > mass * 1.1)) {
    issues.push("A nutrient quantity exceeds the stated nutrition basis.");
  }
  const hasCoreMacros = macros.every((value) => value != null) && nutrition.calories != null;
  if (hasCoreMacros) {
    const estimate = macros[0] * 9 + macros[1] * 4 + macros[2] * 4;
    if ((estimate === 0 && nutrition.calories > 5) ||
        (estimate > 0 && (nutrition.calories < estimate * 0.45 || nutrition.calories > estimate * 1.35))) {
      issues.push("Calories differ substantially from a rough macronutrient estimate.");
    }
  }
  const needsVerification = issues.length > 0 || !hasCoreMacros;
  return {
    nutrition,
    validation: {
      status: needsVerification ? "needs_verification" : "checked",
      basis: nutrition.label_basis,
      missing_fields: missingFields,
      message: issues.length ? `${issues.join(" ")} Check the package label.`
        : !hasCoreMacros ? "Some nutrition values are unavailable. Check the package label before relying on these values."
        : "Available values passed basic consistency checks. This does not verify the source or label reading.",
    },
  };
}

function scaledNutrition(nutrition, factor, basis) {
  return {
    ...nutrition,
    label_basis: basis,
    ...Object.fromEntries(NUTRIENT_FIELDS.map((field) => [field, round(nutrition[field] == null ? null : nutrition[field] * factor)])),
  };
}

export function toServingNutrition(input) {
  const nutrition = canonicalNutrition(input);
  if (nutrition.label_basis === "per_serving") return nutrition;
  const serving = parseServingSize(nutrition.serving_size);
  if (!serving) return null;
  if ((nutrition.label_basis === "per_100g" && serving.unit === "g") ||
      (nutrition.label_basis === "per_100ml" && serving.unit === "ml")) {
    return scaledNutrition(nutrition, serving.quantity / 100, "per_serving");
  }
  return null;
}

function firstNumber(data, keys) {
  for (const key of keys) {
    const value = toFiniteNumber(data?.[key]);
    if (value != null) return value;
  }
  return null;
}

function sourcePer100(product) {
  if (product?.nutrients_per_100g && typeof product.nutrients_per_100g === "object") return product.nutrients_per_100g;
  if (product?.nutriments_per_100g && typeof product.nutriments_per_100g === "object") return product.nutriments_per_100g;
  return Object.fromEntries(Object.entries(product?.nutriments || {})
    .filter(([key]) => key.endsWith("_100g")).map(([key, value]) => [key.slice(0, -5), value]));
}

export function offNutritionBasis(product) {
  const stated = product?.nutrients_per_100g_basis || product?.nutrition_per_100_basis;
  if (["per_100g", "per_100ml"].includes(stated)) return stated;
  if (product?.nutrition_data_per === "100ml") return "per_100ml";
  // OFF's *_100g keys also cover 100 ml liquids. Its legacy "100g"
  // nutrition_data_per field alone does not resolve that distinction.
  const unit = String(product?.serving_quantity_unit || "").toLowerCase();
  if (unit === "ml" || unit === "l") return "per_100ml";
  if (unit === "g" || unit === "kg") return "per_100g";
  const serving = parseServingSize(product?.serving_size);
  return serving ? serving.unit === "ml" ? "per_100ml" : "per_100g" : "unknown";
}

export function nutritionFromOpenFoodFacts(product) {
  const raw = sourcePer100(product);
  const kcal = firstNumber(raw, ["energy-kcal", "energy_kcal"]);
  const kj = firstNumber(raw, ["energy-kj", "energy_kj", "energy"]);
  const sodiumGrams = firstNumber(raw, ["sodium"]);
  return canonicalNutrition({
    serving_size: product?.serving_size,
    label_basis: offNutritionBasis(product),
    calories: kcal ?? (kj == null ? null : round(kj / 4.184)),
    total_fat_g: firstNumber(raw, ["fat", "total_fat"]),
    saturated_fat_g: firstNumber(raw, ["saturated-fat", "saturated_fat"]),
    trans_fat_g: firstNumber(raw, ["trans-fat", "trans_fat"]),
    carbohydrates_g: firstNumber(raw, ["carbohydrates"]),
    fiber_g: firstNumber(raw, ["fiber", "fibre"]),
    total_sugar_g: firstNumber(raw, ["sugars", "sugar"]),
    added_sugar_g: firstNumber(raw, ["added-sugars", "added_sugars"]),
    protein_g: firstNumber(raw, ["proteins", "protein"]),
    // OFF normalized *_100g weight fields are grams, regardless of *_unit.
    sodium_mg: sodiumGrams == null ? null : round(sodiumGrams * 1000),
  });
}

export function openFoodFactsSource(product) {
  const barcode = String(product?.barcode || product?.code || "");
  return {
    name: "Open Food Facts",
    kind: "product_database",
    url: /^\d+$/.test(barcode) ? `https://world.openfoodfacts.org/product/${barcode}` : "https://world.openfoodfacts.org",
    last_modified_at: toFiniteNumber(product?.last_modified_t),
  };
}

export function createNutritionSummary(nutrition, source) {
  const normalized = canonicalNutrition(nutrition);
  return {
    basis: normalized.label_basis,
    nutrients: Object.fromEntries(NUTRIENT_FIELDS.map((field) => [field, normalized[field]])),
    missing_fields: NUTRIENT_FIELDS.filter((field) => normalized[field] == null),
    source,
  };
}

export function comparableNutrition(product) {
  const input = product?.nutrition || nutritionFromOpenFoodFacts(product);
  let nutrition = canonicalNutrition(input);
  if (nutrition.label_basis === "per_serving") {
    const serving = parseServingSize(nutrition.serving_size);
    if (!serving) return null;
    nutrition = scaledNutrition(nutrition, 100 / serving.quantity, serving.unit === "g" ? "per_100g" : "per_100ml");
  }
  if (!["per_100g", "per_100ml"].includes(nutrition.label_basis)) return null;
  return {
    basis: nutrition.label_basis,
    sugar: nutrition.total_sugar_g,
    sodium: nutrition.sodium_mg,
    saturatedFat: nutrition.saturated_fat_g,
    transFat: nutrition.trans_fat_g,
    calories: nutrition.calories,
    fiber: nutrition.fiber_g,
    protein: nutrition.protein_g,
  };
}
