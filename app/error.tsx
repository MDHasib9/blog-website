"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ApplicationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <div className="container mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-medium text-muted-foreground">
        Something went wrong
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        We couldn&apos;t load this page
      </h1>
      <p className="mt-3 text-muted-foreground">
        Please try again. If the problem continues, come back in a little while.
      </p>
      {error.digest && (
        <p className="mt-3 text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}
      <Button className="mt-6" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
