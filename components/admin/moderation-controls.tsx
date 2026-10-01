"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { moderateReport, type AdminActionState } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function ModerationControls({
  reportId,
  pending,
}: {
  reportId: string;
  pending: boolean;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<AdminActionState, FormData>(
    moderateReport,
    {},
  );

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  const confirmSensitiveAction = (
    event: React.MouseEvent<HTMLButtonElement>,
    action: "remove" | "ban",
  ) => {
    const message =
      action === "remove"
        ? "Remove the reported content and resolve this report?"
        : "Ban the account that published this reported content and resolve this report?";

    if (!window.confirm(message)) event.preventDefault();
  };

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="reportId" value={reportId} />
      <label htmlFor={`admin-note-${reportId}`} className="sr-only">
        Moderator note
      </label>
      <textarea
        id={`admin-note-${reportId}`}
        name="adminNote"
        rows={2}
        maxLength={1000}
        disabled={!pending || isPending}
        placeholder="Optional moderator note (visible in the audit record)"
        className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      />
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-muted-foreground">
          {state.success}
        </p>
      )}
      {pending && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            name="action"
            value="dismiss"
            variant="outline"
            size="sm"
            disabled={isPending}
          >
            Dismiss
          </Button>
          <Button
            type="submit"
            name="action"
            value="resolve"
            size="sm"
            disabled={isPending}
          >
            Resolve
          </Button>
          <Button
            type="submit"
            name="action"
            value="remove"
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={(event) => confirmSensitiveAction(event, "remove")}
          >
            Remove content
          </Button>
          <Button
            type="submit"
            name="action"
            value="ban"
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={(event) => confirmSensitiveAction(event, "ban")}
          >
            Ban author
          </Button>
          {isPending && (
            <Loader2
              className="h-5 w-5 animate-spin text-muted-foreground"
              aria-label="Applying moderation action"
            />
          )}
        </div>
      )}
    </form>
  );
}
