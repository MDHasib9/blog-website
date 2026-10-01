"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePost } from "@/actions/post";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";

export function DeletePostButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    if (!window.confirm("Delete this story? This cannot be undone.")) return;

    setError(null);
    startTransition(async () => {
      const result = await deletePost(postId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/blog");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="mr-2 h-4 w-4" />
        )}
        Delete
      </Button>
      {error && (
        <p role="alert" className="max-w-48 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
