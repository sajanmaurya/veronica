import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/app/utils/prisma";
import { createProfileHandler } from "@/lib/profile-handler.mjs";

export const config = {
  api: { bodyParser: { sizeLimit: "16kb" } },
};

export default createProfileHandler({
  getAuth,
  profiles: prisma.userProfile,
  returnDefaultProfile: true,
});
