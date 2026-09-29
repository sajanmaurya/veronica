import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/app/utils/prisma";
import { listDriveAnalyses } from "@/lib/googleDrive";

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

  if (req.method === "GET") {
    try {
      // New analyses are stored in Google Drive when the user has granted
      // Veronica the Drive app-data permission. Keep the existing database
      // records visible so connecting Drive never makes old history disappear.
      let driveSearches = [];
      try {
        driveSearches = await listDriveAnalyses(userId);
      } catch (driveError) {
        console.warn("Google Drive history unavailable:", driveError?.message);
      }

      const databaseSearches = await prisma.productSearch.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      const merged = [...driveSearches, ...databaseSearches].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return res.status(200).json(merged);
    } catch (error) {
      console.error("Failed to fetch product searches:", error);

      return res
        .status(500)
        .json({ error: "Failed to fetch product searches" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
