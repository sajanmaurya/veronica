/** Prefer the browser's optimized detector when it supports retail barcodes. */
export const RETAIL_BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

export async function makeNativeBarcodeDetector(Detector) {
  if (typeof Detector !== "function" || typeof Detector.getSupportedFormats !== "function") return null;
  try {
    const supported = await Detector.getSupportedFormats();
    const formats = RETAIL_BARCODE_FORMATS.filter((format) => supported.includes(format));
    return formats.length ? new Detector({ formats }) : null;
  } catch {
    return null;
  }
}

export function firstDetectedRetailBarcode(results) {
  if (!Array.isArray(results)) return "";
  const supported = new Set(RETAIL_BARCODE_FORMATS);
  for (const result of results) {
    const value = String(result?.rawValue ?? "").trim();
    if (supported.has(result?.format) && /^\d{8,14}$/.test(value)) return value;
  }
  return "";
}
