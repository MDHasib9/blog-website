"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { toggleReaction } from "@/actions/reactions";
import { Button } from "@/components/ui/button";
import { MessageCircle, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { BookmarkButton } from "@/components/posts/bookmark-button";
import { ReportForm } from "@/components/posts/report-form";

const REACTIONS = [
  { type: "like", emoji: "👍", label: "Like", color: "text-blue-500" },
  { type: "love", emoji: "❤️️", label: "Love", color: "text-red-500" },
  { type: "care", emoji: "🤗", label: "Care", color: "text-yellow-500" },
  { type: "haha", emoji: "😆", label: "Haha", color: "text-yellow-400" },
  { type: "wow", emoji: "😮", label: "Wow", color: "text-yellow-500" },
  { type: "sad", emoji: "😢", label: "Sad", color: "text-yellow-600" },
  { type: "angry", emoji: "😠", label: "Angry", color: "text-orange-600" },
] as const;

type ReactionType = (typeof REACTIONS)[number]["type"];

type Props = {
  postId: string;
  initialCounts: Record<string, number>;
  totalReactions: number;
  commentCount: number;
  currentUserId?: string;
  userReaction?: ReactionType | null;
  postAuthorId: string;
  initiallySaved: boolean;
};

export function PostActions({
  postId,
  initialCounts,
  totalReactions: initialTotal,
  commentCount,
  currentUserId,
  userReaction: initialUserReaction = null,
  postAuthorId,
  initiallySaved,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [counts, setCounts] = useState(initialCounts);
  const [total, setTotal] = useState(initialTotal);
  const [userReaction, setUserReaction] = useState<ReactionType | null>(
    initialUserReaction,
  );
  const [showPicker, setShowPicker] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const currentReaction = REACTIONS.find((r) => r.type === userReaction);

  // Close picker when tapping outside on mobile
  useEffect(() => {
    if (!showPicker) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showPicker]);

  // Touch event handlers for long-press on mobile
  const handleTouchStart = () => {
    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setShowPicker(true);
    }, 400); // 400ms long press threshold
  };

  const handleTouchEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const handleTouchMove = () => {
    // Clear long-press timer if user is scrolling
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const handleReaction = (type: ReactionType) => {
    if (!currentUserId) {
      router.push(
        `/auth/login?next=${encodeURIComponent(`/blog/${postId}`)}`,
      );
      return;
    }

    const prevReaction = userReaction;
    const prevCounts = { ...counts };
    const prevTotal = total;
    const removingReaction = prevReaction === type;
    const nextCounts = { ...counts };

    if (prevReaction) {
      nextCounts[prevReaction] = Math.max(
        0,
        (nextCounts[prevReaction] || 0) - 1,
      );
    }
    if (!removingReaction) {
      nextCounts[type] = (nextCounts[type] || 0) + 1;
    }

    setCounts(nextCounts);
    setUserReaction(removingReaction ? null : type);
    setTotal(
      removingReaction
        ? Math.max(0, prevTotal - 1)
        : prevTotal + (prevReaction ? 0 : 1),
    );
    setActionError(null);

    const rollback = (message: string) => {
      setCounts(prevCounts);
      setTotal(prevTotal);
      setUserReaction(prevReaction);
      setActionError(message);
    };

    startTransition(async () => {
      try {
        const result = await toggleReaction(postId, type);
        if (result?.error) rollback(result.error);
      } catch (error) {
        console.error("Unexpected error saving reaction:", error);
        rollback("Could not update your reaction. Please try again.");
      }
    });

    setShowPicker(false);
  };

  const handleButtonClick = () => {
    // Prevent quick reaction toggle if triggered by a long-press release
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    handleReaction(userReaction || "like");
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Reaction button + hover/touch picker container */}
      <div
        ref={containerRef}
        className="relative select-none"
        onMouseEnter={() => setShowPicker(true)}
        onMouseLeave={() => setShowPicker(false)}
      >
        <Button
          variant={userReaction ? "secondary" : "outline"}
          size="sm"
          className={cn(
            "gap-2 min-w-22.5 touch-none",
            currentReaction && currentReaction.color,
          )}
          disabled={isPending}
          onClick={handleButtonClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
        >
          {currentReaction ? (
            <>
              <span className="text-base">{currentReaction.emoji}</span>
              <span className="capitalize">{currentReaction.label}</span>
            </>
          ) : (
            <>
              <Heart className="h-4 w-4" />
              <span>React</span>
            </>
          )}
          {total > 0 && (
            <span className="ml-1 text-muted-foreground">({total})</span>
          )}
        </Button>

        {/* Hover/Touch picker */}
        {showPicker && (
          <div className="absolute bottom-full left-0 z-50 pb-2">
            {/* Inner picker box */}
            <div className="flex items-center gap-1 rounded-full border bg-background p-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-150">
              {REACTIONS.map((reaction) => (
                <button
                  key={reaction.type}
                  type="button"
                  title={reaction.label}
                  onClick={() => handleReaction(reaction.type)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-xl transition-transform hover:scale-125 hover:bg-accent active:scale-110",
                    userReaction === reaction.type && "bg-accent scale-110",
                  )}
                >
                  {reaction.emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Comments count */}
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        aria-label="Scroll to comments"
        onClick={() => {
          document
            .getElementById("comments")
            ?.scrollIntoView({ behavior: "smooth" });
        }}
      >
        <MessageCircle className="h-4 w-4" />
        {commentCount}
      </Button>
      <BookmarkButton
        postId={postId}
        currentUserId={currentUserId}
        initiallySaved={initiallySaved}
      />
      {currentUserId !== postAuthorId && (
        <ReportForm postId={postId} currentUserId={currentUserId} />
      )}
      {actionError && (
        <p role="alert" className="basis-full text-sm text-destructive">
          {actionError}
        </p>
      )}
    </div>
  );
}
