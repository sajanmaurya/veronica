import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/app/utils/prisma";

export default async function handler(req, res) {
  const { userId } = getAuth(req);
  res.setHeader("Cache-Control", "private, no-store");
  if (!userId) return res.status(401).json({ error: "Sign in to access your profile." });
  if (!["GET", "POST"].includes(req.method)) return res.status(405).end();

  try {
    if (req.method === "GET") {
      return res.status(200).json(await prisma.userProfile.findUnique({ where: {userId} }));
    }
    const data = {};
    for (const key of ["name", "email", "diseases", "allergies", "dietaryPreferences"]) {
      if (!Object.hasOwn(req.body || {}, key)) continue;
      const value = req.body[key];
      if (typeof value !== "string" || value.length > 2000)
        return res.status(400).json({ error: "Invalid profile field." });
      data[key] = value.trim();
    }
    const saved = await prisma.userProfile.upsert({
      where: {userId}, update: data,
      create: {name: "Guest User", email: "guest@example.com", ...data, userId},
    });
    return res.status(200).json(saved);
  } catch {
    return res.status(500).json({error: "Could not access your profile. Please try again."});
  }
}
