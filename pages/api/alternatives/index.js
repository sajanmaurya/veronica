import { comparableNutrition, openFoodFactsSource } from "@/lib/nutrition.mjs";

const OFF_BASE_URL = "https://world.openfoodfacts.org";
const OFF_USER_AGENT = "Veronica/1.0 (healthy alternatives; https://veronica-steel.vercel.app)";

const CATEGORY_WEIGHTS = {
  beverages: { sugar: 0.35, sodium: 0.2, saturatedFat: 0.15, calories: 0.2, fiber: 0.05, protein: 0.05 },
  snacks: { sodium: 0.3, saturatedFat: 0.25, calories: 0.2, sugar: 0.15, fiber: 0.05, protein: 0.05 },
  chips: { sodium: 0.35, saturatedFat: 0.3, calories: 0.2, sugar: 0.05, fiber: 0.05, protein: 0.05 },
  biscuits: { sugar: 0.3, saturatedFat: 0.3, calories: 0.15, sodium: 0.1, fiber: 0.1, protein: 0.05 },
  cereals: { sugar: 0.3, fiber: 0.25, protein: 0.15, saturatedFat: 0.1, sodium: 0.1, calories: 0.1 },
  yogurts: { sugar: 0.3, protein: 0.2, saturatedFat: 0.15, calories: 0.15, fiber: 0.1, sodium: 0.1 },
  dairy: { sugar: 0.25, saturatedFat: 0.25, protein: 0.2, calories: 0.15, sodium: 0.1, fiber: 0.05 },
  sauces: { sodium: 0.4, sugar: 0.25, calories: 0.1, saturatedFat: 0.1, fiber: 0.1, protein: 0.05 },
  frozen: { sodium: 0.3, saturatedFat: 0.25, calories: 0.2, sugar: 0.1, protein: 0.1, fiber: 0.05 },
  default: { sugar: 0.2, sodium: 0.2, saturatedFat: 0.2, calories: 0.15, fiber: 0.15, protein: 0.1 },
};

function categoryTag(product) {
  const source = product?.categories || product?.product_category || "";
  const categories = String(source).split(",").map((item) => item.trim()).filter(Boolean);
  const useful = categories.map((item) => item.replace(/^en:/i, "")).filter((item) => item && item !== "foods");
  return useful[useful.length - 1] || useful[useful.length - 2] || null;
}

function normalizeCategoryTag(value) {
  const raw = String(value || "").toLowerCase().trim().replace(/^en:/, "");
  const aliases = {
    "potato chips": "chips-and-fries",
    chips: "chips-and-fries",
    crisps: "chips-and-fries",
    biscuits: "biscuits",
    cookies: "biscuits",
    cereals: "breakfast-cereals",
    yogurt: "yogurts",
    yoghurt: "yogurts",
    dairy: "dairies",
    beverages: "beverages",
    drinks: "beverages",
    snacks: "snacks",
    sauces: "sauces",
    frozen: "frozen-foods",
  };
  return aliases[raw] || raw;
}

function categoryBucket(product) {
  const text = [product?.categories, product?.pnns_groups_1, product?.pnns_groups_2, product?.product_category, product?.product_name].filter(Boolean).join(" ").toLowerCase();
  if (/chip|crisp|snack/.test(text)) return "snacks";
  if (/biscuit|cookie|cracker/.test(text)) return "biscuits";
  if (/cereal|muesli|granola|breakfast/.test(text)) return "cereals";
  if (/yogurt|yoghurt|curd/.test(text)) return "yogurts";
  if (/milk|cheese|dairy/.test(text)) return "dairy";
  if (/juice|soda|soft drink|beverage|drink/.test(text)) return "beverages";
  if (/sauce|ketchup|dressing/.test(text)) return "sauces";
  if (/frozen/.test(text)) return "frozen";
  return "default";
}

function normalizedCandidate(product) {
  const comparison = comparableNutrition(product);
  return {
    barcode: product?.code || null,
    name: product?.product_name || product?.product_name_en || "Unknown product",
    brand: product?.brands || "",
    image: product?.image_front_url || product?.image_url || null,
    nutriscore: product?.nutriscore_grade || null,
    categories: Array.isArray(product?.categories_tags_en) ? product.categories_tags_en : [],
    ingredients: product?.ingredients_text || product?.ingredients_text_en || "",
    allergens: [...(Array.isArray(product?.allergens_tags) ? product.allergens_tags : []), ...(Array.isArray(product?.traces_tags) ? product.traces_tags : [])].join(" "),
    nutrition_basis: comparison?.basis || "unknown",
    nutrition_source: openFoodFactsSource(product),
    nutrients: Object.fromEntries(
      ["sugar", "sodium", "saturatedFat", "transFat", "calories", "fiber", "protein"]
        .map((field) => [field, comparison?.[field] ?? null])
    ),
  };
}

