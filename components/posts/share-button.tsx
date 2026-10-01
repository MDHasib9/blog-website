"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareButton({
  title,
  label = "Share",
}: {
  title: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShare = async () => {
    const url = window.location.href;
    setError(null);

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (shareError) {
        if (
          shareError instanceof DOMException &&
          shareError.name === "AbortError"
        ) {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (clipboardError) {
      console.error("Could not share or copy story link:", clipboardError);
      setError("Could not copy the story link.");
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={handleShare}
      >
        {copied ? (
          <Check className="h-4 w-4" />
        ) : label === "Share" ? (
          <Share2 className="h-4 w-4" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        {copied ? "Link copied" : label}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
