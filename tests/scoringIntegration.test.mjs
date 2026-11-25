import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {scoreAnalysis, scoringFields, resolveCategory} from '../lib/scoringAdapter.mjs';
const n={label_basis:'per_100g',calories:543,total_sugar_g:55.3,saturated_fat_g:21.5,total_fat_g:31.4,sodium_mg:125,protein_g:7.6,carbohydrates_g:58.5,fiber_g:null};
const product={product_name:'Milk chocolate',categories:'en:chocolates'};
test('Image/label adapter yields E and overrides any model rating',()=>{
 const response={rating:10,...scoringFields(product,n)};
 assert.equal(response.rating,null);assert.equal(response.nutrition_score.grade,'E');
 assert.equal(response.nutrition_score.breakdown.negativeTotal,32);
});
test('Unknown and excluded products do not fall through to general food',()=>{
 assert.equal(scoreAnalysis({product_name:'Unknown'},n).grade,null);
 assert.equal(scoreAnalysis({product_name:'Baby cereal'},n).status,'not_applicable');
 assert.equal(resolveCategory({product_name:'Juice powder'}).category,undefined);
 assert.equal(scoreAnalysis({product_name:'Olive oil'},n).grade,null);
});
test('Beverage grade is retained only when all missing-data possibilities agree',()=>{
 const certain=scoreAnalysis({product_category:'beverages'},{...n,label_basis:'per_100ml'});
 assert.equal(certain.grade,'E');
 assert.equal(certain.status,'grade_only');
 assert.equal(certain.rawScore,null);
 assert.ok(certain.scoreRange.min>9);
 assert.ok(certain.missingFields.includes('hasSpecifiedSweeteners'));
 assert.equal(certain.breakdown.negative.sweeteners,null);
 const uncertain=scoreAnalysis({product_category:'beverages'}, {
  label_basis:'per_100ml',calories:0,total_sugar_g:0,saturated_fat_g:0,
  total_fat_g:0,sodium_mg:0,protein_g:0,carbohydrates_g:0,fiber_g:0,
 });
 assert.equal(uncertain.grade,null);
 assert.equal(uncertain.status,'insufficient_data');
 assert.ok(uncertain.missingFields.includes('hasSpecifiedSweeteners'));
});
test('Conflicting basis withholds the grade',()=>{
 assert.equal(scoreAnalysis(product,{...n,label_basis:'unknown'}).grade,null);
});
test('Valid 50g serving is scaled once, never heuristically halved',()=>{
 const r=scoreAnalysis(product,{...n,label_basis:'per_serving',serving_size:'50 g',calories:230,total_fat_g:10,saturated_fat_g:5,carbohydrates_g:30,total_sugar_g:20,protein_g:5});
 assert.equal(r.normalized.energyKcal,460);assert.equal(r.normalized.sugarsG,40);
});
test('Blocked barcode validation cannot produce a grade',()=>assert.equal(scoreAnalysis(product,n,{blockedReason:'Invalid source'}).grade,null));
// Import the real API handler with Next aliases resolved, without a web server.
async function loadBarcodeHandler() {
 let source=await readFile(new URL('../pages/api/analyzeBarcode.js',import.meta.url),'utf8');
 source=source.replace(/"@\/([^"]+)"/g,(_,path)=>JSON.stringify(new URL('../'+path,import.meta.url).href+(path.endsWith('.mjs')?'':'.js')));
 return (await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
}
test('Real barcode handler returns deterministic grade with no AI key',async()=>{
 const original=process.env.GROQ_API_KEY;delete process.env.GROQ_API_KEY;
 try {
  const handler=await loadBarcodeHandler(); let status,body;
  const res={status(code){status=code;return this;},json(value){body=value;return this;}};
  await handler({method:'POST',body:{product:{...product,quantity:'64g',ingredients:'Sugar, milk solids, cocoa butter, cocoa solids',nutrients_per_100g:{'energy-kcal':543,fat:31.4,'saturated-fat':21.5,carbohydrates:58.5,sugars:55.3,proteins:7.6,sodium:0.125}}}},res);
  assert.equal(status,200);assert.equal(body.data.nutrition_score.grade,'E');assert.equal(body.data.rating,null);
 } finally { if(original===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=original; }
});

test('Quick barcode analysis returns a grade without calling optional AI or web research',async()=>{
 const originalKey=process.env.GROQ_API_KEY;
 const originalFetch=globalThis.fetch;
 process.env.GROQ_API_KEY='test-key';
 try {
  const handler=await loadBarcodeHandler(); let status,body;
  globalThis.fetch=async()=>{throw Error('Quick barcode analysis must not use external APIs')};
  const res={status(code){status=code;return this;},json(value){body=value;return this;}};
  await handler({method:'POST',body:{quick:true,product:{...product,barcode:'9300605155459',ingredients:'Unknown',quantity:'Unknown',nutrients_per_100g:{'energy-kcal':543,fat:31.4,'saturated-fat':21.5,carbohydrates:58.5,sugars:55.3,proteins:7.6,sodium:0.125}}}},res);
  assert.equal(status,200);
  assert.equal(body.data.nutrition_score.grade,'E');
  assert.equal(body.data.rating,null);
  assert.equal(body.data.analysis_pending,true);
  assert.equal(body.data.barcode,'9300605155459');
 }finally{
  globalThis.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY=originalKey;
 }
});

test('Silk Chocolate with missing salt still has a certain E grade, not a fabricated exact score',()=>{
 const withoutSodium={...n,sodium_mg:null};
 const r=scoreAnalysis({product_name:'Silk Chocolate',categories:'en:chocolates'},withoutSodium);
 assert.equal(r.status,'grade_only');
 assert.equal(r.grade,'E');
 assert.equal(r.rawScore,null);
 assert.deepEqual(r.scoreRange,{min:21,max:51});
 assert.ok(r.missingFields.includes('saltG'));
});

test('barcode accepts sparse food and explicitly per-100ml beverage records', async () => {
 const handler = await loadBarcodeHandler();
 for (const [category, field, expected] of [['chocolate','nutrients_per_100g','D'], ['beverages','nutrients_per_100ml','E']]) {
  const res = {status(code) {this.code=code;return this;}, json(body) {this.body=body;}};
  await handler({method:'POST',body:{quick:true, product:{categories:category, [field]:{sugars:40}}}},res);
  assert.equal(res.code,200);
  assert.equal(res.body.data.nutrition_score.grade,null);
  assert.equal(res.body.data.nutrition_score.partialRating.grade,expected);
  assert.equal(res.body.data.nutrition_source,'open_food_facts');
 }
});
