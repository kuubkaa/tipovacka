-- CreateTable
CREATE TABLE "GroupRankingTip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "group" "GroupName" NOT NULL,
    "teamCodes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupRankingTip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupRankingTip_userId_group_key" ON "GroupRankingTip"("userId", "group");

-- AddForeignKey
ALTER TABLE "GroupRankingTip" ADD CONSTRAINT "GroupRankingTip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
