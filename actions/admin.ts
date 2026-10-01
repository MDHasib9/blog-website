"use server";

import { createClient } from "@/lib/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const adminActionSchema = z.object({
  reportId: z.string().uuid(),
  action: z.enum(["resolve", "dismiss", "remove", "ban"]),
  adminNote: z.string().trim().max(1000, "Notes must be 1000 characters or fewer."),
});

export type AdminActionState = {
  error?: string;
  success?: string;
};

async function getAdminContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Error verifying administrator:", authError);
    return { error: "Could not verify your account." };
  }
  if (!user) return { error: "You must be signed in as an administrator." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_banned, deleted_at")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error checking administrator role:", profileError);
    return { error: "Could not verify administrator permissions." };
  }
  if (
    !profile ||
    profile.role !== "admin" ||
    profile.is_banned ||
    profile.deleted_at
  ) {
    return { error: "Administrator access is required." };
  }

  return { supabase, user, error: null };
}

export async function moderateReport(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const validated = adminActionSchema.safeParse({
    reportId: formData.get("reportId"),
    action: formData.get("action"),
    adminNote: formData.get("adminNote") || "",
  });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || "Invalid moderation action." };
  }

  const { supabase, user, error: accessError } = await getAdminContext();
  if (accessError || !user || !supabase) {
    return { error: accessError || "Administrator access is required." };
  }

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("id, post_id, comment_id, reason, status")
    .eq("id", validated.data.reportId)
    .maybeSingle();

  if (reportError) {
    console.error("Error loading report for moderation:", reportError);
    return { error: "Could not load this report." };
  }
  if (!report) return { error: "This report no longer exists." };
  if (report.status !== "pending") {
    return { error: "This report has already been reviewed." };
  }

  const hasPost = Boolean(report.post_id);
  const hasComment = Boolean(report.comment_id);
  if (hasPost === hasComment) {
    return { error: "This report has an invalid content target and needs database review." };
  }

  if (validated.data.action === "remove") {
    const now = new Date().toISOString();
    if (report.post_id) {
      const { error } = await supabase
        .from("posts")
        .update({ deleted_at: now })
        .eq("id", report.post_id)
        .is("deleted_at", null);

      if (error) {
        console.error("Error removing reported post:", error);
        return { error: "Could not remove the reported story." };
      }
      revalidatePath(`/blog/${report.post_id}`);
    } else if (report.comment_id) {
      const { error } = await supabase
        .from("comments")
        .update({ deleted_at: now })
        .eq("id", report.comment_id)
        .is("deleted_at", null);

      if (error) {
        console.error("Error removing reported comment:", error);
        return { error: "Could not remove the reported comment." };
      }
    }
  }

  if (validated.data.action === "ban") {
    let authorId: string | null = null;

    if (report.post_id) {
      const { data: post, error } = await supabase
        .from("posts")
        .select("author_id")
        .eq("id", report.post_id)
        .maybeSingle();

      if (error) {
        console.error("Error loading reported story author:", error);
        return { error: "Could not load the reported author's account." };
      }
      authorId = post?.author_id ?? null;
    } else if (report.comment_id) {
      const { data: comment, error } = await supabase
        .from("comments")
        .select("author_id")
        .eq("id", report.comment_id)
        .maybeSingle();

      if (error) {
        console.error("Error loading reported comment author:", error);
        return { error: "Could not load the reported author's account." };
      }
      authorId = comment?.author_id ?? null;
    }

    if (!authorId) return { error: "The reported author could not be found." };
    if (authorId === user.id) {
      return { error: "You cannot ban your own administrator account." };
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        is_banned: true,
        banned_at: new Date().toISOString(),
        banned_reason:
          validated.data.adminNote || report.reason.slice(0, 500),
      })
      .eq("id", authorId)
      .is("deleted_at", null);

    if (error) {
      console.error("Error banning reported author:", error);
      return { error: "Could not ban the reported author's account." };
    }
  }

  const status =
    validated.data.action === "dismiss" ? "dismissed" : "resolved";
  const { error: reviewError } = await supabase
    .from("reports")
    .update({
      status,
      admin_note: validated.data.adminNote || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", report.id)
    .eq("status", "pending");

  if (reviewError) {
    console.error("Error recording report review:", reviewError);
    return {
      error: "The action was applied, but the report could not be marked reviewed. Recheck it before retrying.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/blog");
  revalidatePath("/");
  return {
    success:
      status === "dismissed"
        ? "Report dismissed."
        : validated.data.action === "remove"
          ? "Content removed and report resolved."
          : validated.data.action === "ban"
            ? "Author banned and report resolved."
            : "Report resolved.",
  };
}
