"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFollow } from "@/actions/community";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, UserRoundCheck } from "lucide-react";

export function FollowButton({
  userId,
  initiallyFollowing,
}: {
  userId: string;
  initiallyFollowing: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    const previous = following;
    setFollowing(!previous);
    setError(null);

    startTransition(async () => {
      try {
        const result = await toggleFollow(userId);
        if (result.error || result.following === undefined) {
          setFollowing(previous);
          setError(result.error || "Could not update your follows.");
          return;
        }
        setFollowing(result.following);
        router.refresh();
      } catch (cause) {
        console.error("Unexpected error updating follow:", cause);
        setFollowing(previous);
        setError("Could not update your follows. Please try again.");
      }
    });
  };

  return (
    <div className="flex flex-col items-center gap-2 sm:items-start">
      <Button
        variant={following ? "outline" : "default"}
        onClick={handleToggle}
        disabled={isPending}
        aria-pressed={following}
      >
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : following ? (
          <UserRoundCheck className="mr-2 h-4 w-4" />
        ) : (
          <UserPlus className="mr-2 h-4 w-4" />
        )}
        {following ? "Following" : "Follow"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
