import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/app/utils/prisma";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};

export default async function handler(req, res) {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "POST") {
    const { productName, imageFrontUrl, imageNutritionImage, aiData } =
      req.body;

    try {
      await prisma.userProfile.upsert({
        where: { userId },
        update: {},
        create: {
          userId,
          name: "Guest User",
          email: "guest@example.com",
        },
      });

      const productSearch = await prisma.productSearch.create({
        data: {
          userId,
          productName: productName || "Unknown product",
          imageFrontUrl: imageFrontUrl || null,
          imageNutritionImage: imageNutritionImage || null,
          aiData,
        },
      });

      return res.status(201).json(productSearch);
    } catch (error) {
      console.error("Failed to save product search:", error);

      return res.status(500).json({
        error: "Failed to save product search",
        ...(process.env.NODE_ENV !== "production"
          ? { details: error?.message }
          : {}),
      });
    }
  }

  if (req.method === "PATCH") {
    const { id, aiData } = req.body || {};
    if (typeof id !== "string" || !id || !aiData || typeof aiData !== "object") {
      return res.status(400).json({ error: "Saved analysis ID and data are required" });
    }

    try {
      const updated = await prisma.productSearch.updateMany({
        where: { id, userId },
        data: { aiData },
      });
      return updated.count
        ? res.status(200).json({ success: true })
        : res.status(404).json({ error: "Saved analysis not found" });
    } catch (error) {
      console.error("Failed to update saved analysis:", error);
      return res.status(500).json({ error: "Failed to update saved analysis" });
    }
  }

  if (req.method === "GET") {
    try {
      const searches = await prisma.productSearch.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json(searches);
    } catch (error) {
      console.error("Failed to fetch product searches:", error);

      return res
        .status(500)
        .json({ error: "Failed to fetch product searches" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
