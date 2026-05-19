-- AlterTable
ALTER TABLE "TournamentResult" ADD COLUMN     "acceptedAliases" TEXT[] DEFAULT ARRAY[]::TEXT[];
