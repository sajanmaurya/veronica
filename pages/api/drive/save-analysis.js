import { getAuth } from "@clerk/nextjs/server";
import { saveAnalysisToDrive } from "@/lib/googleDrive";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "12mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { productName, aiData, imageFrontData, imageNutritionData } = req.body;

    if (!aiData || typeof aiData !== "object") {
      return res.status(400).json({ error: "aiData is required" });
    }

    const record = await saveAnalysisToDrive({
      userId,
      productName,
      aiData,
      imageFrontData,
      imageNutritionData,
    });

    return res.status(201).json(record);
  } catch (error) {
    console.error("Failed to save analysis to Google Drive:", error);

    return res.status(error?.status === 401 ? 401 : 500).json({
      error:
        error?.code === "GOOGLE_DRIVE_NOT_CONNECTED"
          ? "Google Drive is not connected. Reconnect Google with the Veronica Drive permission."
          : "Failed to save analysis to Google Drive",
      code: error?.code || null,
      details:
        process.env.NODE_ENV !== "production"
          ? error?.message
          : undefined,
    });
  }
}
