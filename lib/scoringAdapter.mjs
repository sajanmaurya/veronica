import { calculateNutritionScore, VERSION } from './nutritionScoring.mjs';

// Conservative, deterministic routing. Unknown and special-use products are
// not silently treated as general foods. AI may transcribe category text but
// cannot supply points, eligibility flags, or override these rules.
export function resolveCategory(product) {
  const text = [product.product_name, product.product_category, product.categories]
    .filter(Boolean).join(' ').toLowerCase().replace(/[-_]/g, ' ');
  if (/\b(infant|baby|toddler|formula|supplement|sports? nutrition|protein powder|meal replacement|medical food|alcohol|beer|wine|spirits)\b/.test(text)) return {eligibility:'ineligible'};
  // Preparation and category ambiguity must be resolved first.
  if (/\b(powder|concentrate|mix|dried|dehydrated)\b/.test(text)) return {};
  if (/\b(cheese|cheeses)\b/.test(text)) return {eligibility:'eligible',category:'cheese'};
  if (/\b(beef|pork|lamb|mutton|veal|red meat)\b/.test(text)) return {eligibility:'eligible',category:'red_meat'};
  if (/\b(beverage|beverages|drink|drinks|juice|juices|soda|water)\b/.test(text) || /^(milk|plant milk)$/.test(text.trim())) return {eligibility:'eligible',category:'beverage'};
  // Plain fats/nuts/seeds require reviewed taxonomy; mixed products must not
  // be routed from the mere occurrence of 'nuts' or 'oil' in their names.
  if (/\b(oil|oils|butter|nuts|seeds)\b/.test(text)) return {};
  if (/\b(chocolate|chocolates|biscuit|biscuits|cookie|cookies|cracker|crackers|cereal|cereals|bread|breads|chips|crisps|yogurt|yoghurt|yogurts|yoghurts|curd|sauce|sauces|pasta|rice|snack|snacks)\b/.test(text)) return {eligibility:'eligible',category:'general'};
  return {};
}

export function scoreAnalysis(product, nutrition, {blockedReason} = {}) {
  const n = nutrition || {};
  const routing = resolveCategory(product || {});
  if (blockedReason) return {algorithmVersion:VERSION,status:'insufficient_data',grade:null,rawScore:null,missingFields:[],issues:[blockedReason]};
  // Require an explicit gram/ml serving; never extract an arbitrary number.
  const m = String(n.serving_size || '').trim().match(/^(\d+(?:\.\d+)?)\s*(g|ml)(?:\s*\([^)]*\))?$/i);
  const result = calculateNutritionScore({
    ...routing,
    basis: n.label_basis,
    serving: m ? {quantity:Number(m[1]),unit:m[2].toLowerCase()} : undefined,
    // Unknown until reviewed ingredient/sweetener mapping exists. This makes
    // beverage scores unavailable rather than silently assuming no sweeteners.
    hasSpecifiedSweeteners: null,
    nutrients: {
      energyKcal:n.calories, sugarsG:n.total_sugar_g,
      saturatedFatG:n.saturated_fat_g, totalFatG:n.total_fat_g,
      sodiumMg:n.sodium_mg, fibreG:n.fiber_g, proteinG:n.protein_g,
      carbohydratesG:n.carbohydrates_g, eligiblePlantPercent:null,
    }
  });
  return {...result,category:routing.category || null};
}

// Server response contract: obsolete model ratings cannot leak into the UI.
export function scoringFields(product, nutrition, options) {
  return {rating:null,rating_verified:false,nutrition_score:scoreAnalysis(product,nutrition,options)};
}
