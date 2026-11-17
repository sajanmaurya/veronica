/**
 * Reference-derived numerical fixtures, not real manufacturer product examples.
 * Based on Santé publique France March 2025 Exhibit 1-B Tables 5-10 and
 * classification cutoffs (https://www.santepubliquefrance.fr/sites/default/files/rdd/document/march2025CoU_EN.pdf).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {calculateNutritionScore as score} from "../lib/nutritionScoring.mjs";
const make=(category="general",nutrients={},rest={})=>({eligibility:"eligible",category,basis:category==="beverage"?"per_100ml":"per_100g",hasSpecifiedSweeteners:false,nutrients:{energyKj:0,sugarsG:0,saturatedFatG:0,saltG:0,fibreG:0,proteinG:0,eligiblePlantPercent:0,...nutrients},...rest});
test("official solid Table 5 points and grades at boundaries",()=>{
 for(const [key,t,component] of [["energyKj",335,"energy"],["sugarsG",3.4,"sugars"],["saturatedFatG",1,"saturatedFat"],["saltG",0.2,"salt"]]){
  assert.equal(score(make("general",{[key]:t})).breakdown.negative[component],0);
  assert.equal(score(make("general",{[key]:t+0.01})).breakdown.negative[component],1);
 }
 for(const [salt,grade] of [[0,"A"],[0.21,"B"],[0.41,"B"],[0.61,"C"],[2.21,"D"],[3.81,"E"]])assert.equal(score(make("general",{saltG:salt})).grade,grade);
});
test("official beverage Table 9 energy, sugars and sweetener points",()=>{
 for(const [key,t,component] of [["energyKj",30,"energy"],["sugarsG",0.5,"sugars"]]){
  assert.equal(score(make("beverage",{[key]:t})).breakdown.negative[component],0);
  assert.equal(score(make("beverage",{[key]:t+0.01})).breakdown.negative[component],1);
 }
 assert.equal(score(make("beverage")).grade,"B");
 assert.equal(score(make("beverage",{}, {hasSpecifiedSweeteners:true})).grade,"C");
});
test("official Table 10 fruit vegetable and legume points in beverages",()=>{
 for(const [pct,drink,solid] of [[40,0,0],[41,2,1],[60,2,1],[61,4,2],[80,4,2],[81,6,5]]){
  assert.equal(score(make("beverage",{eligiblePlantPercent:pct})).breakdown.positive.eligiblePlants,drink);
  assert.equal(score(make("general",{eligiblePlantPercent:pct})).breakdown.positive.eligiblePlants,solid);
 }
});
test("official special category energy from saturated fat and saturated fat ratio",()=>{
 const r=score(make("fats_nuts_seeds",{saturatedFatG:10,totalFatG:100}));
 assert.equal(r.breakdown.negative.energy,3);assert.equal(r.breakdown.negative.saturatedFat,1);
});
test("official protein exceptions for cheese and red meat",()=>{
 assert.equal(score(make("general",{saltG:2.21,proteinG:20})).breakdown.positive.protein,0);
 assert.equal(score(make("cheese",{saltG:2.21,proteinG:20})).breakdown.positive.protein,7);
 assert.equal(score(make("red_meat",{proteinG:20})).breakdown.positive.protein,2);
});
test("official beverage letter cutoffs",()=>{
 for(const [salt,grade] of [[0.41,"B"],[0.61,"C"],[1.41,"D"],[2.01,"E"]])assert.equal(score(make("beverage",{saltG:salt})).grade,grade);
});
test("missing drink plant percent bounds up to six points",()=>{
 const r=score(make("beverage",{eligiblePlantPercent:null,energyKj:390}));
 assert.equal(r.scoreRange.max-r.scoreRange.min,6);
});
