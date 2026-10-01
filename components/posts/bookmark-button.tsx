"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleBookmark } from "@/actions/community";
import { Button } from "@/components/ui/button";
import { Bookmark, Loader2 } from "lucide-react";

export function BookmarkButton({
  postId,
  currentUserId,
  initiallySaved,
}: {
  postId: string;
  currentUserId?: string;
  initiallySaved: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initiallySaved);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    if (!currentUserId) {
      router.push(
        `/auth/login?next=${encodeURIComponent(`/blog/${postId}`)}`,
      );
      return;
    }

    const previous = saved;
    setSaved(!previous);
    setError(null);

    startTransition(async () => {
      try {
        const result = await toggleBookmark(postId);
        if (result.error || result.saved === undefined) {
          setSaved(previous);
          setError(result.error || "Could not update saved stories.");
          return;
        }
        setSaved(result.saved);
        router.refresh();
      } catch (cause) {
        console.error("Unexpected error updating bookmark:", cause);
        setSaved(previous);
        setError("Could not update saved stories. Please try again.");
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant={saved ? "secondary" : "outline"}
        size="sm"
        className="gap-2"
        onClick={handleToggle}
        disabled={isPending}
        aria-pressed={saved}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Bookmark className="h-4 w-4" />
        )}
        {saved ? "Saved" : "Save"}
      </Button>
      {error && (
        <p role="alert" className="max-w-48 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
