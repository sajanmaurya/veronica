import { prisma } from "@/app/utils/prisma";

export default async function handler(req, res) {
  const userId = req.query.userId || req.body?.userId || "guest-user";

  if (req.method === "POST") {
    const { name, email, diseases, allergies } = req.body || {};

    const existingProfile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    const profile = existingProfile
      ? await prisma.userProfile.update({
          where: { userId },
          data: { name, email, diseases, allergies },
        })
      : await prisma.userProfile.create({
          data: { userId, name, email, diseases, allergies },
        });

    return res.status(200).json(profile);
  }

  if (req.method === "GET") {
    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    return res.status(200).json(profile || { userId, name: "Guest User", email: "guest@example.com", diseases: "", allergies: "" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
