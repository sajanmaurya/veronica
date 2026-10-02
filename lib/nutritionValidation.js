function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, decimals = 2) {
  if (value == null) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function plausiblePer100gMass(value) {
  return value == null || (value >= 0 && value <= 100);
}

function closeEnough(a, b, tolerance = 0.35) {
  if (a == null || b == null || b === 0) return false;
  return Math.abs(a - b) / Math.abs(b) <= tolerance;
}

export function validateBarcodeNutrition(product) {
  const source = product?.nutrients_per_100g || {};
  const issues = [];
  const correctedFields = [];
  const invalidFields = [];

  let calories = finite(source["energy-kcal"] ?? source.energy_kcal);
  const energyKj = finite(source.energy);

  let totalFat = finite(source.fat);
  let saturatedFat = finite(source["saturated-fat"] ?? source.saturated_fat);
  let transFat = finite(source["trans-fat"] ?? source.trans_fat);
  let carbohydrates = finite(source.carbohydrates);
  let fiber = finite(source.fiber);
  let totalSugar = finite(source.sugars ?? source.sugar);
  let addedSugar = finite(source.added_sugar_g);
  let protein = finite(source.proteins ?? source.protein);

  const sodiumGrams = finite(source.sodium);
  const sodiumMgDirect = finite(source.sodium_mg);
  const saltGrams = finite(source.salt);

  let sodiumMg =
    sodiumMgDirect != null
      ? sodiumMgDirect
      : sodiumGrams != null
      ? sodiumGrams * 1000
      : null;

  const massFields = [
    ["total_fat_g", totalFat],
    ["saturated_fat_g", saturatedFat],
    ["trans_fat_g", transFat],
    ["carbohydrates_g", carbohydrates],
    ["fiber_g", fiber],
    ["total_sugar_g", totalSugar],
    ["added_sugar_g", addedSugar],
    ["protein_g", protein],
  ];

  for (const [name, value] of massFields) {
    if (!plausiblePer100gMass(value)) {
      issues.push(`${name} is outside the possible 0-100 g per 100 g range`);
      invalidFields.push(name);

      if (name === "total_fat_g") totalFat = null;
      if (name === "saturated_fat_g") saturatedFat = null;
      if (name === "trans_fat_g") transFat = null;
      if (name === "carbohydrates_g") carbohydrates = null;
      if (name === "fiber_g") fiber = null;
      if (name === "total_sugar_g") totalSugar = null;
      if (name === "added_sugar_g") addedSugar = null;
      if (name === "protein_g") protein = null;
    }
  }

  if (
    totalFat != null &&
    saturatedFat != null &&
    saturatedFat > totalFat + 0.5
  ) {
    issues.push("saturated fat is greater than total fat");
    invalidFields.push("saturated_fat_g");
    saturatedFat = null;
  }

  if (totalFat != null && transFat != null && transFat > totalFat + 0.5) {
    issues.push("trans fat is greater than total fat");
    invalidFields.push("trans_fat_g");
    transFat = null;
  }

  if (
    carbohydrates != null &&
    totalSugar != null &&
    totalSugar > carbohydrates + 1
  ) {
    issues.push("total sugar is greater than total carbohydrate");
    invalidFields.push("total_sugar_g");
    totalSugar = null;
  }

  if (
    totalSugar != null &&
    addedSugar != null &&
    addedSugar > totalSugar + 1
  ) {
    issues.push("added sugar is greater than total sugar");
    invalidFields.push("added_sugar_g");
    addedSugar = null;
  }

  if (
    carbohydrates != null &&
    fiber != null &&
    fiber > carbohydrates + 1
  ) {
    issues.push("fiber is greater than total carbohydrate");
    invalidFields.push("fiber_g");
    fiber = null;
  }

  const macroEnergy =
    totalFat != null && carbohydrates != null && protein != null
      ? totalFat * 9 + carbohydrates * 4 + protein * 4
      : null;

  const caloriesFromKj =
    energyKj != null && energyKj > 0 ? energyKj / 4.184 : null;

  const caloriesClearlyWrong =
    calories != null &&
    (calories < 0 ||
      calories > 1000 ||
      (macroEnergy != null &&
        macroEnergy >= 40 &&
        (calories < macroEnergy * 0.45 ||
          calories > macroEnergy * 1.45)));

  if (caloriesClearlyWrong) {
    issues.push(
      macroEnergy != null
        ? `calories (${calories}) conflict with macro-derived energy (~${Math.round(
            macroEnergy
          )} kcal)`
        : `calories (${calories}) are outside a plausible per-100 g range`
    );

    if (
      caloriesFromKj != null &&
      caloriesFromKj >= 0 &&
      caloriesFromKj <= 1000 &&
      (macroEnergy == null || closeEnough(caloriesFromKj, macroEnergy, 0.35))
    ) {
      calories = round(caloriesFromKj, 1);
      correctedFields.push("calories_from_energy_kj");
    } else {
      invalidFields.push("calories");
      calories = null;
    }
  } else if (
    calories == null &&
    caloriesFromKj != null &&
    caloriesFromKj >= 0 &&
    caloriesFromKj <= 1000
  ) {
    calories = round(caloriesFromKj, 1);
    correctedFields.push("calories_from_energy_kj");
  }

  const sodiumFromSalt =
    saltGrams != null && saltGrams >= 0 ? saltGrams * 400 : null;

  if (
    (sodiumMg == null || sodiumMg === 0) &&
    sodiumFromSalt != null &&
    sodiumFromSalt > 0 &&
    sodiumFromSalt <= 100000
  ) {
    if (sodiumMg === 0) {
      issues.push("sodium was zero while salt content was non-zero");
    }
    sodiumMg = round(sodiumFromSalt, 0);
    correctedFields.push("sodium_from_salt");
  }

  if (sodiumMg != null && (sodiumMg < 0 || sodiumMg > 100000)) {
    issues.push("sodium is outside a plausible per-100 g range");
    invalidFields.push("sodium_mg");
    sodiumMg = null;
  }

  if (
    sodiumMg != null &&
    sodiumFromSalt != null &&
    sodiumMg > 0 &&
    sodiumFromSalt > 0 &&
    !closeEnough(sodiumMg, sodiumFromSalt, 0.6)
  ) {
    issues.push("sodium and salt values are internally inconsistent");
  }

  const nutrition = {
    serving_size:
      product?.serving_size &&
      String(product.serving_size).trim().toLowerCase() !== "unknown"
        ? product.serving_size
        : "per 100 g",
    label_basis: "per_100g",
    servings_per_container: null,
    calories,
    total_fat_g: totalFat,
    saturated_fat_g: saturatedFat,
    trans_fat_g: transFat,
    carbohydrates_g: carbohydrates,
    fiber_g: fiber,
    total_sugar_g: totalSugar,
    added_sugar_g: addedSugar,
    protein_g: protein,
    sodium_mg: sodiumMg,
  };

  const coreCount = [
    nutrition.calories,
    nutrition.total_fat_g,
    nutrition.carbohydrates_g,
    nutrition.total_sugar_g,
    nutrition.protein_g,
    nutrition.sodium_mg,
  ].filter((value) => value != null).length;

  const unresolvedCriticalIssue =
    invalidFields.includes("calories") ||
    invalidFields.includes("total_fat_g") ||
    invalidFields.includes("carbohydrates_g") ||
    invalidFields.includes("protein_g") ||
    coreCount < 3;

  return {
    nutrition,
    status: unresolvedCriticalIssue ? "needs_verification" : "verified",
    requires_fallback:
      issues.length > 0 || correctedFields.length > 0 || coreCount < 3,
    issues,
    corrected_fields: correctedFields,
    invalid_fields: [...new Set(invalidFields)],
    core_field_count: coreCount,
  };
}
