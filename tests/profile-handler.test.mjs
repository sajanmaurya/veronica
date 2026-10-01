import assert from "node:assert/strict";
import test from "node:test";
import { createProfileHandler } from "../lib/profile-handler.mjs";

function setup(options = {}) {
  const calls = [];
  const logs = [];
  const profiles = {
    async findUnique(args) {
      calls.push({ method: "findUnique", args });
      return options.existing ?? null;
    },
    async upsert(args) {
      calls.push({ method: "upsert", args });
      return options.existing
        ? { ...options.existing, ...args.update }
        : args.create;
    },
    ...options.profiles,
  };
  const handler = createProfileHandler({
    getAuth: options.getAuth ?? (() => ({ userId: "user_owner" })),
    profiles,
    returnDefaultProfile: options.returnDefaultProfile,
    logger: { error: (message) => logs.push(message) },
  });

  async function request(req) {
    const response = {
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    await handler({ query: {}, ...req }, response);
    return response;
  }

  return { calls, logs, request };
}

test("GET only reads the authenticated owner's profile without a client ID", async () => {
  const existing = { userId: "user_owner", name: "Owner", email: "owner@example.com" };
  const { request, calls } = setup({ existing });
  const response = await request({ method: "GET" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, existing);
  assert.deepEqual(calls, [
    { method: "findUnique", args: { where: { userId: "user_owner" } } },
  ]);
});

test("missing profiles preserve each endpoint's GET response", async () => {
  const fallback = await setup({ returnDefaultProfile: true }).request({ method: "GET" });
  assert.deepEqual(fallback.body, {
    userId: "user_owner",
    name: "Guest User",
    email: "guest@example.com",
    diseases: "",
    allergies: "",
  });
  const empty = await setup().request({ method: "GET" });
  assert.equal(empty.statusCode, 200);
  assert.equal(empty.body, null);
});

test("unauthenticated reads and writes cannot reach the database", async () => {
  for (const method of ["GET", "POST"]) {
    const { request, calls } = setup({ getAuth: () => ({ userId: null }) });
    const response = await request({ method, body: { name: "Guest" } });
    assert.equal(response.statusCode, 401);
    assert.deepEqual(calls, []);
  }
});

test("spoofed and malformed client IDs are rejected in either location", async () => {
  for (const req of [
    { method: "GET", query: { userId: "user_victim" } },
    { method: "GET", query: { userId: ["user_owner"] } },
    { method: "GET", query: { userId: "" } },
    { method: "POST", body: { userId: "user_victim", name: "Changed" } },
    {
      method: "POST",
      query: { userId: "user_owner" },
      body: { userId: "user_victim", name: "Changed" },
    },
    {
      method: "POST",
      query: { userId: "user_victim" },
      body: { userId: "user_owner", name: "Changed" },
    },
  ]) {
    const { request, calls } = setup();
    const response = await request(req);
    assert.equal(response.statusCode, 403);
    assert.deepEqual(calls, []);
  }
});

test("valid POST uses one atomic upsert and excludes the client ID from updates", async () => {
  const { request, calls } = setup();
  const response = await request({
    method: "POST",
    body: {
      userId: "user_owner",
      name: "  Owner  ",
      email: " owner@example.com ",
      diseases: " diabetes ",
      allergies: null,
    },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, [{
    method: "upsert",
    args: {
      where: { userId: "user_owner" },
      update: {
        name: "Owner",
        email: "owner@example.com",
        diseases: "diabetes",
        allergies: null,
      },
      create: {
        userId: "user_owner",
        name: "Owner",
        email: "owner@example.com",
        diseases: "diabetes",
        allergies: null,
      },
    },
  }]);
});

test("partial updates retain omitted values and can create a valid new profile", async () => {
  const existing = {
    userId: "user_owner",
    name: "Owner",
    email: "owner@example.com",
    diseases: "diabetes",
    allergies: "milk",
  };
  const { request, calls } = setup({ existing });
  const response = await request({ method: "POST", body: { allergies: "peanuts" } });
  assert.deepEqual(response.body, { ...existing, allergies: "peanuts" });
  assert.deepEqual(calls[0].args.update, { allergies: "peanuts" });

  const created = await setup().request({ method: "POST", body: { allergies: "milk" } });
  assert.equal(created.body.userId, "user_owner");
  assert.equal(created.body.name, "Guest User");
  assert.equal(created.body.email, "guest@example.com");
  assert.equal(created.body.allergies, "milk");
});

test("invalid profile bodies are rejected before any database write", async () => {
  for (const body of [
    undefined,
    null,
    "profile",
    [],
    {},
    { userId: "user_owner" },
    { name: "   " },
    { name: null },
    { name: "a".repeat(121) },
    { email: "not-an-email" },
    { email: "a".repeat(250) + "@example.com" },
    { diseases: ["diabetes"] },
    { allergies: 5 },
    { allergies: "a".repeat(2001) },
    { dietaryPreferences: "vegan" },
    { name: "Owner", id: 42 },
  ]) {
    const { request, calls } = setup();
    const response = await request({ method: "POST", body });
    assert.equal(response.statusCode, 400);
    assert.deepEqual(calls, []);
  }
});

test("unsupported methods advertise allowed methods without querying the database", async () => {
  const { request, calls } = setup();
  const response = await request({ method: "DELETE" });
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, "GET, POST");
  assert.deepEqual(calls, []);
});

test("authentication and database failures return generic errors without personal data", async () => {
  const privateError = new Error("Database URL and private allergies should stay private");
  for (const options of [
    { getAuth: () => { throw privateError; } },
    { profiles: { findUnique: async () => { throw privateError; } } },
    { profiles: { upsert: async () => { throw privateError; } } },
  ]) {
    const { request, logs } = setup(options);
    const response = await request({
      method: options.profiles?.upsert ? "POST" : "GET",
      body: { allergies: "private allergies" },
    });
    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, { error: "Internal server error" });
    assert.deepEqual(logs, ["Profile request failed"]);
  }
});
