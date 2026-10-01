const analysisIds = new WeakMap();

export function isAnalysisId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{16,128}$/.test(value);
}

export function getAnalysisId(aiData) {
  if (!aiData || typeof aiData !== "object" || Array.isArray(aiData)) {
    throw new Error("A product analysis is required to save history.");
  }
  let id = analysisIds.get(aiData);
  if (!id) {
    id = isAnalysisId(aiData.analysis_id)
      ? aiData.analysis_id
      : globalThis.crypto.randomUUID();
    analysisIds.set(aiData, id);
  }
  return id;
}

export function isPermanentImageUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function prepareHistoryImage(sourceUrl, prepareBlobImage) {
  if (!sourceUrl || typeof sourceUrl !== "string") return null;
  if (isPermanentImageUrl(sourceUrl) || sourceUrl.startsWith("data:image/")) {
    return sourceUrl;
  }
  if (sourceUrl.startsWith("blob:")) return prepareBlobImage(sourceUrl);
  return null;
}

// The same analysis object survives effect cleanup/replay. Share completed
// uploads and in-flight saves, while allowing a failed operation to be retried.
export function createHistorySaver({ prepareImage, uploadImage, save }) {
  const analyses = new WeakMap();
  return async function saveHistory({
    aiData, userId, productName, imageFrontUrl, imageNutritionImage,
    isCurrent = () => true,
  }) {
    if (!userId || !aiData || !isCurrent()) return null;
    let users = analyses.get(aiData);
    if (!users) {
      users = new Map();
      analyses.set(aiData, users);
    }
    let entry = users.get(userId);
    if (!entry) {
      entry = { analysisId: getAnalysisId(aiData), images: new Map() };
      users.set(userId, entry);
    }
    if (entry.result) return entry.result;

    function permanentImage(source, folder) {
      if (!source) return Promise.resolve(null);
      const key = `${folder}\0${source}`;
      if (!entry.images.has(key)) {
        const promise = Promise.resolve()
          .then(() => prepareImage(source))
          .then((image) => isPermanentImageUrl(image) ? image : image ? uploadImage(image, folder) : null)
          .catch((error) => {
            entry.images.delete(key);
            throw error;
          });
        entry.images.set(key, promise);
      }
      return entry.images.get(key);
    }
    const [frontUrl, nutritionUrl] = await Promise.all([
      permanentImage(imageFrontUrl, "history-front"),
      permanentImage(imageNutritionImage, "history-label"),
    ]);
    if (!isCurrent()) return null;
    if (entry.result) return entry.result;
    if (!entry.savePromise) {
      // Start while this effect is current; another effect may safely join the
      // request, but a stale effect must never initiate a later request.
      entry.savePromise = (async () => save({
        analysisId: entry.analysisId,
        productName: productName || aiData.product_name || "Unknown product",
        imageFrontUrl: frontUrl,
        imageNutritionImage: nutritionUrl,
        aiData: { ...aiData, analysis_id: entry.analysisId },
      }))()
        .then((result) => {
          if (result) entry.result = result;
          return result;
        })
        .finally(() => { entry.savePromise = null; });
    }
    return entry.savePromise;
  };
}
