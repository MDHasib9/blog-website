"use client";

import { useState, useTransition, useEffect } from "react";
import { createComment } from "@/actions/comments";
import { CommentItem } from "./comment-item";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/client";
import { useRouter } from "next/navigation";
import {
  normalizeComment,
  type Comment,
  type CommentRow,
} from "@/types/comment";

export type { Comment } from "@/types/comment";

type Props = {
  postId: string;
  currentUserId?: string;
};

function buildCommentTree(flat: Comment[]): Comment[] {
  const map = new Map<string, Comment>();
  const roots: Comment[] = [];

  flat.forEach((c) => {
    map.set(c.id, { ...c, replies: [] });
  });

  flat.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      const parent = map.get(c.parent_id)!;
      parent.replies = [...(parent.replies || []), node];
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export function CommentSection({ postId, currentUserId }: Props) {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [content, setContent] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (commentId: string) => {
    const removeComment = (items: Comment[]): Comment[] =>
      items.flatMap((comment) =>
        comment.id === commentId
          ? comment.replies || []
          : [{ ...comment, replies: removeComment(comment.replies || []) }]
      );

    setComments((prev) => removeComment(prev));
    setTotalCount((prev) => Math.max(0, prev - 1));
  };

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const fetchComments = async () => {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from("comments")
        .select(
          `
          id,
          content,
          created_at,
          parent_id,
          author:profiles!author_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `
        )
        .eq("post_id", postId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (!error && data) {
        setTotalCount(data.length);
        const normalized = (data as unknown as CommentRow[]).flatMap((row) => {
          const comment = normalizeComment(row);
          return comment ? [comment] : [];
        });
        setComments(buildCommentTree(normalized));
      } else {
        console.error("Error loading comments:", error);
        setLoadError("Comments could not be loaded. Please try again.");
      }
      setLoading(false);
    };

    void fetchComments();
    return () => {
      cancelled = true;
    };
  }, [postId, reloadKey]);

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    if (!currentUserId) {
      router.push(
        `/auth/login?next=${encodeURIComponent(`/blog/${postId}#comments`)}`,
      );
      return;
    }

    const tempId = crypto.randomUUID();
    const optimistic: Comment = {
      id: tempId,
      content: trimmed,
      created_at: new Date().toISOString(),
      parent_id: null,
      author: {
        id: currentUserId,
        username: "You",
        full_name: "You",
        avatar_url: null,
      },
      replies: [],
    };

    setComments((prev) => [...prev, optimistic]);
    setTotalCount((prev) => prev + 1);
    setContent("");
    setSubmitError(null);

    const rollback = () => {
      setComments((prev) => prev.filter((comment) => comment.id !== tempId));
      setTotalCount((prev) => Math.max(0, prev - 1));
    };

    startTransition(async () => {
      try {
        const result = await createComment(postId, trimmed);
        if (result.error) {
          rollback();
          setSubmitError(result.error);
        } else if (result.data) {
          const created = normalizeComment(result.data as unknown as CommentRow);
          if (!created) {
            rollback();
            setReloadKey((prev) => prev + 1);
            setSubmitError(
              "Your comment was posted, but it could not be displayed.",
            );
            return;
          }

          setComments((prev) =>
            prev.map((comment) =>
              comment.id === tempId ? { ...created, replies: [] } : comment,
            ),
          );
        } else {
          rollback();
          setSubmitError("Could not post your comment. Please try again.");
        }
      } catch (error) {
        console.error("Unexpected error posting comment:", error);
        rollback();
        setContent((previous) => previous || trimmed);
        setSubmitError("Could not post your comment. Please try again.");
      }
    });
  };

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold">
        Comments {totalCount > 0 && `(${totalCount})`}
      </h2>

      {/* New comment form */}
      <div className="mb-8 space-y-3">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setSubmitError(null);
          }}
          placeholder={
            currentUserId ? "Write a comment..." : "Log in to leave a comment"
          }
          disabled={!currentUserId}
          className="w-full resize-none rounded-lg border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          rows={4}
        />
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={isPending || !content.trim() || !currentUserId}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Post Comment
          </Button>
        </div>
        {submitError && (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        )}
      </div>

      {/* Comments list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="space-y-3 text-center">
          <p role="alert" className="text-sm text-destructive">{loadError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReloadKey((prev) => prev + 1)}
          >
            Try again
          </Button>
        </div>
      ) : comments.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No comments yet. Be the first to share your thoughts.
        </p>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              currentUserId={currentUserId}
              onDelete={handleDelete}
              onCommentCountChange={(change) =>
                setTotalCount((prev) => Math.max(0, prev + change))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}