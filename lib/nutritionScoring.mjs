/** Veronica deterministic nutrition scorer — review release 0.2.0.
 * Numerical rules: updated Nutri-Score (2023), French specification 2025.
 * https://www.legifrance.gouv.fr/loda/id/JORFTEXT000051329233/
 * No network, AI, dependencies, or implicit ingredient/category inference.
 * Caller MUST establish eligibility, category, preparation state, eligible
 * plant percentage, and specified sweetener presence from verified data.
 * Missing nutrients are bounded by published point tables. A grade is shown
 * only when every score in the conservative interval has the same grade.
 */
export const VERSION = 'veronica-0.2.0/nutriscore-2023';
const RULES = {
  energy: [335,670,1005,1340,1675,2010,2345,2680,3015,3350],
  sugar: [3.4,6.8,10,14,17,20,24,27,31,34,37,41,44,48,51],
  saturates: [1,2,3,4,5,6,7,8,9,10],
  salt: Array.from({length:20}, (_,i) => (i+1)/5),
  fibre: [3,4.1,5.2,6.3,7.4],
  protein: [2.4,4.8,7.2,9.6,12,14,17],
  drinkEnergy: [30,90,150,210,240,270,300,330,360,390],
  drinkSugar: [0.5,2,3.5,5,6,7,8,9,10,11],
  drinkProtein: [1.2,1.5,1.8,2.1,2.4,2.7,3],
  fatEnergy: [120,240,360,480,600,720,840,960,1080,1200],
  fatRatio: [10,16,22,28,34,40,46,52,58,64],
};
// Numerical comparison tolerance only; never round label values before scoring.
const gt = (a,b) => a-b > 1e-9;
const points = (v, thresholds) => thresholds.filter(t => gt(v,t)).length;
const plantPoints = v => v == null ? null : gt(v,80) ? 5 : gt(v,60) ? 2 : gt(v,40) ? 1 : 0;
const categories = ['general','cheese','red_meat','fats_nuts_seeds','beverage','water'];
const numericFields = ['energyKj','energyKcal','sugarsG','saturatedFatG','totalFatG',
  'saltG','sodiumMg','fibreG','proteinG','carbohydratesG','eligiblePlantPercent'];

function grade(score, category) {
  if (category === 'water') return 'A';
  if (category === 'beverage') return score <= 2 ? 'B' : score <= 6 ? 'C' : score <= 9 ? 'D' : 'E';
  const a = category === 'fats_nuts_seeds' ? -6 : 0;
  return score <= a ? 'A' : score <= 2 ? 'B' : score <= 10 ? 'C' : score <= 18 ? 'D' : 'E';
}

