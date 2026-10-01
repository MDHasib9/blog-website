"use client";

import { useState, useTransition } from "react";
import { markNotificationRead } from "@/actions/community";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await markNotificationRead(notificationId);
            if (result.error) setError(result.error);
          });
        }}
      >
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Mark read
      </Button>
      {error && (
        <p role="alert" className="max-w-40 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
