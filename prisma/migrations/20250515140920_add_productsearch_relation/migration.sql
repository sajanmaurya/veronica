-- CreateTable
CREATE TABLE "ProductSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productName" TEXT,
    "imageFrontUrl" TEXT,
    "imageNutritionImage" TEXT,
    "aiData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSearch_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProductSearch" ADD CONSTRAINT "ProductSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
