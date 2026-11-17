import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function loadHandler() {
  const source = await readFile(new URL('../pages/api/scanBarcode/[barcode].js', import.meta.url), 'utf8');
  return (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).default;
}

async function invoke(handler, barcode, method = 'GET') {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler({ method, query: { barcode } }, res);
  return res;
}

test('barcode lookup returns product data and uses an identifiable API client', async () => {
  const handler = await loadHandler();
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.match(url, /8901234567890\.json$/);
      assert.match(options.headers['User-Agent'], /Veronica/);
      return { ok: true, json: async () => ({ status: 1, product: { code: '8901234567890', product_name: 'Test snack' } }) };
    };
    const response = await invoke(handler, '8901234567890');
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.product_name, 'Test snack');
    assert.equal(response.body.data.image_front_url, null);
    assert.equal(response.body.data.image_nutrition_url, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('barcode lookup uses the generic product photo when a front photo is missing', async () => {
  const handler = await loadHandler();
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({
      status: 1, product: { product_name: 'Chocolate', image_url: 'https://images.openfoodfacts.org/chocolate.jpg' },
    }) });
    const response = await invoke(handler, '9300605155459');
    assert.equal(response.body.data.image_front_url, 'https://images.openfoodfacts.org/chocolate.jpg');
  } finally { globalThis.fetch = originalFetch; }
});

test('barcode lookup separates missing products from network failures', async () => {
  const handler = await loadHandler();
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  try {
    // These failures are intentional; the endpoint still logs real failures.
    console.error = () => {};
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ status: 0 }) });
    assert.equal((await invoke(handler, '8901234567890')).statusCode, 404);

    globalThis.fetch = async () => ({ ok: false, status: 429 });
    const rateLimited = await invoke(handler, '8901234567890');
    assert.equal(rateLimited.statusCode, 503);
    assert.match(rateLimited.body.error, /temporarily unavailable/i);

    globalThis.fetch = async () => { throw new Error('connection failed'); };
    assert.equal((await invoke(handler, '8901234567890')).statusCode, 503);

    let called = false;
    globalThis.fetch = async () => { called = true; };
    assert.equal((await invoke(handler, 'not-a-barcode')).statusCode, 400);
    assert.equal((await invoke(handler, '8901234567890', 'POST')).statusCode, 405);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});
