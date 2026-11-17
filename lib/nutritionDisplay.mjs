/** Format nutrition for small screens without rounding the values used to score. */
export function formatNutritionValue(value, unit = "g") {
  if (value == null || value === "" || typeof value === "boolean") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";

  const maximumFractionDigits = unit === "kcal"
    ? 0
    : Math.abs(number) > 0 && Math.abs(number) < 1
      ? 2
      : 1;
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits }).format(number);
}

export function nutritionBasisLabel(nutrition = {}) {
  if (nutrition.label_basis === "per_100g") return "Per 100 g";
  if (nutrition.label_basis === "per_100ml") return "Per 100 ml";
  if (nutrition.label_basis === "per_serving") {
    return nutrition.serving_size ? `Per serving (${nutrition.serving_size})` : "Per serving";
  }
  return "Nutrition basis not verified";
}

/** Open Food Facts uses text placeholders for some missing photos. */
export function usableProductImage(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (/^(https:\/\/|data:image\/|blob:)/i.test(trimmed)) return trimmed;
  return "";
}
