-- CreateTable
CREATE TABLE "TipChangeLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TipChangeLog_userId_changedAt_idx" ON "TipChangeLog"("userId", "changedAt");

-- CreateIndex
CREATE INDEX "TipChangeLog_entityType_entityKey_idx" ON "TipChangeLog"("entityType", "entityKey");

-- AddForeignKey
ALTER TABLE "TipChangeLog" ADD CONSTRAINT "TipChangeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
