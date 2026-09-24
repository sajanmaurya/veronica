import { prisma } from "@/app/utils/prisma"; // Update this path if needed

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { userId, name, email, diseases, allergies } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    try {
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
    } catch (error) {
      console.error("Error saving profile:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method === "GET") {
    const { userId } = req.query;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "Missing or invalid userId" });
    }

    try {
      const profile = await prisma.userProfile.findUnique({
        where: { userId },
      });

      return res.status(200).json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
