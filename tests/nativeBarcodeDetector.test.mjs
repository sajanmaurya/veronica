import test from "node:test";
import assert from "node:assert/strict";
import { makeNativeBarcodeDetector, firstDetectedRetailBarcode } from "../lib/nativeBarcodeDetector.mjs";

test("native scanner uses only supported retail barcode formats", async () => {
  class Detector {
    static async getSupportedFormats() { return ["qr_code", "ean_13", "ean_8"]; }
    constructor(options) { this.formats = options.formats; }
  }
  assert.deepEqual((await makeNativeBarcodeDetector(Detector)).formats, ["ean_13", "ean_8"]);
});

test("native scanner safely falls back when unsupported or unavailable", async () => {
  assert.equal(await makeNativeBarcodeDetector(undefined), null);
  class Unsupported { static async getSupportedFormats() { return ["qr_code"]; } }
  assert.equal(await makeNativeBarcodeDetector(Unsupported), null);
  class Erroring { static async getSupportedFormats() { throw Error("unsupported"); } }
  assert.equal(await makeNativeBarcodeDetector(Erroring), null);
});

test("native detections only accept numeric retail barcodes", () => {
  assert.equal(firstDetectedRetailBarcode([{ format: "qr_code", rawValue: "9300605155459" }, { format: "ean_13", rawValue: "9300605155459" }]), "9300605155459");
  assert.equal(firstDetectedRetailBarcode([{ format: "ean_13", rawValue: "invalid" }]), "");
  assert.equal(firstDetectedRetailBarcode(null), "");
});
