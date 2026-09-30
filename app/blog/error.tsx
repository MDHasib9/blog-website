"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function BlogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Blog page error:", error);
  }, [error]);

  return (
    <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
      </div>
      <h2 className="mb-2 text-2xl font-bold">Something went wrong</h2>
      <p className="mb-8 max-w-md text-muted-foreground">
        We couldn’t load the posts right now. Please try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}