/** Input contract in README. Does not mutate input. Returns JSON-safe data. */
export function calculateNutritionScore(input) {
  const out = {algorithmVersion:VERSION,status:'invalid_input',grade:null,rawScore:null,
    scoreRange:null,missingFields:[],issues:[],normalized:null,breakdown:null};
  const fail = message => { out.issues.push(message); return out; };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('Expected a product object.');
  if (input.eligibility === 'ineligible') {
    out.status = 'not_applicable'; return out;
  }
  if (input.eligibility !== 'eligible') {
    out.status = 'insufficient_data'; out.missingFields.push('eligibility'); return out;
  }
  const c = input.category;
  if (!categories.includes(c)) {
    out.status = 'insufficient_data'; out.missingFields.push('supported category'); return out;
  }
  if (!input.nutrients || typeof input.nutrients !== 'object' || Array.isArray(input.nutrients)) return fail('Expected nutrients object.');
  const n = {};
  for (const key of numericFields) {
    const v = input.nutrients[key];
    if (v == null) { n[key] = null; continue; }
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return fail(`${key} must be a finite nonnegative number or null.`);
    n[key] = v;
  }
  if (n.eligiblePlantPercent > 100) return fail('eligiblePlantPercent exceeds 100.');
  if (input.hasSpecifiedSweeteners != null && typeof input.hasSpecifiedSweeteners !== 'boolean') return fail('hasSpecifiedSweeteners must be boolean or null.');
  const drink = c === 'beverage' || c === 'water';
  const expectedBasis = drink ? 'per_100ml' : 'per_100g';
  let factor = 1;
  if (input.basis === 'per_serving') {
    const s = input.serving;
    if (!s || typeof s.quantity !== 'number' || !Number.isFinite(s.quantity) || s.quantity <= 0 || s.unit !== (drink ? 'ml' : 'g')) return fail('Serving requires positive quantity and category-compatible g/ml unit.');
    factor = 100 / s.quantity;
  } else if (input.basis !== expectedBasis) return fail(`Expected ${expectedBasis}; density conversions must be verified upstream.`);
  for (const key of numericFields) if (key !== 'eligiblePlantPercent' && n[key] != null) n[key] *= factor;
  if (Object.values(n).some(v => v != null && !Number.isFinite(v))) return fail('Normalization overflow.');
  if (n.energyKj != null && n.energyKcal != null && Math.abs(n.energyKj - n.energyKcal*4.184) > Math.max(5,n.energyKj*0.02)) return fail('Energy units disagree by more than rounding tolerance.');
  if (n.saltG != null && n.sodiumMg != null && Math.abs(n.saltG - n.sodiumMg*0.0025) > Math.max(0.01,n.saltG*0.02)) return fail('Salt and sodium disagree by more than rounding tolerance.');
  n.energyKj ??= n.energyKcal == null ? null : n.energyKcal*4.184;
  n.saltG ??= n.sodiumMg == null ? null : n.sodiumMg*0.0025;
  // 100g mass ceilings do not apply blindly to 100ml products.
  if (!drink) for (const key of ['sugarsG','saturatedFatG','totalFatG','saltG','fibreG','proteinG','carbohydratesG']) {
    if (n[key] != null && gt(n[key],100)) return fail(`${key} exceeds 100 g per 100 g.`);
  }
  if (n.saturatedFatG != null && n.totalFatG != null && gt(n.saturatedFatG,n.totalFatG)) return fail('Saturated fat exceeds total fat.');
  if (n.sugarsG != null && n.carbohydratesG != null && gt(n.sugarsG,n.carbohydratesG)) return fail('Sugar exceeds carbohydrate.');
  out.normalized = {...n,basis:expectedBasis};
  // Water is an explicit verified classification, not inferred from zero calories.
  if (c === 'water') {
    const fields = ['energyKj','sugarsG','saturatedFatG','totalFatG','fibreG','proteinG','carbohydratesG','eligiblePlantPercent'];
    if (input.hasSpecifiedSweeteners === true || fields.some(k => n[k] != null && n[k] > 0)) return fail('Water classification conflicts with supplied composition.');
    out.status = 'scored'; out.grade = 'A'; out.breakdown = {waterException:true}; return out;
  }
  const fats = c === 'fats_nuts_seeds';
  if (fats && n.totalFatG === 0) return fail('Fats/nuts/seeds ratio requires totalFatG > 0.');

  // Unknown negative components remain null, never zero. Bound their effect
  // using the maximum points in each published threshold table.
  const negative = {
    energy: n[fats ? 'saturatedFatG' : 'energyKj'] == null
      ? null : points(fats ? n.saturatedFatG*37 : n.energyKj, fats ? RULES.fatEnergy : drink ? RULES.drinkEnergy : RULES.energy),
    sugars: n.sugarsG == null ? null : points(n.sugarsG, drink ? RULES.drinkSugar : RULES.sugar),
    saturatedFat: fats
      ? n.saturatedFatG == null || n.totalFatG == null ? null
        : RULES.fatRatio.filter(t => n.saturatedFatG/n.totalFatG*100 >= t-1e-9).length
      : n.saturatedFatG == null ? null : points(n.saturatedFatG,RULES.saturates),
    salt: n.saltG == null ? null : points(n.saltG,RULES.salt),
    sweeteners: !drink ? 0 : input.hasSpecifiedSweeteners == null ? null : input.hasSpecifiedSweeteners ? 4 : 0,
  };
  const negativeCaps = {
    energy: (fats ? RULES.fatEnergy : drink ? RULES.drinkEnergy : RULES.energy).length,
    sugars: (drink ? RULES.drinkSugar : RULES.sugar).length,
    saturatedFat: (fats ? RULES.fatRatio : RULES.saturates).length,
    salt: RULES.salt.length,
    sweeteners: drink ? 4 : 0,
  };
  const required = fats ? ['saturatedFatG','sugarsG','saltG','totalFatG'] : ['energyKj','sugarsG','saturatedFatG','saltG'];
  out.missingFields = required.filter(k => n[k] == null);
  if (drink && input.hasSpecifiedSweeteners == null) out.missingFields.push('hasSpecifiedSweeteners');

  const minimumNegative = Object.values(negative).reduce((total, value) => total + (value ?? 0), 0);
  const maximumNegative = Object.entries(negative).reduce(
    (total, [key,value]) => total + (value ?? negativeCaps[key]), 0);
  const proteinThreshold = fats ? 7 : 11;
  const alwaysProteinEligible = drink || c === 'cheese';
  const proteinEligibleAt = N => alwaysProteinEligible || N < proteinThreshold;
  const maxProtein = c === 'red_meat' ? 2 : 7;
  const proteinPoints = n.proteinG == null ? null : Math.min(maxProtein, points(n.proteinG,drink ? RULES.drinkProtein : RULES.protein));
  const proteinEligible = proteinEligibleAt(minimumNegative) === proteinEligibleAt(maximumNegative)
    ? proteinEligibleAt(minimumNegative) : null;
  const positive = {
    fibre: n.fibreG == null ? null : points(n.fibreG,RULES.fibre),
    protein: proteinEligible === false ? 0 : proteinEligible === null ? null : proteinPoints,
    eligiblePlants: plantPoints(n.eligiblePlantPercent),
  };
  const fields = {fibre:'fibreG',protein:'proteinG',eligiblePlants:'eligiblePlantPercent'};
  for (const [key,value] of Object.entries(positive)) {
    if (value == null && key !== 'protein') out.missingFields.push(fields[key]);
  }
  // A known protein amount may still have uncertain eligibility, but a truly
  // missing amount is reported whenever protein points could be awarded.
  if (n.proteinG == null && proteinEligible !== false) out.missingFields.push('proteinG');

  const knownPositive = Object.values(positive).reduce((a,v)=>a+(v ?? 0),0);
  const maxFibre = positive.fibre ?? RULES.fibre.length;
  const minFibre = positive.fibre ?? 0;
  const maxPlants = positive.eligiblePlants ?? 5;
  const minPlants = positive.eligiblePlants ?? 0;

  // Protein deduction depends on total negative points. Check every possible
  // integer negative total; all real configurations are contained in this
  // interval, so the bounds cannot produce an unjustifiably certain grade.
  let low = Infinity, high = -Infinity;
  for (let N = minimumNegative; N <= maximumNegative; N++) {
    const eligible = proteinEligibleAt(N);
    const proteinMin = eligible ? (proteinPoints ?? 0) : 0;
    const proteinMax = eligible ? (proteinPoints ?? maxProtein) : 0;
    low = Math.min(low, N - maxFibre - maxPlants - proteinMax);
    high = Math.max(high, N - minFibre - minPlants - proteinMin);
  }
  out.scoreRange = {min:low,max:high};
  out.breakdown = {negative,
    negativeTotal: minimumNegative === maximumNegative ? minimumNegative : null,
    negativeTotalRange: {min:minimumNegative,max:maximumNegative},
    positive,knownPositiveTotal:knownPositive,proteinEligible};

  if (!out.missingFields.length && minimumNegative === maximumNegative) {
    out.status = 'scored'; out.rawScore = high; out.grade = grade(high,c);
  } else if (grade(low,c) === grade(high,c)) {
    out.status = 'grade_only'; out.grade = grade(low,c);
    out.issues.push('Grade is invariant across a conservative missing-data range; exact score is unavailable.');
  } else {
    out.status = 'insufficient_data';
    out.issues.push('Missing values could change the grade.');
  }
  return out;
}
