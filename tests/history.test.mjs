import test from "node:test";
import assert from "node:assert/strict";
import {
  createHistorySaver, getAnalysisId, prepareHistoryImage,
} from "../lib/history.mjs";
import {
  createHistoryHandler, historyRecordId,
} from "../lib/history-handler.mjs";

const analysis = () => ({ rating: 7, summary: "A balanced snack.", product_name: "Test snack" });
const scanId = "b2aba660-2b10-411e-adb3-724a4ab6dfd2";

function response() {
  return {
    statusCode: 200, headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(key, value) { this.headers[key] = value; },
  };
}

function database() {
  const rows = new Map();
  let calls = 0;
  return {
    rows,
    get calls() { return calls; },
    userProfile: { async upsert() { calls += 1; } },
    productSearch: {
      async upsert({ where, create }) {
        calls += 1;
        if (!rows.has(where.id)) rows.set(where.id, { ...create });
        return rows.get(where.id);
      },
      async findMany({ where }) {
        calls += 1;
        return [...rows.values()].filter((row) => row.userId === where.userId);
      },
    },
  };
}

const input = (overrides = {}) => ({
  analysisId: scanId,
  productName: "Test snack",
  imageFrontUrl: "https://images.example.com/snack.jpg",
  aiData: analysis(),
  ...overrides,
});

test("a scan ID is stable across effect reruns but a new scan gets its own ID", () => {
  const data = analysis();
  assert.equal(getAnalysisId(data), getAnalysisId(data));
  assert.notEqual(getAnalysisId(data), getAnalysisId(analysis()));
  assert.equal(getAnalysisId({ ...data, analysis_id: scanId }), scanId);
});

test("existing HTTPS product images survive history preparation unchanged", async () => {
  const url = "https://images.openfoodfacts.org/images/products/123/front.jpg";
  const result = await prepareHistoryImage(url, () => {
    assert.fail("A permanent image must not be decoded or recompressed.");
  });
  assert.equal(result, url);
  assert.equal(await prepareHistoryImage("Unknown", () => assert.fail()), null);
});

test("overlapping effect runs share uploads and save the analysis once", async () => {
  let uploads = 0;
  let saves = 0;
  let release;
  const uploadGate = new Promise((resolve) => { release = resolve; });
  const saveHistory = createHistorySaver({
    prepareImage: async (source) => source,
    uploadImage: async () => {
      uploads += 1;
      await uploadGate;
      return "https://storage.example.com/saved.webp";
    },
    save: async (record) => { saves += 1; return { id: "saved", ...record }; },
  });
  const data = analysis();
  const options = { aiData: data, userId: "user-a", imageFrontUrl: "blob:front" };
  const first = saveHistory(options);
  const second = saveHistory(options);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(uploads, 1);
  assert.equal(saves, 1);
  assert.equal(a.analysisId, b.analysisId);
  await saveHistory(options);
  assert.equal(saves, 1);
});

test("saving a barcode analysis preserves both remote images without new uploads", async () => {
  const saveHistory = createHistorySaver({
    prepareImage: (source) => prepareHistoryImage(source, () => assert.fail()),
    uploadImage: () => assert.fail("Existing HTTPS images must not be uploaded again."),
    save: async (record) => record,
  });
  const front = "https://images.example.com/front.jpg";
  const label = "https://images.example.com/nutrition.jpg";
  const saved = await saveHistory({
    aiData: analysis(), userId: "user-a",
    imageFrontUrl: front, imageNutritionImage: label,
  });
  assert.equal(saved.imageFrontUrl, front);
  assert.equal(saved.imageNutritionImage, label);
});

test("a cancelled effect leaves uploads reusable for its current replacement", async () => {
  let current = true;
  let uploads = 0;
  let saves = 0;
  const saveHistory = createHistorySaver({
    prepareImage: async (source) => source,
    uploadImage: async () => { uploads += 1; return "https://storage.example.com/saved.webp"; },
    save: async (record) => { saves += 1; return record; },
  });
  const options = { aiData: analysis(), userId: "user-a", imageFrontUrl: "blob:front" };
  const stale = saveHistory({ ...options, isCurrent: () => current });
  current = false;
  const replacement = saveHistory(options);
  assert.equal(await stale, null);
  assert.ok(await replacement);
  assert.equal(uploads, 1);
  assert.equal(saves, 1);
});

