import { getAuth } from "@clerk/nextjs/server";
import {
  getProfileFromDrive,
  saveProfileToDrive,
} from "@/lib/googleDrive";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "100kb",
    },
  },
};

export default async function handler(req, res) {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    if (req.method === "GET") {
      const profile = await getProfileFromDrive(userId);
      return res.status(200).json({ profile });
    }

    if (req.method === "POST") {
      const profile = req.body?.profile;
      if (!profile || typeof profile !== "object") {
        return res.status(400).json({ error: "profile is required" });
      }

      await saveProfileToDrive({ userId, profile });
      return res.status(200).json({ saved: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Google Drive profile operation failed:", error);

    return res.status(error?.status === 401 ? 401 : 500).json({
      error: "Google Drive profile operation failed",
      code: error?.code || null,
    });
  }
}
