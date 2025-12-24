/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('FREE', 'PAID', 'TRIAL', 'EXPIRED', 'CANCELLED');

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'EMAIL',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'FREE',
    "subscriptionStartDate" TIMESTAMP(3),
    "subscriptionEndDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "providerEmail" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" INTEGER,
    "tokenType" TEXT,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdf_uploads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pdf_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourcePdfId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "estimateNumber" TEXT,
    "totalAmount" DECIMAL(12,2),
    "currency" TEXT DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_subscriptionStatus_idx" ON "users"("subscriptionStatus");

-- CreateIndex
CREATE INDEX "users_authProvider_idx" ON "users"("authProvider");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "pdf_uploads_userId_idx" ON "pdf_uploads"("userId");

-- CreateIndex
CREATE INDEX "pdf_uploads_uploadedAt_idx" ON "pdf_uploads"("uploadedAt");

-- CreateIndex
CREATE INDEX "pdf_uploads_isProcessed_idx" ON "pdf_uploads"("isProcessed");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_sourcePdfId_key" ON "estimates"("sourcePdfId");

-- CreateIndex
CREATE INDEX "estimates_userId_idx" ON "estimates"("userId");

-- CreateIndex
CREATE INDEX "estimates_createdAt_idx" ON "estimates"("createdAt");

-- CreateIndex
CREATE INDEX "estimates_status_idx" ON "estimates"("status");

-- CreateIndex
CREATE INDEX "estimates_isActive_idx" ON "estimates"("isActive");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdf_uploads" ADD CONSTRAINT "pdf_uploads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_sourcePdfId_fkey" FOREIGN KEY ("sourcePdfId") REFERENCES "pdf_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
