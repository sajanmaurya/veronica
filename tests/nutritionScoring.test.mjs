import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateNutritionScore as score} from '../lib/nutritionScoring.mjs';
const base = {eligibility:'eligible',category:'general',basis:'per_100g',nutrients:{energyKj:0,sugarsG:0,saturatedFatG:0,saltG:0,fibreG:0,proteinG:0,eligiblePlantPercent:0}};
const make = (nutrients={}, rest={}) => ({...base,...rest,nutrients:{...base.nutrients,...nutrients}});
const chocolate = make({energyKj:null,energyKcal:543,sugarsG:55.3,saturatedFatG:21.5,saltG:null,sodiumMg:125,fibreG:null,proteinG:7.6,eligiblePlantPercent:null});
test('Chocolate: 32 negative points, E but no invented exact score',()=>{
 const r=score(chocolate); assert.deepEqual(r.breakdown.negative,{energy:6,sugars:15,saturatedFat:10,salt:1,sweeteners:0});
 assert.equal(r.grade,'E'); assert.equal(r.rawScore,null); assert.deepEqual(r.scoreRange,{min:22,max:32}); assert.equal(r.status,'grade_only');
});
test('Exact table boundaries and epsilon above',()=>{
 const tables={energyKj:{key:'energy',ts:[335,670,1005,1340,1675,2010,2345,2680,3015,3350]},sugarsG:{key:'sugars',ts:[3.4,6.8,10,14,17,20,24,27,31,34,37,41,44,48,51]},saturatedFatG:{key:'saturatedFat',ts:[1,2,3,4,5,6,7,8,9,10]},saltG:{key:'salt',ts:Array.from({length:20},(_,i)=>(i+1)/5)}};
 for(const [field,{key,ts}] of Object.entries(tables)) ts.forEach((v,i)=>{
  assert.equal(score(make({[field]:v})).breakdown.negative[key],i);
  assert.equal(score(make({[field]:v+0.0001})).breakdown.negative[key],i+1);
 });
});
test('Missing sugar is never zero',()=>assert.equal(score(make({sugarsG:null})).status,'insufficient_data'));
test('Missing fibre that could change grade withholds grade',()=>assert.equal(score(make({energyKj:1000,fibreG:null})).grade,null));
test('Reject malformed values without coercing them',()=>{
 for(const v of ['',true,'12',NaN,Infinity,-1]) assert.equal(score(make({sugarsG:v})).status,'invalid_input');
});
test('Serving, sodium and kcal normalization preserve result',()=>{
 const a=score(make({energyKj:null,energyKcal:100,sugarsG:10,saturatedFatG:2,saltG:null,sodiumMg:200}));
 const b=score(make({energyKj:null,energyKcal:20,sugarsG:2,saturatedFatG:0.4,saltG:null,sodiumMg:40},{basis:'per_serving',serving:{quantity:20,unit:'g'}}));
 assert.equal(a.rawScore,b.rawScore); assert.deepEqual(a.breakdown,b.breakdown);
});
test('Reject mismatched units, contradictory salt and impossible mass',()=>{
 assert.equal(score(make({}, {basis:'per_100ml'})).status,'invalid_input');
 assert.equal(score(make({saltG:1,sodiumMg:1})).status,'invalid_input');
 assert.equal(score(make({sugarsG:101})).status,'invalid_input');
 assert.equal(score(make({saturatedFatG:5,totalFatG:4})).status,'invalid_input');
});
test('Protein cutoff 11, cheese exception and red meat cap',()=>{
 const n={sugarsG:40,proteinG:20};
 assert.equal(score(make(n)).breakdown.positive.protein,0);
 assert.equal(score(make(n,{category:'cheese'})).breakdown.positive.protein,7);
 assert.equal(score(make({proteinG:20},{category:'red_meat'})).rawScore,-2);
});
test('Beverages: never A except explicit water; sweetener penalty',()=>{
 const d={category:'beverage',basis:'per_100ml',hasSpecifiedSweeteners:false};
 assert.equal(score(make({},d)).grade,'B');
 assert.equal(score(make({}, {...d,hasSpecifiedSweeteners:true})).rawScore,4);
 assert.equal(score(make({}, {...d,hasSpecifiedSweeteners:null})).status,'insufficient_data');
 assert.equal(score(make({}, {...d,category:'water'})).grade,'A');
 assert.equal(score(make({sugarsG:1},{...d,category:'water'})).status,'invalid_input');
});
test('Beverage thresholds and favourable protein use beverage table',()=>{
 const d={category:'beverage',basis:'per_100ml',hasSpecifiedSweeteners:false};
 assert.equal(score(make({energyKj:90,sugarsG:2,proteinG:1.5},d)).rawScore,1);
 assert.equal(score(make({energyKj:91,sugarsG:2.1,proteinG:1.51},d)).rawScore,2);
});
test('Fats ratio uses inclusive lower boundary; protein cutoff seven',()=>{
 const f={category:'fats_nuts_seeds'};
 assert.equal(score(make({saturatedFatG:10,totalFatG:100},f)).breakdown.negative.saturatedFat,1);
 assert.equal(score(make({saturatedFatG:9.999,totalFatG:100},f)).breakdown.negative.saturatedFat,0);
 assert.equal(score(make({saturatedFatG:20,totalFatG:100,proteinG:20},f)).breakdown.positive.protein,0);
 assert.equal(score(make({totalFatG:0},f)).status,'invalid_input');
});
test('General grade boundaries',()=>{
 for(const [n,g] of [[0,'A'],[1,'B'],[2,'B'],[3,'C'],[10,'C'],[11,'D'],[18,'D'],[19,'E']]) {
  const salt=n===0?0:n/5+0.01;
  assert.equal(score(make({saltG:salt})).grade,g);
 }
});
test('Ineligible/unknown categories and immutable inputs',()=>{
 assert.equal(score({...base,eligibility:'ineligible'}).status,'not_applicable');
 assert.equal(score({...base,eligibility:null}).status,'insufficient_data');
 assert.equal(score({...base,category:'unknown'}).grade,null);
 const before=JSON.stringify(chocolate); score(chocolate); assert.equal(JSON.stringify(chocolate),before);
});
test('Increasing sugar cannot improve a complete general-food score',()=>{
 let previous=-Infinity;
 for(let sugar=0;sugar<=100;sugar+=0.5){const r=score(make({sugarsG:sugar,proteinG:20}));assert.ok(r.rawScore>=previous);previous=r.rawScore;}
});
