import { createHash } from "node:crypto";
import { isAnalysisId, isPermanentImageUrl } from "./history.mjs";

export function historyRecordId(userId, analysisId) {
  return `scan_${createHash("sha256")
    .update("veronica/history/v1\0")
    .update(userId)
    .update("\0")
    .update(analysisId)
    .digest("hex")}`;
}

function validJson(value, depth = 0) {
  if (depth > 15) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => validJson(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.entries(value).every(([key, item]) =>
      key !== "__proto__" && validJson(item, depth + 1)
    );
  }
  return false;
}

export function validateHistoryInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("A history record is required.");
  }
  const { analysisId, productName, imageFrontUrl, imageNutritionImage, aiData } = body;
  if (!isAnalysisId(analysisId)) throw new Error("A valid analysisId is required.");
  if (!aiData || typeof aiData !== "object" || Array.isArray(aiData) ||
      typeof aiData.rating !== "number" || !Number.isFinite(aiData.rating) ||
      aiData.rating < 0 || aiData.rating > 10 || typeof aiData.summary !== "string" ||
      !validJson(aiData) || JSON.stringify(aiData).length > 512 * 1024) {
    throw new Error("Invalid product analysis.");
  }
  if (productName != null && (typeof productName !== "string" || productName.length > 300)) {
    throw new Error("Invalid product name.");
  }
  for (const url of [imageFrontUrl, imageNutritionImage]) {
    if (url != null && url !== "" &&
        (typeof url !== "string" || url.length > 2048 || !isPermanentImageUrl(url))) {
      throw new Error("History images must use permanent HTTPS URLs.");
    }
  }
  return {
    analysisId,
    productName: productName?.trim() || "Unknown product",
    imageFrontUrl: imageFrontUrl || null,
    imageNutritionImage: imageNutritionImage || null,
    aiData: { ...aiData, analysis_id: analysisId },
  };
}

export function createHistoryHandler({ getUserId, prisma, logger = console }) {
  return async function handler(req, res) {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (req.method === "POST") {
      let input;
      try {
        input = validateHistoryInput(req.body);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
      try {
        await prisma.userProfile.upsert({
          where: { userId }, update: {},
          create: { userId, name: "Guest User", email: "guest@example.com" },
        });
        const id = historyRecordId(userId, input.analysisId);
        const productSearch = await prisma.productSearch.upsert({
          where: { id }, update: {},
          create: {
            id, userId,
            productName: input.productName,
            imageFrontUrl: input.imageFrontUrl,
            imageNutritionImage: input.imageNutritionImage,
            aiData: input.aiData,
          },
        });
        return res.status(201).json(productSearch);
      } catch (error) {
        logger.error("Failed to save product search:", error);
        return res.status(500).json({ error: "Failed to save product search" });
      }
    }
    if (req.method === "GET") {
      try {
        const searches = await prisma.productSearch.findMany({
          where: { userId }, orderBy: { createdAt: "desc" },
        });
        return res.status(200).json(searches);
      } catch (error) {
        logger.error("Failed to fetch product searches:", error);
        return res.status(500).json({ error: "Failed to fetch product searches" });
      }
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  };
}
