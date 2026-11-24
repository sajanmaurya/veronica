import { scoringFields } from "./scoringAdapter.mjs";
import { parseServingSize } from "./servingSize.mjs";

export const labelFields = {
  energy_kj: ["Energy", "kJ"],
  calories: ["Calories", "kcal"],
  total_fat_g: ["Total fat", "g"],
  saturated_fat_g: ["Saturated fat", "g"],
  trans_fat_g: ["Trans fat", "g"],
  carbohydrates_g: ["Carbohydrate", "g"],
  fiber_g: ["Fibre", "g"],
  total_sugar_g: ["Total sugars", "g"],
  added_sugar_g: ["Added sugars", "g"],
  protein_g: ["Protein", "g"],
  sodium_mg: ["Sodium", "mg"],
  salt_g: ["Salt", "g"],
};

const textOrNull = { type: ["string", "null"] };
const columnProperties = {
  heading: { type: "string" },
  ...Object.fromEntries(Object.keys(labelFields).map((key) => [key, textOrNull])),
};
const properties = {
  serving_size: textOrNull,
  servings_per_container: { type: ["number", "null"] },
  panel_box: { type: ["array", "null"], items: { type: "integer" } },
  columns: {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      properties: columnProperties,
      required: Object.keys(columnProperties),
    },
  },
};
export const labelSchema = {
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
};

export function printedBasis(heading) {
  const h = String(heading || "").toLowerCase();
  if (/%|\brda\b|daily (?:intake|value)|reference intake/.test(h)) return "percentage";
  if (/prepared|diluted|reconstituted|as sold.*as/.test(h)) return "unknown";
  const matches = [
    [/\b(?:per\s*)?100\s*(?:g|gm|gms|grams?)\b/, "per_100g"],
    [/\b(?:per\s*)?100\s*ml\b/, "per_100ml"],
    [/\bper\s+(?:serving|portion)\b/, "per_serving"],
    [/\bper\s+(?:container|package|pack)\b/, "per_container"],
  ].filter(([pattern]) => pattern.test(h));
  return matches.length === 1 ? matches[0][1] : "unknown";
}

// A half last printed digit on each side accounts for rounding (including
// integer energy declarations such as 910 kJ printed to the nearest 10 kJ).
function quantity(raw, unit) {
  if (raw == null || raw === "") return {};
  // A value on the food Calories row already carries its kcal unit in the row heading.
  let text = String(raw).trim();
  if (unit === "kcal") {
    if (/^\d+(?:\.\d+)?$/.test(text)) text += " kcal";
    text = text.replace(/\s*Calories?$/i, " kcal");
  }
  const match = text
    .match(/^(?:(<=|<|≤|not more than|less than)\s*)?(\d+(?:\.\d+)?)\s*(kJ|kcal|Cal|mg|g)$/i);
  if (!match) return { invalid: true };
  const inputUnit = match[3].toLowerCase();
  let factor = 1;
  if (unit === "mg" && inputUnit === "g") factor = 1000;
  else if (unit === "g" && inputUnit === "mg") factor = 0.001;
  else if (unit.toLowerCase() !== inputUnit && !(unit === "kcal" && match[3] === "Cal"))
    return { invalid: true };
  const value = Number(match[2]) * factor;
  if (!Number.isFinite(value)) return { invalid: true };
  if (match[1]) return { bounded: true }; // Preserve the text, never score an upper limit as an exact value.
  const digits = (match[2].split(".")[1] || "").length;
  const step = !digits && unit === "kJ" && match[2].endsWith("0") ? 10 : 10 ** -digits;
  return { value, tolerance: (step * factor) / 2 };
}

function parseColumn(column, basis, panel, issues) {
  const nutrition = {
    serving_size: panel.serving_size ?? null,
    servings_per_container: panel.servings_per_container ?? null,
    label_basis: basis,
  };
  const cells = {};
  for (const [key, [name, unit]] of Object.entries(labelFields)) {
    const cell = quantity(column?.[key], unit);
    if (cell.invalid)
      issues.push(
        `Check the value and unit for ${name} in the selected column (${column?.heading || "manual entry"}).`,
      );
    nutrition[key] = cell.value ?? null;
    cells[key] = cell;
  }
  if (
    nutrition.added_sugar_g != null &&
    nutrition.total_sugar_g != null &&
    nutrition.added_sugar_g > nutrition.total_sugar_g
  ) {
    issues.push("Added sugars exceed total sugars.");
  }
  const serving = parseServingSize(panel.serving_size);
  const grams =
    basis === "per_100g" ? 100 : basis === "per_serving" && serving?.unit === "g" ? serving.quantity : null;
  const kj = nutrition.energy_kj;
  const kcal = nutrition.calories;
  if (kj != null && kcal != null && Math.abs(kj - kcal * 4.184) > Math.max(5, kj * 0.02)) {
    issues.push("The kJ and kcal quantities in the same column disagree.");
  }
  if (grams && (nutrition.calories > grams * 10 || nutrition.energy_kj > grams * 42)) {
    issues.push("Check the energy value and whether its printed unit is kJ or kcal.");
  }
  return { nutrition, cells };
}

function comparableEnergy(cells) {
  if (cells.energy_kj.value != null) return cells.energy_kj;
  const kcal = cells.calories;
  return kcal.value == null ? {} : { value: kcal.value * 4.184, tolerance: kcal.tolerance * 4.184 };
}

