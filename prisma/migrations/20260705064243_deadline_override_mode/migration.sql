-- AlterTable
ALTER TABLE "DeadlineOverride" ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'FIXED',
ALTER COLUMN "deadline" DROP NOT NULL;
