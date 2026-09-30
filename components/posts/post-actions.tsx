"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { toggleReaction } from "@/actions/reactions";
import { Button } from "@/components/ui/button";
import { Bookmark, Flag, MessageCircle, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

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
};

export function PostActions({
  postId,
  initialCounts,
  totalReactions: initialTotal,
  commentCount,
  currentUserId,
  userReaction: initialUserReaction = null,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [counts, setCounts] = useState(initialCounts);
  const [total, setTotal] = useState(initialTotal);
  const [userReaction, setUserReaction] = useState<ReactionType | null>(
    initialUserReaction,
  );
  const [showPicker, setShowPicker] = useState(false);

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
      router.push("/login");
      return;
    }

    // Optimistic update
    const prevReaction = userReaction;
    const prevCounts = { ...counts };
    const prevTotal = total;

    setCounts((prev) => {
      const next = { ...prev };
      if (prevReaction) {
        next[prevReaction] = Math.max(0, (next[prevReaction] || 0) - 1);
      }
      if (prevReaction === type) {
        // removing reaction
        setUserReaction(null);
        setTotal((t) => Math.max(0, t - 1));
      } else {
        next[type] = (next[type] || 0) + 1;
        setUserReaction(type);
        if (!prevReaction) setTotal((t) => t + 1);
      }
      return next;
    });

    startTransition(async () => {
      const result = await toggleReaction(postId, type);
      if (result?.error) {
        // rollback
        setCounts(prevCounts);
        setTotal(prevTotal);
        setUserReaction(prevReaction);
        alert(result.error);
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
        onClick={() => {
          document
            .getElementById("comments")
            ?.scrollIntoView({ behavior: "smooth" });
        }}
      >
        <MessageCircle className="h-4 w-4" />
        {commentCount}
      </Button>

      {/* Bookmark */}
      <Button variant="outline" size="sm" className="gap-2">
        <Bookmark className="h-4 w-4" />
        Save
      </Button>

      {/* Report */}
      <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
        <Flag className="h-4 w-4" />
        Report
      </Button>
    </div>
  );
}
