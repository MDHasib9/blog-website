"use client";

import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Bookmark, Flag } from "lucide-react";

type Props = {
  postId: string;
  initialCounts: Record<string, number>;
  totalReactions: number;
  commentCount: number;
  currentUserId?: string;
};

export function PostActions({
  totalReactions,
  commentCount,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" size="sm" className="gap-2">
        <Heart className="h-4 w-4" />
        {totalReactions}
      </Button>
      <Button variant="outline" size="sm" className="gap-2">
        <MessageCircle className="h-4 w-4" />
        {commentCount}
      </Button>
      <Button variant="outline" size="sm" className="gap-2">
        <Bookmark className="h-4 w-4" />
        Save
      </Button>
      <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
        <Flag className="h-4 w-4" />
        Report
      </Button>
    </div>
  );
}