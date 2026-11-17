import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Updating saved analysis is restricted to the signed-in owner',async()=>{
 const source=(await readFile(new URL('../pages/api/previousSearches/products.js',import.meta.url),'utf8'))
  .replace('import { getAuth } from "@clerk/nextjs/server";', '')
  .replace('import { prisma } from "@/app/utils/prisma";', '');
 const captured=[];
 const original=globalThis.__historyTest;
 globalThis.__historyTest={
  getAuth:()=>({userId:'current-user'}),
  prisma:{productSearch:{updateMany:async(options)=>{captured.push(options);return {count:1};}}},
 };
 try {
  const injected=`const getAuth=globalThis.__historyTest.getAuth;const prisma=globalThis.__historyTest.prisma;\n${source}`;
  const handler=(await import('data:text/javascript;base64,'+Buffer.from(injected).toString('base64'))).default;
  let status,body;
  const res={status(code){status=code;return this;},json(value){body=value;return this;}};
  await handler({method:'PATCH',body:{id:'scan-123',aiData:{analysis_pending:false}}},res);
  assert.equal(status,200);
  assert.deepEqual(body,{success:true});
  assert.deepEqual(captured[0].where,{id:'scan-123',userId:'current-user'});
  assert.deepEqual(captured[0].data,{aiData:{analysis_pending:false}});
 }finally{
  if(original===undefined)delete globalThis.__historyTest;
  else globalThis.__historyTest=original;
 }
});
