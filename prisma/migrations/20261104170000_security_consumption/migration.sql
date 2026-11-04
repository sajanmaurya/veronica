ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "dietaryPreferences" TEXT;
ALTER TABLE "ProductSearch" ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ProductSearch_clientRequestId_key" ON "ProductSearch"("clientRequestId");
CREATE TABLE IF NOT EXISTS "FoodConsumption" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "productName" TEXT NOT NULL,
  "portion" DOUBLE PRECISION NOT NULL, "unit" TEXT NOT NULL,
  "nutrition" JSONB NOT NULL, "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FoodConsumption_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FoodConsumption_userId_consumedAt_idx" ON "FoodConsumption"("userId","consumedAt");
ALTER TABLE "FoodConsumption" ADD CONSTRAINT "FoodConsumption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE IF NOT EXISTS "ApiUsage" ("key" TEXT NOT NULL,"count" INTEGER NOT NULL DEFAULT 0,"expiresAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("key"));
