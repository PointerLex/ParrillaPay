-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'REVIEW', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReceiptType" AS ENUM ('EXPENSE', 'PAYMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "taxId" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "date" TIMESTAMP(3),
    "status" "EventStatus" NOT NULL DEFAULT 'OPEN',
    "bankName" TEXT,
    "accountName" TEXT,
    "accountNumber" TEXT,
    "taxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creatorId" INTEGER NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMember" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preferences" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "EventMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "receiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" INTEGER NOT NULL,
    "paidById" INTEGER NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseShare" (
    "id" SERIAL NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "expenseId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,

    CONSTRAINT "ExpenseShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "category" TEXT,
    "expenseId" INTEGER NOT NULL,

    CONSTRAINT "ExpenseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemShare" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,

    CONSTRAINT "ItemShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" SERIAL NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "eventId" INTEGER NOT NULL,
    "debtorId" INTEGER NOT NULL,
    "creditorId" INTEGER NOT NULL,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProof" (
    "id" SERIAL NOT NULL,
    "type" "ReceiptType" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'REVIEW',
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileData" BYTEA NOT NULL,
    "extracted" JSONB,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" INTEGER NOT NULL,
    "uploadedById" INTEGER NOT NULL,
    "expenseId" INTEGER,
    "debtId" INTEGER,

    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_taxId_key" ON "User"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_inviteCode_key" ON "Event"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "EventMember_eventId_userId_key" ON "EventMember"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseShare_expenseId_memberId_key" ON "ExpenseShare"("expenseId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemShare_itemId_memberId_key" ON "ItemShare"("itemId", "memberId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMember" ADD CONSTRAINT "EventMember_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMember" ADD CONSTRAINT "EventMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseShare" ADD CONSTRAINT "ExpenseShare_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseShare" ADD CONSTRAINT "ExpenseShare_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "EventMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemShare" ADD CONSTRAINT "ItemShare_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ExpenseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemShare" ADD CONSTRAINT "ItemShare_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "EventMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_creditorId_fkey" FOREIGN KEY ("creditorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
