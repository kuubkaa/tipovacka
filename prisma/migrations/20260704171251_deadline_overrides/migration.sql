-- CreateTable
CREATE TABLE "DeadlineOverride" (
    "scope" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeadlineOverride_pkey" PRIMARY KEY ("scope")
);
