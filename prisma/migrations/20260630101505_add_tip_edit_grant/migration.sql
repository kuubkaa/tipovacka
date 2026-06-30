-- CreateTable
CREATE TABLE "TipEditGrant" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchIds" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipEditGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipEditGrant_token_key" ON "TipEditGrant"("token");

-- CreateIndex
CREATE INDEX "TipEditGrant_userId_idx" ON "TipEditGrant"("userId");

-- AddForeignKey
ALTER TABLE "TipEditGrant" ADD CONSTRAINT "TipEditGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
