import { getAuth } from "@clerk/nextjs/server";
import { listDriveAnalyses } from "@/lib/googleDrive";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const analyses = await listDriveAnalyses(userId);
    return res.status(200).json(analyses);
  } catch (error) {
    console.error("Failed to list Drive analyses:", error);

    return res.status(error?.status === 401 ? 401 : 500).json({
      error: "Failed to read Google Drive history",
      code: error?.code || null,
    });
  }
}
