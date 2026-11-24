// A household measure may accompany the single metric quantity on either side.
export function parseServingSize(raw) {
  const parts = String(raw ?? "").trim().match(/^([^()]+?)(?:\s*\(([^()]+)\))?$/);
  if (!parts) return null;
  const metric = /^(\d+(?:\.\d+)?)\s*(g|ml)$/i;
  const left = parts[1].trim(), right = parts[2]?.trim() || "";
  const measurement = left.match(metric) || right.match(metric);
  if (!measurement) return null;

  const household = left.match(metric) ? right : left;
  const conflicting = /(?:\d\s*|\b)(?:g|ml|grams?|millilit(?:er|re)s?|kcal|kj)\b|\b(?:or|to|per)\b/i;
  if (household && (!/[a-z]/i.test(household) || conflicting.test(household))) return null;
  const quantity = Number(measurement[1]);
  return Number.isFinite(quantity) && quantity > 0 ? { quantity, unit: measurement[2].toLowerCase() } : null;
}
