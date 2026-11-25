import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function loadHandler() {
  const source = await readFile(new URL("../pages/api/alternatives/index.js", import.meta.url), "utf8");
  return (await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"))).default;
}
async function invoke(nutrition, candidates, product = { product_category: "en:chocolates" }, queries = []) {
  const handler = await loadHandler();
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async url => {
      queries.push(new URL(url));
      return {ok:true,json:async()=>({products:candidates})};
    };
    const res = {statusCode:200,body:null,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
    await handler({method:"POST",body:{product:{...product,nutrition:{label_basis:"per_100g",...nutrition}}}},res);
    assert.equal(res.statusCode,200);
    return res.body.data.alternatives;
  } finally {globalThis.fetch=previousFetch;}
}
const candidate=(code,nutriments)=>({code,product_name:"Candidate "+code,categories_tags:["en:chocolates"],nutriments});

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

const water = {
  code: "water", product_name: "CRISTALINE Eau De Source 0.5L",
  categories_tags: ["en:beverages", "en:waters", "en:spring-waters"],
  nutriments: { sugars_100g: 0 },
};
const wrapper = { label_basis: "per_serving", serving_size: "3 fingers (32g)", total_sugar_g: 16 };

test("the wrapper identified only as Snacks returns no alternatives or catalog request", async () => {
  const queries = [];
  const items = await invoke(wrapper, [water], { product_category: "Snacks", product_name: "Scanned food" }, queries);
  assert.deepEqual(items, []);
  assert.deepEqual(queries, []);
});

test("a chocolate wafer scan excludes water, other snacks and untagged results before ranking", async () => {
  const queries = [];
  const biscuit = { ...candidate("biscuit", { sugars_100g: 10 }), categories_tags: ["en:snacks", "en:biscuits"] };
  const untagged = { ...candidate("untagged", { sugars_100g: 0 }), categories_tags: [] };
  const wafer = { ...candidate("wafer", { sugars_100g: 40 }), categories_tags: ["en:snacks"], categories_tags_en: ["Candy chocolate bars filled with wafer"] };
  const items = await invoke(wrapper, [water, biscuit, untagged, wafer], { product_category: "Chocolate wafer bar" }, queries);
  assert.deepEqual(items.map(item => item.barcode), ["wafer"]);
  assert.equal(items[0].reasons[0].text, "20% less sugar");
  assert.equal(queries[0].searchParams.get("categories_tags_en"), "candy chocolate bars filled with wafer");
  assert.ok(queries[0].searchParams.get("fields").split(",").includes("categories_tags"));
});

test("a barcode comparison uses the specific taxonomy tag even when display categories are broad", async () => {
  const product = { code: "scanned", categories_tags: ["en:snacks", "en:chocolates", "en:dark-chocolates"], product_category: "Snacks" };
  const dark = { ...candidate("dark", { sugars_100g: 20 }), categories_tags: ["en:chocolates", "en:dark-chocolates"] };
  const items = await invoke(wrapper, [water, dark, { ...dark, code: "scanned" }, candidate("other-chocolate", { sugars_100g: 15 })], product);
  assert.deepEqual(items.map(item => item.barcode), ["dark"]);
});
