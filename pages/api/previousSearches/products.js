import { getAuth } from "@clerk/nextjs/server";
import { prisma } from "@/app/utils/prisma";
import { createHistoryHandler } from "@/lib/history-handler.mjs";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};

export default createHistoryHandler({
  getUserId: (req) => getAuth(req).userId,
  prisma,
});
