"use client";

import { useActionState, useState } from "react";
import { createReport, type ReportState } from "@/actions/community";
import { Button } from "@/components/ui/button";
import { Flag, Loader2 } from "lucide-react";

export function ReportForm({
  postId,
  commentId,
  currentUserId,
}: {
  postId?: string;
  commentId?: string;
  currentUserId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<ReportState, FormData>(
    createReport,
    {},
  );

  if (!currentUserId) return null;

  return (
    <div className="relative">
      {state.success ? (
        <p role="status" className="mt-1 text-xs text-muted-foreground">
          Report sent to the moderation team.
        </p>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <Flag className="h-4 w-4" />
          Report
        </Button>
      )}
      {open && !state.success && (
        <form
          action={formAction}
          className="absolute right-0 top-full z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] space-y-3 rounded-xl border bg-background p-4 shadow-xl"
        >
          {postId && <input type="hidden" name="postId" value={postId} />}
          {commentId && (
            <input type="hidden" name="commentId" value={commentId} />
          )}
          <div>
            <label
              htmlFor={`report-reason-${postId || commentId}`}
              className="text-sm font-medium"
            >
              Why are you reporting this?
            </label>
            <textarea
              id={`report-reason-${postId || commentId}`}
              name="reason"
              minLength={10}
              maxLength={1000}
              required
              rows={4}
              placeholder="Describe the issue so moderators can review it."
              className="mt-2 w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Send report
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
