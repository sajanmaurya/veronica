/**
 * Prepare camera/gallery photos for Veronica's image-analysis endpoint.
 * Vercel Functions reject request bodies over 4.5 MB; keep the entire
 * multipart request comfortably smaller. This does not alter food facts.
 */
export const MAX_LABEL_UPLOAD_BYTES = 2_800_000;
const SUPPORTED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function prepareFoodLabelImage(file) {
  if (!file || typeof file.size !== "number" || file.size <= 0) {
    throw new Error("Choose a non-empty food-label photo.");
  }
  const type = String(file.type || "").toLowerCase();
  if (!type.startsWith("image/")) {
    throw new Error("Please choose a photo, not a document or other file.");
  }
  if (file.size <= MAX_LABEL_UPLOAD_BYTES && SUPPORTED.has(type)) return file;

  let decoded;
  let objectUrl;
  try {
    if (typeof createImageBitmap === "function") {
      decoded = await createImageBitmap(file);
    } else {
      objectUrl = URL.createObjectURL(file);
      decoded = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("This photo format cannot be read by this browser."));
        image.src = objectUrl;
      });
    }
    const width = decoded.width || decoded.naturalWidth;
    const height = decoded.height || decoded.naturalHeight;
    if (!width || !height) throw new Error("Could not read the dimensions of the photo.");

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image compression is unavailable in this browser.");

    const toJpeg = quality => new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob?.size ? resolve(blob) : reject(new Error("Could not compress the photo.")), "image/jpeg", quality);
    });

    // Keep text legible first; decrease image size only as necessary.
    for (const maxEdge of [2560, 2200, 1800, 1500, 1200]) {
      const scale = Math.min(1, maxEdge / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      context.fillStyle = "#ffffff"; // JPEG has no transparency.
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(decoded, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.88, 0.76, 0.63]) {
        const blob = await toJpeg(quality);
        if (blob.size <= MAX_LABEL_UPLOAD_BYTES) {
          return new File([blob], "veronica-food-label.jpg", {type:"image/jpeg", lastModified:Date.now()});
        }
      }
    }
    throw new Error("This photo remains too large. Crop to the nutrition or ingredients label and try again.");
  } catch (error) {
    if (error?.message?.includes("too large") || error?.message?.includes("compression")) throw error;
    throw new Error("Unable to prepare this photo. Try a JPG/PNG image or take a new picture of the label.");
  } finally {
    if (typeof decoded?.close === "function") decoded.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export async function parseFoodLabelResponse(response) {
  if (response.status === 413) {
    throw new Error("The photo is too large for the server. Try cropping the label and uploading again.");
  }
  const type = response.headers?.get?.("content-type") || "";
  let body = null;
  if (type.includes("application/json")) {
    try { body = await response.json(); } catch {}
  } else {
    // Proxy and timeout errors can return HTML rather than JSON.
    try { await response.text(); } catch {}
  }
  if (!response.ok || !body?.success || !body?.data) {
    if (response.status === 429) throw new Error(body?.error || "Image analysis is rate-limited. Try again shortly.");
    if ([502,503,504].includes(response.status)) throw new Error(body?.error || "The image-analysis service is temporarily unavailable. Please try again.");
    throw new Error(body?.error || (response.ok
      ? "The image-analysis service returned an incomplete result."
      : "Could not analyze this photo. Please try again."));
  }
  return body.data;
}

export async function analyzeFoodLabel(file, profile, {onStage, fetchImpl} = {}) {
  onStage?.("Preparing photo…");
  const prepared = await prepareFoodLabelImage(file);
  const formData = new FormData();
  formData.append("image", prepared);
  formData.append("profile", JSON.stringify({
    diseases: profile?.diseases || null,
    allergies: profile?.allergies || null,
    dietaryPreferences: profile?.dietaryPreferences || null,
  }));
  onStage?.("Reading nutrition label…");
  const send = fetchImpl || fetch;
  let response;
  try {
    response = await send("/api/analyzeImage", {method:"POST", body:formData});
  } catch {
    throw new Error("Could not reach Veronica's image-analysis service. Check your connection and retry.");
  }
  return parseFoodLabelResponse(response);
}
