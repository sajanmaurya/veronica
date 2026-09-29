import { getAuth } from "@clerk/nextjs/server";
import { getDriveAccess } from "@/lib/googleDrive";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const status = await getDriveAccess(userId);
  return res.status(200).json(status);
}
