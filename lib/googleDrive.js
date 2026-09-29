import { clerkClient } from "@clerk/nextjs/server";

export const GOOGLE_DRIVE_APPDATA_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata";

async function getGoogleAccessToken(userId) {
  const client = await clerkClient();
  const response = await client.users.getUserOauthAccessToken(userId, "google");
  const token = response?.data?.[0]?.token;

  if (!token) {
    const error = new Error("Google Drive is not connected for this account.");
    error.code = "GOOGLE_DRIVE_NOT_CONNECTED";
    throw error;
  }

  return token;
}

async function driveRequest(userId, path, options = {}) {
  const accessToken = await getGoogleAccessToken(userId);
  const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    let details = text;
    try {
      details = JSON.parse(text);
    } catch {}

    const error = new Error(
      details?.error?.message || `Google Drive request failed (${response.status})`
    );
    error.status = response.status;
    error.driveDetails = details;
    throw error;
  }

  return response;
}

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)?;base64,(.+)$/s);
  if (!match) return null;

  return {
    mimeType: match[1] || "application/octet-stream",
    buffer: Buffer.from(match[2], "base64"),
  };
}

export async function getDriveAccess(userId) {
  try {
    const token = await getGoogleAccessToken(userId);
    const response = await fetch(
      "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,mimeType,size,modifiedTime)&pageSize=1",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      return { connected: false, reason: "drive_request_failed" };
    }

    return { connected: true };
  } catch (error) {
    return {
      connected: false,
      reason: error?.code || "not_connected",
    };
  }
}

export async function createDriveFile({
  userId,
  name,
  mimeType,
  content,
}) {
  const accessToken = await getGoogleAccessToken(userId);
  const metadata = {
    name,
    parents: ["appDataFolder"],
    mimeType,
  };

  const boundary = `veronica_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
    ),
    Buffer.from(
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
    ),
    Buffer.isBuffer(content) ? content : Buffer.from(String(content)),
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!response.ok) {
    const text = await response.text();
    let details = text;
    try {
      details = JSON.parse(text);
    } catch {}

    const error = new Error(
      details?.error?.message || `Google Drive upload failed (${response.status})`
    );
    error.status = response.status;
    error.driveDetails = details;
    throw error;
  }

  return response.json();
}

export async function saveAnalysisToDrive({
  userId,
  productName,
  aiData,
  imageFrontData,
  imageNutritionData,
}) {
  const timestamp = Date.now();
  const safeName = String(productName || "product")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "product";

  const images = {};

  for (const [key, dataUrl, suffix] of [
    ["imageFrontFileId", imageFrontData, "front"],
    ["imageNutritionFileId", imageNutritionData, "nutrition"],
  ]) {
    const decoded = decodeDataUrl(dataUrl);
    if (!decoded) continue;

    const extension =
      decoded.mimeType === "image/webp" ? "webp" :
      decoded.mimeType === "image/jpeg" ? "jpg" :
      decoded.mimeType === "image/png" ? "png" : "bin";

    const uploaded = await createDriveFile({
      userId,
      name: `veronica-${timestamp}-${suffix}.${extension}`,
      mimeType: decoded.mimeType,
      content: decoded.buffer,
    });

    images[key] = uploaded.id;
  }

  const record = {
    version: 1,
    id: `drive-${timestamp}`,
    productName: productName || aiData?.product_name || "Unknown product",
    createdAt: new Date().toISOString(),
    aiData,
    ...images,
  };

  const analysis = await createDriveFile({
    userId,
    name: `veronica-analysis-${timestamp}-${safeName}.json`,
    mimeType: "application/json",
    content: JSON.stringify(record),
  });

  return {
    ...record,
    driveFileId: analysis.id,
  };
}

export async function listDriveAnalyses(userId) {
  const response = await driveRequest(
    userId,
    "/files?spaces=appDataFolder&orderBy=createdTime%20desc&fields=files(id,name,mimeType,modifiedTime)&pageSize=100"
  );
  const data = await response.json();

  const files = Array.isArray(data.files) ? data.files : [];
  const analyses = [];

  for (const file of files.filter(
    (item) =>
      item.mimeType === "application/json" &&
      item.name?.startsWith("veronica-analysis-")
  )) {
    try {
      const contentResponse = await driveRequest(
        userId,
        `/files/${encodeURIComponent(file.id)}?alt=media`
      );
      const record = await contentResponse.json();

      analyses.push({
        ...record,
        id: record.id || `drive-${file.id}`,
        driveFileId: file.id,
        imageFrontUrl: record.imageFrontFileId
          ? `/api/drive/file?fileId=${encodeURIComponent(record.imageFrontFileId)}`
          : null,
        imageNutritionImage: record.imageNutritionFileId
          ? `/api/drive/file?fileId=${encodeURIComponent(record.imageNutritionFileId)}`
          : null,
      });
    } catch (error) {
      console.error("Failed to read Drive analysis:", file.id, error);
    }
  }

  return analyses;
}

export async function streamDriveFile(userId, fileId) {
  return driveRequest(
    userId,
    `/files/${encodeURIComponent(fileId)}?alt=media`
  );
}


export async function saveProfileToDrive({ userId, profile }) {
  const token = await getGoogleAccessToken(userId);

  const listResponse = await fetch(
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27veronica-profile.json%27&fields=files(id)&pageSize=1",
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!listResponse.ok) {
    const text = await listResponse.text();
    throw new Error(text || "Could not find Veronica profile in Drive");
  }

  const listData = await listResponse.json();
  const existingId = listData?.files?.[0]?.id;
  const payload = Buffer.from(
    JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      profile,
    })
  );

  if (!existingId) {
    return createDriveFile({
      userId,
      name: "veronica-profile.json",
      mimeType: "application/json",
      content: payload,
    });
  }

  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingId)}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: payload,
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Could not update Veronica profile");
  }

  return response.json();
}

export async function getProfileFromDrive(userId) {
  const token = await getGoogleAccessToken(userId);
  const listResponse = await fetch(
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27veronica-profile.json%27&fields=files(id)&pageSize=1",
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!listResponse.ok) throw new Error("Could not find Veronica profile");

  const listData = await listResponse.json();
  const fileId = listData?.files?.[0]?.id;
  if (!fileId) return null;

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) throw new Error("Could not read Veronica profile");
  const data = await response.json();
  return data?.profile || null;
}
