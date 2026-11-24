import { calculateNutritionScore, VERSION } from './nutritionScoring.mjs';
import { resolveCategory } from './productCategory.mjs';
export { resolveCategory } from './productCategory.mjs';

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
    // Unknown until reviewed ingredient/sweetener mapping exists. The scorer
    // bounds its penalty (0–4); only an invariant grade may still be shown.
    hasSpecifiedSweeteners: null,
    nutrients: {
      energyKj:n.energy_kj, energyKcal:n.calories, saltG:n.salt_g, sugarsG:n.total_sugar_g,
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
