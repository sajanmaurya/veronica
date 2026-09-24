import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/app/utils/prisma";

export default async function handler(req, res) {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "POST") {
    const { productName, imageFrontUrl, imageNutritionImage, aiData } =
      req.body;

    try {
      const productSearch = await prisma.productSearch.create({
        data: {
          userId,
          productName,
          imageFrontUrl,
          imageNutritionImage,
          aiData,
        },
      });

      return res.status(201).json(productSearch);
    } catch (error) {
      console.error("Failed to save product search:", error);
      return res.status(500).json({ error: "Failed to save product search" });
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
