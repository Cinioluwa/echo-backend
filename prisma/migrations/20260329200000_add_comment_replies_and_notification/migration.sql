-- AddCommentRepliesAndNotification
-- Adds single-level threaded replies to ping comments + COMMENT_REPLY notification type

-- 1. Add parentCommentId column to Comment (nullable, self-referencing)
ALTER TABLE "Comment" ADD COLUMN "parentCommentId" INTEGER;

-- 2. Add FK constraint with cascade delete (deleting a parent removes its replies)
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentCommentId_fkey"
  FOREIGN KEY ("parentCommentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Add index on parentCommentId for fast reply fetching
CREATE INDEX "Comment_parentCommentId_idx" ON "Comment"("parentCommentId");

-- 4. Add commentId FK to Notification (for linking reply notifications to comments)
ALTER TABLE "Notification" ADD COLUMN "commentId" INTEGER;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Add COMMENT_REPLY to the NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE 'COMMENT_REPLY';

-- 6. Add commentReply toggle to NotificationPreference
ALTER TABLE "NotificationPreference" ADD COLUMN "commentReply" BOOLEAN NOT NULL DEFAULT true;
