-- CreateTable
CREATE TABLE "KnockoutAdvancersTip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stage" "Stage" NOT NULL,
    "teamCodes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnockoutAdvancersTip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnockoutAdvancersTip_userId_stage_key" ON "KnockoutAdvancersTip"("userId", "stage");

-- AddForeignKey
ALTER TABLE "KnockoutAdvancersTip" ADD CONSTRAINT "KnockoutAdvancersTip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
