import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("signed-in profile saves, reloads and clears diet and allergies under the session owner", async () => {
  let userId = "user-a";
  const records = new Map();
  const db = {userProfile: {
    findUnique: async ({where}) => records.get(where.userId) || null,
    upsert: async ({where, update, create}) => {
      const row = records.has(where.userId) ? {...records.get(where.userId), ...update} : create;
      records.set(where.userId,row);
      return row;
    }
  }};
  const source = (await readFile(new URL("../pages/api/auth/userProfile.js",import.meta.url),"utf8"))
    .replace(/import .*?;\n/g,"").replace("export default async function handler", "return async function handler");
  const handler = new Function("prisma","getAuth",source)(db, () => ({userId}));
  const request = async (method, body) => {
    const res = { setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;} };
    await handler({method,body,query:{userId:"user-b"}},res);
    return res;
  };
  await request("POST",{userId:"user-b",dietaryPreferences:"Vegan",allergies:"Milk, sesame"});
  assert.equal((await request("GET")).data.dietaryPreferences,"Vegan");
  assert.equal((await request("GET")).data.allergies,"Milk, sesame");
  await request("POST",{allergies:""});
  assert.equal((await request("GET")).data.allergies,"");
  assert.equal((await request("GET")).data.dietaryPreferences,"Vegan");
  userId = "user-b";
  assert.equal((await request("GET")).data,null);
  userId = null;
  assert.equal((await request("GET")).code,401);
});
