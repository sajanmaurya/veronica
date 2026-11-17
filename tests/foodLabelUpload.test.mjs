import test from "node:test";
import assert from "node:assert/strict";
import { analyzeFoodLabel, parseFoodLabelResponse, prepareFoodLabelImage, MAX_LABEL_UPLOAD_BYTES } from "../lib/foodLabelUpload.mjs";

test("small supported photos are not recompressed", async () => {
  const image = new File(["image"], "label.png", {type:"image/png"});
  assert.equal(await prepareFoodLabelImage(image), image);
});

test("invalid and empty uploads are rejected before reaching the server", async () => {
  await assert.rejects(() => prepareFoodLabelImage(null), /non-empty/);
  await assert.rejects(() => prepareFoodLabelImage(new File(["bad"], "label.pdf", {type:"application/pdf"})), /photo/);
});

test("oversized camera photo is converted to an upload-safe JPEG", async () => {
  const originalBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  let closed = false;
  let drawCalls = 0;
  try {
    globalThis.createImageBitmap = async () => ({width:4000,height:3000,close(){closed=true;}});
    globalThis.document = {createElement() {
      return {width:0,height:0,getContext() {return {fillRect(){},drawImage(){drawCalls++;}};},
        toBlob(callback) {callback(new Blob(["compressed photo"], {type:"image/jpeg"}));}};
    }};
    const file = new File([new Uint8Array(5_000_000)], "large.jpg", {type:"image/jpeg"});
    const prepared = await prepareFoodLabelImage(file);
    assert.equal(prepared.type, "image/jpeg");
    assert.ok(prepared.size <= MAX_LABEL_UPLOAD_BYTES);
    assert.ok(drawCalls > 0);
    assert.equal(closed, true);
  } finally {
    if (originalBitmap === undefined) delete globalThis.createImageBitmap;
    else globalThis.createImageBitmap = originalBitmap;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test("Vercel 413 HTML error becomes a useful message", async () => {
  await assert.rejects(
    () => parseFoodLabelResponse(new Response("<html>Too large</html>", {status:413, headers:{"content-type":"text/html"}})),
    /too large/
  );
});

test("API configuration problems are shown instead of generic invalid JSON", async () => {
  await assert.rejects(
    () => parseFoodLabelResponse(new Response(JSON.stringify({error:"Groq API key is not configured."}),
      {status:500,headers:{"content-type":"application/json"}})),
    /Groq API key/
  );
});

test("successful analysis sends multipart photo and profile", async () => {
  const image = new File(["image"], "label.jpg", {type:"image/jpeg"});
  const statuses = [];
  const result = await analyzeFoodLabel(image, {allergies:"peanuts"}, {
    onStage: value => statuses.push(value),
    fetchImpl: async (url, options) => {
      assert.equal(url, "/api/analyzeImage");
      assert.equal(options.method, "POST");
      assert.equal(options.body.get("image"), image);
      assert.equal(JSON.parse(options.body.get("profile")).allergies, "peanuts");
      return new Response(JSON.stringify({success:true,data:{product_name:"Test Food"}}),
        {status:200,headers:{"content-type":"application/json"}});
    },
  });
  assert.equal(result.product_name, "Test Food");
  assert.equal(statuses.length, 2);
});
