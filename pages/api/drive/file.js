import { getAuth } from "@clerk/nextjs/server";
import { streamDriveFile } from "@/lib/googleDrive";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).end("Method not allowed");
  }

  const { userId } = getAuth(req);
  if (!userId) return res.status(401).end("Unauthorized");

  const fileId = String(req.query.fileId || "");
  if (!fileId) return res.status(400).end("Missing fileId");

  try {
    const response = await streamDriveFile(userId, fileId);
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=86400");

    const buffer = Buffer.from(await response.arrayBuffer());
    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Failed to read Drive file:", error);
    return res.status(error?.status || 500).end("Failed to read Drive file");
  }
}
