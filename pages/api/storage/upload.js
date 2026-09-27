import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};

function getStorageConfig() {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3;
  const bucket = process.env.NEON_STORAGE_BUCKET;
  const region = process.env.AWS_REGION || "us-east-2";

  if (!endpoint || !bucket) {
    throw new Error(
      "Neon Object Storage is not configured. Set AWS_ENDPOINT_URL_S3 and NEON_STORAGE_BUCKET."
    );
  }

  return { endpoint, bucket, region };
}

function createStorageClient() {
  const { endpoint, region } = getStorageConfig();

  return new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
  });
}

function parseImageData(imageData) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(imageData || "");

  if (!match) {
    throw new Error("Invalid image data.");
  }

  const contentType = match[1];
  const base64 = match[2];

  if (!contentType.startsWith("image/")) {
    throw new Error("Only image uploads are allowed.");
  }

  const buffer = Buffer.from(base64, "base64");

  if (!buffer.length) {
    throw new Error("Image is empty.");
  }

  // Keep individual history images small and protect the serverless route.
  if (buffer.length > 1.5 * 1024 * 1024) {
    throw new Error("Image is too large after compression.");
  }

  return { buffer, contentType };
}

function publicObjectUrl(endpoint, bucket, key) {
  const cleanEndpoint = endpoint.replace(/\/$/, "");
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${cleanEndpoint}/${encodeURIComponent(bucket)}/${encodedKey}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { imageData, folder = "history" } = req.body || {};

    if (!imageData) {
      return res.status(400).json({ error: "imageData is required" });
    }

    const safeFolder =
      String(folder).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) ||
      "history";

    const { bucket, endpoint } = getStorageConfig();
    const { buffer, contentType } = parseImageData(imageData);
    const extension = contentType === "image/webp" ? "webp" : "img";
    const key = `${safeFolder}/${randomUUID()}.${extension}`;

    const client = createStorageClient();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    return res.status(201).json({
      url: publicObjectUrl(endpoint, bucket, key),
      key,
    });
  } catch (error) {
    console.error("Failed to upload image to Neon Object Storage:", error);

    return res.status(500).json({
      error: "Failed to upload image",
      ...(process.env.NODE_ENV !== "production"
        ? { details: error?.message }
        : {}),
    });
  }
}
