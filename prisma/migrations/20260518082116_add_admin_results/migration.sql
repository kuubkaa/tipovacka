-- CreateTable
CREATE TABLE "GroupRankingResult" (
    "group" "GroupName" NOT NULL,
    "teamCodes" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupRankingResult_pkey" PRIMARY KEY ("group")
);

-- CreateTable
CREATE TABLE "KnockoutAdvancersResult" (
    "stage" "Stage" NOT NULL,
    "teamCodes" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnockoutAdvancersResult_pkey" PRIMARY KEY ("stage")
);

-- CreateTable
CREATE TABLE "TournamentResult" (
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentResult_pkey" PRIMARY KEY ("type")
);
