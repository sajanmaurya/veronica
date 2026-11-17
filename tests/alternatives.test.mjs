import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function loadHandler() {
  const source = await readFile(new URL("../pages/api/alternatives/index.js", import.meta.url), "utf8");
  return (await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"))).default;
}
async function invoke(nutrition, candidates) {
  const handler = await loadHandler();
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ok:true,json:async()=>({products:candidates})});
    const res = {statusCode:200,body:null,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
    await handler({method:"POST",body:{product:{product_category:"en:chocolates",nutrition:{label_basis:"per_100g",...nutrition}}}},res);
    assert.equal(res.statusCode,200);
    return res.body.data.alternatives;
  } finally {globalThis.fetch=previousFetch;}
}
const candidate=(code,nutriments)=>({code,product_name:"Candidate "+code,nutriments});

test("missing alternative sugar is not falsely reported as 100 percent lower",async()=>{
  const results=await invoke({total_sugar_g:55.3,sodium_mg:125},[
    candidate("missing",{sugars_100g:null,sodium_100g:0.125})
  ]);
  assert.deepEqual(results,[]);
});
test("missing current nutrition is not treated as zero",async()=>{
  const results=await invoke({total_sugar_g:null,sodium_mg:null},[
    candidate("zero",{sugars_100g:0,sodium_100g:0.125})
  ]);
  assert.deepEqual(results,[]);
});
test("a verified decrease in sugar still produces a precise comparison",async()=>{
  const results=await invoke({total_sugar_g:55.3,sodium_mg:125},[
    candidate("lower",{sugars_100g:40,sodium_100g:0.125})
  ]);
  assert.equal(results.length,1);
  assert.ok(results[0].reasons.some(reason=>reason.text==="28% less sugar"));
  assert.ok(!results[0].reasons.some(reason=>reason.key==="sodium"));
});
test("sodium from Open Food Facts is converted from grams to milligrams",async()=>{
  const results=await invoke({total_sugar_g:55.3,sodium_mg:125},[
    candidate("salt",{sugars_100g:55.3,sodium_100g:0.1})
  ]);
  assert.equal(results.length,1);
  assert.ok(results[0].reasons.some(reason=>reason.text==="20% less sodium"));
});
