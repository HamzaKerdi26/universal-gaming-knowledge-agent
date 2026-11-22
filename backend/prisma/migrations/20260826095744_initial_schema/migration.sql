--migration_sql
-- This migration file represents the baseline schema for the Universal Gaming Knowledge Agent.
-- Generated on: 2026-08-26
-- Prisma Schema Hash corresponds to the original migration
-- Checksum: 1f7aca3c9da975996bbf3296d15c1861f75e2d4fb03a5888239994e1df221b40

-- Create enum for message roles
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant', 'system');

-- Create users table
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    PRIMARY KEY ("id")
);

-- Create unique indexes for users
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Create games table
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "releaseDate" TIMESTAMP(3),
    "developer" TEXT,
    "publisher" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    PRIMARY KEY ("id")
);

-- Create indexes for games
CREATE UNIQUE INDEX "games_slug_key" ON "games"("slug");
CREATE INDEX "games_title_idx" ON "games"("title");

-- Create conversations table
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    PRIMARY KEY ("id")
);

-- Create indexes for conversations
CREATE INDEX "conversations_userId_idx" ON "conversations"("userId");

-- Create messages table
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),

    PRIMARY KEY ("id")
);

-- Create indexes for messages
CREATE INDEX "messages_conversationId_idx" ON "messages"("conversationId");

-- Add foreign key constraint for conversations.userId
ALTER TABLE "conversations" ADD FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;

-- Add foreign key constraint for messages.conversationId
ALTER TABLE "messages" ADD FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE;

-- End of migration

