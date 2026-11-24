import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateNutritionScore as score } from '../lib/nutritionScoring.mjs';

const base={eligibility:'eligible',category:'general',basis:'per_100g',nutrients:{energyKj:0,sugarsG:0,saturatedFatG:0,saltG:0,fibreG:0,proteinG:0,eligiblePlantPercent:0}};
const make=(nutrients={},rest={})=>({...base,...rest,nutrients:{...base.nutrients,...nutrients}});

test('Silk Chocolate missing sodium: certain E but unknown exact score',()=>{
 const r=score(make({energyKj:null,energyKcal:543,sugarsG:55.3,saturatedFatG:21.5,totalFatG:31.4,saltG:null,sodiumMg:null,fibreG:null,proteinG:7.6,eligiblePlantPercent:null}));
 assert.equal(r.status,'grade_only'); assert.equal(r.grade,'E'); assert.equal(r.rawScore,null);
 assert.deepEqual(r.scoreRange,{min:21,max:51});
 assert.deepEqual(r.breakdown.negative,{energy:6,sugars:15,saturatedFat:10,salt:null,sweeteners:0});
 assert.deepEqual(r.breakdown.negativeTotalRange,{min:31,max:51});
 assert.ok(r.missingFields.includes('saltG'));
});
test('Borderline product remains ungraded when salt could change the grade',()=>{
 const r=score(make({energyKj:1000,saltG:null}));
 assert.equal(r.status,'insufficient_data'); assert.equal(r.grade,null);
 assert.deepEqual(r.scoreRange,{min:2,max:22});
});
test('Missing sugar is not interpreted as zero',()=>{
 const r=score(make({sugarsG:null}));
 assert.equal(r.grade,null);assert.equal(r.status,'insufficient_data');
 assert.deepEqual(r.scoreRange,{min:0,max:15});
});
test('Unknown salt properly brackets protein eligibility cutoff',()=>{
 const r=score(make({energyKj:2000,sugarsG:14.1,saturatedFatG:0,saltG:null,proteinG:20}));
 assert.equal(r.grade,null); assert.equal(r.breakdown.proteinEligible,null);
 for(const salt of [0,0.2,0.7,1.2,3.4,5]){
  const complete=score(make({energyKj:2000,sugarsG:14.1,saturatedFatG:0,saltG:salt,proteinG:20}));
  assert.ok(complete.rawScore>=r.scoreRange.min&&complete.rawScore<=r.scoreRange.max);
 }
});
test('Complete chocolate retains its exact score and E grade',()=>{
 const r=score(make({energyKj:null,energyKcal:543,sugarsG:55.3,saturatedFatG:21.5,totalFatG:31.4,saltG:null,sodiumMg:125,fibreG:0,proteinG:7.6,eligiblePlantPercent:0}));
 assert.equal(r.grade,'E');assert.equal(r.status,'scored');assert.equal(r.rawScore,32);
});
test('Unverified sweetener status is not silently treated as absence',()=>{
 const r=score(make({},{category:'beverage',basis:'per_100ml',hasSpecifiedSweeteners:null}));
 assert.equal(r.grade,null);assert.equal(r.status,'insufficient_data');
});
test('Even without sweetener status, heavily penalized drinks can be grade E',()=>{
 const r=score(make({energyKj:600,sugarsG:20},{category:'beverage',basis:'per_100ml',hasSpecifiedSweeteners:null}));
 assert.equal(r.grade,'E');assert.equal(r.status,'grade_only');assert.equal(r.rawScore,null);
});
test('A missing value must not mutate the original product input',()=>{
 const product=make({energyKj:null,energyKcal:543,sugarsG:55.3,saturatedFatG:21.5,saltG:null});
 const before=JSON.stringify(product);score(product);assert.equal(JSON.stringify(product),before);
});

test('partial grade counts measured components, preserves true zero and bounds the full grade', () => {
  const observed = score({...base, nutrients: { sugarsG: 40 }});
  assert.equal(observed.grade, null);
  assert.deepEqual(observed.partialRating, { grade: 'D', points: 11, components: ['sugars'], bestGrade: 'B', worstGrade: 'E' });
  const zero = score({...base, nutrients: { sugarsG: 0 }});
  assert.equal(zero.partialRating.grade, 'A');
  assert.equal(zero.partialRating.points, 0);
  assert.equal(zero.normalized.saltG, null);
  for (const input of [
    {...base, nutrients: {}}, {...base, nutrients: {carbohydratesG: 20}},
    {...base, nutrients: {sugarsG: -8}}, {...base, eligibility: 'ineligible'}, {...base, basis: 'unknown'},
  ]) assert.equal(score(input).partialRating, undefined);
});

test('replays an older saved partial scan without modifying the saved object', async () => {
  const {displayNutritionScore} = await import('../lib/nutritionScoring.mjs');
  const {partialRating, ...older} = score({...base, nutrients: {sugarsG: 40}});
  older.category = 'general';
  assert.deepEqual(displayNutritionScore(older).partialRating, partialRating);
  assert.equal(older.partialRating, undefined);
  assert.equal(displayNutritionScore(null), null);
});
