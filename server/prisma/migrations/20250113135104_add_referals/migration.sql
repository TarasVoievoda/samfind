-- AlterTable
ALTER TABLE "user" ADD COLUMN     "referrals" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "referralCode" DROP DEFAULT;
