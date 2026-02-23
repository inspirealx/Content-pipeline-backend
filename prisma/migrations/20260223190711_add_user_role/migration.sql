-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'TESTER', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "ReelAudio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scriptId" TEXT,
    "scriptText" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "elevenLabsId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReelAudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReelVideo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "audioId" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReelVideo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ReelAudio" ADD CONSTRAINT "ReelAudio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReelVideo" ADD CONSTRAINT "ReelVideo_audioId_fkey" FOREIGN KEY ("audioId") REFERENCES "ReelAudio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
