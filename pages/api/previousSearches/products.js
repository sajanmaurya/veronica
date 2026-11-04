import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/app/utils/prisma";
import { randomUUID } from "crypto";

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

  if(req.method==="DELETE"){
    const id=req.query.id;
    if(typeof id!=="string"||id.length>100)return res.status(400).json({error:"Invalid id"});
    try{const result=await prisma.productSearch.deleteMany({where:{id,userId}});return res.status(result.count?200:404).json({deleted:result.count})}
    catch(error){console.error("History deletion failed",error);return res.status(500).json({error:"Delete failed"})}
  }
  if (req.method === "POST") {
    const { productName, imageFrontUrl, imageNutritionImage, aiData, clientRequestId } =
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

      if(!aiData || typeof aiData !== "object" || Array.isArray(aiData))return res.status(400).json({error:"Invalid analysis."});
      const requestId = typeof clientRequestId === "string" && /^[0-9a-f-]{36}$/i.test(clientRequestId) ? `${userId}:`+clientRequestId : `${userId}:`+randomUUID();
      const productSearch = await prisma.productSearch.upsert({
        where: { clientRequestId: requestId },
        update: {},
        create: {
          userId,
          clientRequestId: requestId,
          productName: productName || "Unknown product",
          imageFrontUrl: typeof imageFrontUrl==="string" && (imageFrontUrl.startsWith("/api/storage/image?key=")||imageFrontUrl.startsWith("https://images.openfoodfacts.org/")) ? imageFrontUrl : null,
          imageNutritionImage: typeof imageNutritionImage==="string" && (imageNutritionImage.startsWith("/api/storage/image?key=")||imageNutritionImage.startsWith("https://images.openfoodfacts.org/")) ? imageNutritionImage : null,
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
      const searches = await prisma.productSearch.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 200,
      });

      return res.status(200).json(searches);
    } catch (error) {
      console.error("Failed to fetch product searches:", error);

      return res
        .status(500)
        .json({ error: "Failed to fetch product searches" });
    }
  }

  res.setHeader("Allow","GET, POST, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