function compareColumns(standard, portion, size, issues) {
  let compared = 0;
  for (const [key, [name]] of Object.entries(labelFields)) {
    let a = standard.cells[key],
      b = portion.cells[key];
    if (key === "energy_kj") {
      a = comparableEnergy(standard.cells);
      b = comparableEnergy(portion.cells);
    }
    if (a.value == null || b.value == null) continue;
    compared++;
    const ratio = size / 100;
    if (Math.abs(a.value * ratio - b.value) > a.tolerance * ratio + b.tolerance + 1e-8) {
      issues.push(`The two columns disagree for ${name.toLowerCase()}.`);
    }
  }
  if (!compared) issues.push("No shared quantity could be checked across the two columns.");
}

function packRounding(key, cell) {
  const threshold = key === "calories" ? 50 : key === "sodium_mg" ? 140 : null;
  if (threshold === null || cell.value % 5 !== 0) return cell.tolerance;
  const step = cell.value > threshold && cell.value % 10 === 0 ? 10 : 5;
  return Math.max(cell.tolerance, step / 2);
}

// Whole-pack values corroborate the serving column. Both the servings count and
// the nutrient amounts can be rounded independently on the printed panel.
function compareContainer(portion, container, count, issues) {
  const hasCount = Number.isFinite(count) && count > 0;
  const margin = count >= 2 && count <= 5 ? 0.25 : 0.5;
  let lower = hasCount ? Math.max(0, count - margin) : 0;
  let upper = hasCount ? count + margin : Infinity;
  for (const [key, [name]] of Object.entries(labelFields)) {
    const a = portion.cells[key], b = container.cells[key];
    if (a.value == null || b.value == null) continue;
    const da = packRounding(key, a), db = packRounding(key, b);
    lower = Math.max(lower, (b.value - db) / (a.value + da));
    if (a.value > da) upper = Math.min(upper, (b.value + db) / (a.value - da));
    if (lower > upper + 1e-8) {
      issues.push(`The per-serving and whole-container columns disagree near ${name.toLowerCase()}.`);
      return;
    }
  }
}

export function analyzeLabelColumns(product, panel = {}, review = null) {
  const columns = Array.isArray(panel?.columns) ? panel.columns : [];
  const issues = [];
  const observed = columns
    .map((column) => ({ column, basis: printedBasis(column?.heading) }))
    .filter((item) => item.basis !== "percentage");
  if (review && printedBasis(review.column?.heading) === "percentage") {
    issues.push("Choose a quantity column. Daily-intake percentages cannot be used for scoring.");
  }
  if (review && printedBasis(review.column?.heading) === "per_container") {
    issues.push("Whole-container quantities cannot be used as a serving.");
  }
  const source = review ? [{ column: review.column, basis: review.basis }] : observed;
  const effectivePanel = review ? { ...panel, serving_size: review.serving_size } : panel;
  const standard = source.filter((item) => ["per_100g", "per_100ml"].includes(item.basis));
  const portions = source.filter((item) => item.basis === "per_serving");
  const containers = source.filter((item) => item.basis === "per_container");
  if (
    (!standard.length && !portions.length) || containers.length > 1 ||
    source.some((item) => !["per_100g", "per_100ml", "per_serving", "per_container"].includes(item.basis)) ||
    standard.length > 1 ||
    portions.length > 1
  ) {
    issues.push("Check which printed column gives the quantity per serving, per 100 g or per 100 ml.");
  }
  const chosen = standard[0] || portions[0];
  const parsed = parseColumn(chosen?.column, chosen?.basis || "unknown", effectivePanel || {}, issues);
  if (portions.length) {
    const size = parseServingSize(effectivePanel?.serving_size);
    const heading = portions[0].column?.heading || "";
    const printedSize = parseServingSize(heading.match(/\b\d+(?:\.\d+)?\s*(?:g|ml)\b/i)?.[0]);
    const disagreesWithHeading =
      !review && printedSize && (printedSize.quantity !== size?.quantity || printedSize.unit !== size?.unit);
    if (!size || disagreesWithHeading || (standard.length && standard[0].basis !== "per_100" + size.unit)) {
      issues.push("Check the serving size and its unit against the printed heading.");
    } else {
      const portion = standard.length ? parseColumn(portions[0].column, "per_serving", effectivePanel, issues) : parsed;
      if (standard.length) compareColumns(parsed, portion, size.quantity, issues);
      if (containers.length) {
        const container = parseColumn(containers[0].column, "per_container", effectivePanel, issues);
        compareContainer(portion, container, effectivePanel.servings_per_container, issues);
      }
    }
  }
  const hasValues = Object.keys(labelFields).some((key) => parsed.nutrition[key] != null);
  if (!hasValues) issues.push("No nutrition quantities could be read from this column.");
  const fields = scoringFields(product, parsed.nutrition, { blockedReason: issues.join(" ") });
  const invalid = issues.length > 0 || fields.nutrition_score.status === "invalid_input";
  const messages = issues.length ? issues : fields.nutrition_score.issues || [];
  // Keep disputed values in the transcription only. Other consumers of the
  // flat nutrition record (e.g. comparisons) must not present them as facts.
  const nutrition = invalid ? parseColumn(null, "unknown", {}, []).nutrition : parsed.nutrition;
  return {
    ...fields,
    nutrition,
    nutrition_panel: panel,
    nutrition_review: review,
    nutrition_source: hasValues && !invalid ? "package_scan" : "unavailable",
    nutrition_validation: {
      status: invalid ? "needs_verification" : review ? "user_checked" : "extracted",
      message: messages.join(" "),
      basis: nutrition.label_basis,
    },
  };
}