function preferenceConflict(candidate, profile) {
  const text = [candidate.ingredients, candidate.allergens].join(" ").toLowerCase();
  const preferences = String(profile?.dietaryPreferences || "").toLowerCase();
  const allergies = String(profile?.allergies || "").split(/[,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean);
  const known = {
    peanut: /peanut|groundnut/, nuts: /almond|cashew|hazelnut|walnut|pistachio|nut/,
    milk: /milk|whey|casein|lactose/, egg: /egg|albumin/, soy: /soy|soya/,
    gluten: /wheat|barley|rye|malt|gluten/, fish: /fish|anchovy|tuna|salmon/,
    shellfish: /shrimp|prawn|crab|lobster|shellfish/,
  };
  for (const allergy of allergies) {
    const pattern = known[allergy];
    if (pattern ? pattern.test(text) : text.includes(allergy)) return true;
  }
  if (/vegan/.test(preferences) && /milk|whey|casein|gelatin|egg|honey|meat|chicken|fish|anchovy/.test(text)) return true;
  if (/vegetarian/.test(preferences) && /gelatin|meat|chicken|beef|pork|fish|anchovy/.test(text)) return true;
  if (/gluten[- ]?free/.test(preferences) && /wheat|barley|rye|malt|gluten/.test(text)) return true;
  return false;
}

function scoreCandidate(current, candidate, bucket) {
  const weights = CATEGORY_WEIGHTS[bucket] || CATEGORY_WEIGHTS.default;
  let score = 50;
  const reasons = [];
  for (const [key, label] of [["sugar", "sugar"], ["sodium", "sodium"], ["saturatedFat", "saturated fat"], ["calories", "calories"]]) {
    const a = current[key]; const b = candidate.nutrients[key];
    if (a == null || b == null || a <= 0) continue;
    const improvement = (a - b) / a;
    if (improvement > 0.05) {
      score += Math.min(12, improvement * 30 * (weights[key] || 0.1));
      reasons.push({ key, text: Math.round(improvement * 100) + "% less " + label, improvement: Math.round(improvement * 100) });
    } else if (improvement < -0.1) {
      score -= Math.min(10, Math.abs(improvement) * 22 * (weights[key] || 0.1));
    }
  }
  for (const [key, label] of [["fiber", "fiber"], ["protein", "protein"]]) {
    const a = current[key]; const b = candidate.nutrients[key];
    if (a == null || b == null || a <= 0) continue;
    const improvement = (b - a) / a;
    if (improvement > 0.1) {
      score += Math.min(8, improvement * 18 * (weights[key] || 0.1));
      reasons.push({ key, text: Math.round(improvement * 100) + "% more " + label, improvement: Math.round(improvement * 100) });
    }
  }
  if (candidate.nutriscore && /^[abcde]$/i.test(candidate.nutriscore)) {
    const currentGrade = String(current.nutriscore || "").toLowerCase();
    if (/^[abcde]$/.test(currentGrade) && candidate.nutriscore.toLowerCase() < currentGrade) {
      score += 8;
      reasons.push({ key: "nutriscore", text: "Nutri-Score " + candidate.nutriscore.toUpperCase(), improvement: null });
    }
  }
  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons: reasons.slice(0, 3) };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed." });
  try {
    const { product, profile } = req.body || {};
    if (!product) return res.status(400).json({ success: false, message: "Product data is required." });
    const current = comparableNutrition(product);
    if (!current) return res.status(200).json({ success: true, data: { alternatives: [], message: "Not enough nutrition information is available to compare alternatives reliably." } });
    current.nutriscore = product.nutriscore_grade || null;
    const category = normalizeCategoryTag(categoryTag(product));
    if (!category) return res.status(200).json({ success: true, data: { alternatives: [], message: "Veronica could not identify a sufficiently specific product category." } });

    const params = new URLSearchParams({
      categories_tags_en: category, page: "1", page_size: "24", sort_by: "popularity_key",
      fields: "code,product_name,product_name_en,brands,image_front_url,nutriscore_grade,nutriments,ingredients_text,ingredients_text_en,allergens_tags,traces_tags,categories_tags_en,serving_size,serving_quantity_unit,nutrition_data_per,last_modified_t",
    });
    const response = await fetch(OFF_BASE_URL + "/api/v2/search?" + params.toString(), { headers: { "User-Agent": OFF_USER_AGENT } });
    if (!response.ok) throw new Error("Open Food Facts search failed with HTTP " + response.status);
    const payload = await response.json();
    const candidates = Array.isArray(payload?.products) ? payload.products.map(normalizedCandidate) : [];
    const currentBarcode = String(product?.barcode || product?.code || "");
    const bucket = categoryBucket(product);
    const ranked = candidates
      .filter((candidate) => candidate.nutrition_basis === current.basis)
      .filter((candidate) => candidate.barcode && candidate.barcode !== currentBarcode)
      .filter((candidate) => candidate.name && candidate.name !== "Unknown product")
      .filter((candidate) => Object.values(candidate.nutrients).some((value) => value != null))
      .filter((candidate) => !preferenceConflict(candidate, profile))
      .map((candidate) => ({ ...candidate, ...scoreCandidate(current, candidate, bucket) }))
      .filter((candidate) => candidate.reasons.length > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return res.status(200).json({ success: true, data: { category, comparison_basis: current.basis, sodium_unit: "mg", alternatives: ranked, message: ranked.length ? "These products have comparable category data and measurable differences from the scanned product." : "No comparable alternatives with enough nutrition data were found." } });
  } catch (error) {
    console.error("Healthy alternatives failed:", error);
    return res.status(500).json({ success: false, message: "Unable to find product alternatives right now." });
  }
}
