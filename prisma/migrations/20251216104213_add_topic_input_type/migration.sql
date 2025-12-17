-- AlterEnum
ALTER TYPE "InputType" ADD VALUE 'TOPIC';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;
