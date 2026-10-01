"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead } from "@/actions/community";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function MarkAllReadButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="outline"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await markAllNotificationsRead();
            if (result.error) {
              setError(result.error);
            } else {
              router.refresh();
            }
          });
        }}
      >
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Mark all read
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