test("a failed save can retry with the same scan ID and completed uploads", async () => {
  let uploads = 0;
  const ids = [];
  const saveHistory = createHistorySaver({
    prepareImage: async (source) => source,
    uploadImage: async () => { uploads += 1; return "https://storage.example.com/saved.webp"; },
    save: async (record) => {
      ids.push(record.analysisId);
      if (ids.length === 1) throw new Error("Temporary connection failure");
      return record;
    },
  });
  const options = { aiData: analysis(), userId: "user-a", imageFrontUrl: "blob:front" };
  await assert.rejects(saveHistory(options), /Temporary connection/);
  const saved = await saveHistory(options);
  assert.equal(ids[0], ids[1]);
  assert.equal(saved.aiData.analysis_id, ids[0]);
  assert.equal(uploads, 1);
});

test("an upload retry reuses the successful image and retries only the failed image", async () => {
  const attempts = new Map();
  let saves = 0;
  const saveHistory = createHistorySaver({
    prepareImage: async (source) => source,
    uploadImage: async (source) => {
      const attempt = (attempts.get(source) || 0) + 1;
      attempts.set(source, attempt);
      if (source === "blob:label" && attempt === 1) throw new Error("Upload interrupted");
      return `https://storage.example.com/${source.slice(5)}.webp`;
    },
    save: async (record) => { saves += 1; return record; },
  });
  const options = {
    aiData: analysis(), userId: "user-a",
    imageFrontUrl: "blob:front", imageNutritionImage: "blob:label",
  };
  await assert.rejects(saveHistory(options), /Upload interrupted/);
  assert.equal(saves, 0);
  const saved = await saveHistory(options);
  assert.equal(attempts.get("blob:front"), 1);
  assert.equal(attempts.get("blob:label"), 2);
  assert.equal(saved.imageNutritionImage, "https://storage.example.com/label.webp");
  assert.equal(saves, 1);
});

test("repeated POSTs for one authenticated scan create one immutable history record", async () => {
  const prisma = database();
  const handler = createHistoryHandler({ prisma, getUserId: () => "user-a" });
  const a = response();
  const b = response();
  await handler({ method: "POST", body: input() }, a);
  await handler({ method: "POST", body: input({ productName: "Changed on retry" }) }, b);
  assert.equal(a.statusCode, 201);
  assert.equal(b.statusCode, 201);
  assert.equal(prisma.rows.size, 1);
  assert.equal(a.body.id, b.body.id);
  assert.equal(b.body.productName, "Test snack");
  assert.equal(b.body.imageFrontUrl, input().imageFrontUrl);
  assert.equal(b.body.aiData.analysis_id, scanId);
});

test("the same client scan ID is scoped to Clerk identity, not request userId or record ID", async () => {
  const prisma = database();
  const handler = createHistoryHandler({ prisma, getUserId: (req) => req.sessionUserId });
  const a = response();
  const b = response();
  await handler({ method: "POST", sessionUserId: "user-a", body: input() }, a);
  await handler({
    method: "POST", sessionUserId: "user-b",
    body: input({ userId: "user-a", id: a.body.id, productName: "Another user's scan" }),
  }, b);
  assert.equal(prisma.rows.size, 2);
  assert.notEqual(a.body.id, b.body.id);
  assert.equal(b.body.userId, "user-b");
  assert.equal(prisma.rows.get(a.body.id).productName, "Test snack");
  assert.notEqual(historyRecordId("user-a", scanId), historyRecordId("user-b", scanId));
  const list = response();
  await handler({ method: "GET", sessionUserId: "user-b", query: { userId: "user-a" } }, list);
  assert.deepEqual(list.body.map((row) => row.id), [b.body.id]);
});

test("unauthenticated and invalid history writes cannot touch storage", async () => {
  const prisma = database();
  const unauthenticated = createHistoryHandler({ prisma, getUserId: () => null });
  const unauthorized = response();
  await unauthenticated({ method: "POST", body: input() }, unauthorized);
  assert.equal(unauthorized.statusCode, 401);
  const handler = createHistoryHandler({ prisma, getUserId: () => "user-a" });
  for (const body of [
    input({ analysisId: "" }),
    input({ aiData: [] }),
    input({ aiData: { rating: 11, summary: "Invalid rating" } }),
    input({ imageFrontUrl: "blob:temporary" }),
    input({ imageFrontUrl: "https://user:password@example.com/image.jpg" }),
  ]) {
    const res = response();
    await handler({ method: "POST", body }, res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(prisma.calls, 0);
});
