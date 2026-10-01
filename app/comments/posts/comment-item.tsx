"use client";

import { useState, useTransition } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { createComment, deleteComment } from "@/actions/comments";
import { Loader2, Reply, Trash2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  normalizeComment,
  type Comment,
  type CommentRow,
} from "@/types/comment";

type Props = {
  comment: Comment;
  postId: string;
  currentUserId?: string;
  depth?: number;
  onDelete: (commentId: string) => void;
  onCommentCountChange: (change: number) => void;
};

export function CommentItem({
  comment,
  postId,
  currentUserId,
  depth = 0,
  onDelete,
  onCommentCountChange,
}: Props) {
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [optimisticReplies, setOptimisticReplies] = useState<Comment[]>(
    comment.replies || [],
  );

  const isAuthor = currentUserId === comment.author.id;
  const maxDepth = 4; // prevent infinite nesting visually

  const handleDeleteReply = (commentId: string) => {
    const removeComment = (items: Comment[]): Comment[] =>
      items.flatMap((reply) =>
        reply.id === commentId
          ? reply.replies || []
          : [{ ...reply, replies: removeComment(reply.replies || []) }]
      );

    setOptimisticReplies((prev) => removeComment(prev));
    onDelete(commentId);
  };

  const handleReply = () => {
    if (!replyContent.trim() || !currentUserId) return;

    const tempId = crypto.randomUUID();
    const trimmedReply = replyContent.trim();
    const optimistic: Comment = {
      id: tempId,
      content: trimmedReply,
      created_at: new Date().toISOString(),
      parent_id: comment.id,
      author: {
        id: currentUserId,
        username: "You",
        full_name: "You",
        avatar_url: null,
      },
      replies: [],
    };

    setOptimisticReplies((prev) => [...prev, optimistic]);
    setReplyContent("");
    setShowReply(false);
    onCommentCountChange(1);

    startTransition(async () => {
      const result = await createComment(postId, trimmedReply, comment.id);
      if (result.error) {
        setOptimisticReplies((prev) => prev.filter((r) => r.id !== tempId));
        onCommentCountChange(-1);
        alert(result.error);
      } else if (result.data) {
        const created = normalizeComment(result.data as unknown as CommentRow);
        if (!created) {
          setOptimisticReplies((prev) => prev.filter((r) => r.id !== tempId));
          onCommentCountChange(-1);
          alert("Your reply was posted, but it could not be displayed.");
          return;
        }

        setOptimisticReplies((prev) =>
          prev.map((reply) => (reply.id === tempId ? created : reply))
        );
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Delete this comment?")) return;

    startDelete(async () => {
      const result = await deleteComment(comment.id, postId);
      if (result.error) alert(result.error);
      else onDelete(comment.id);
    });
  };

  return (
    <div className={cn("group", depth > 0 && "ml-6 border-l pl-4")}>
      <div className="flex gap-3">
        <Link href={`/profile/${comment.author.username}`}>
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={comment.author.avatar_url || ""} />
            <AvatarFallback>
              {comment.author.full_name?.[0] ||
                comment.author.username?.[0] ||
                "U"}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/profile/${comment.author.username}`}
              className="text-sm font-medium hover:underline"
            >
              {comment.author.full_name || comment.author.username}
            </Link>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), {
                addSuffix: true,
              })}
            </span>
          </div>

          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {comment.content}
          </p>

          <div className="flex items-center gap-3 pt-1">
            {depth < maxDepth && currentUserId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                onClick={() => setShowReply(!showReply)}
              >
                <Reply className="h-3.5 w-3.5" />
                Reply
              </Button>
            )}

            {isAuthor && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete
              </Button>
            )}
          </div>

          {/* Reply form */}
          {showReply && (
            <div className="mt-3 space-y-2">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleReply}
                  disabled={isPending || !replyContent.trim()}
                >
                  {isPending && (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  )}
                  Reply
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowReply(false);
                    setReplyContent("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {optimisticReplies.length > 0 && (
        <div className="mt-4 space-y-4">
          {optimisticReplies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              postId={postId}
              currentUserId={currentUserId}
              depth={depth + 1}
              onDelete={handleDeleteReply}
              onCommentCountChange={onCommentCountChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
