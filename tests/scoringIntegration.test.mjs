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
test('Beverage sweetener uncertainty and conflicting basis withhold grades',()=>{
 assert.equal(scoreAnalysis({product_category:'beverages'},{...n,label_basis:'per_100ml'}).grade,null);
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
 source=source.replace(/"@\/([^\"]+)"/g,(_,path)=>JSON.stringify(new URL('../'+path,import.meta.url).href+(path.endsWith('.mjs')?'':'.js')));
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
