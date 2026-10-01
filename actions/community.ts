"use server";

import { createClient } from "@/lib/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const uuidSchema = z.string().uuid();
const reportSchema = z.object({
  postId: z.string().uuid().optional(),
  commentId: z.string().uuid().optional(),
  reason: z.string().trim().min(10, "Please provide at least 10 characters.")
    .max(1000, "Please keep the report under 1000 characters."),
}).refine((value) => Boolean(value.postId) !== Boolean(value.commentId), {
  message: "Select one post or comment to report.",
});

export type ReportState = {
  error?: string;
  success?: boolean;
};

async function getActiveUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Error verifying community action user:", authError);
    return { supabase, error: "Could not verify your account. Please try again." };
  }
  if (!user) {
    return { supabase, error: "Sign in to use this feature." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_banned, deleted_at")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error checking community action permissions:", profileError);
    return { supabase, error: "Could not verify your account permissions." };
  }
  if (!profile || profile.is_banned || profile.deleted_at) {
    return { supabase, error: "Your account cannot use this feature." };
  }

  return { supabase, user, error: null };
}

export async function toggleBookmark(
  postId: string,
): Promise<{ saved?: boolean; error?: string }> {
  const parsedPostId = uuidSchema.safeParse(postId);
  if (!parsedPostId.success) return { error: "Invalid post." };

  const { supabase, user, error: accessError } = await getActiveUser();
  if (accessError || !user) return { error: accessError || "Sign in to save stories." };

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id")
    .eq("id", parsedPostId.data)
    .is("deleted_at", null)
    .maybeSingle();

  if (postError) {
    console.error("Error checking bookmark post:", postError);
    return { error: "Could not load this story. Please try again." };
  }
  if (!post) return { error: "This story is no longer available." };

  const { data: bookmark, error: bookmarkError } = await supabase
    .from("bookmarks")
    .select("post_id")
    .eq("user_id", user.id)
    .eq("post_id", parsedPostId.data)
    .maybeSingle();

  if (bookmarkError) {
    console.error("Error checking bookmark:", bookmarkError);
    return { error: "Could not update your saved stories." };
  }

  if (bookmark) {
    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq("post_id", parsedPostId.data);

    if (error) {
      console.error("Error removing bookmark:", error);
      return { error: "Could not remove this saved story." };
    }

    revalidatePath("/bookmarks");
    revalidatePath(`/blog/${parsedPostId.data}`);
    return { saved: false };
  }

  const { error } = await supabase.from("bookmarks").insert({
    user_id: user.id,
    post_id: parsedPostId.data,
  });

  if (error) {
    console.error("Error saving bookmark:", error);
    return { error: "Could not save this story. Please try again." };
  }

  revalidatePath("/bookmarks");
  revalidatePath(`/blog/${parsedPostId.data}`);
  return { saved: true };
}

export async function toggleFollow(
  targetUserId: string,
): Promise<{ following?: boolean; error?: string }> {
  const parsedTarget = uuidSchema.safeParse(targetUserId);
  if (!parsedTarget.success) return { error: "Invalid profile." };

  const { supabase, user, error: accessError } = await getActiveUser();
  if (accessError || !user) return { error: accessError || "Sign in to follow authors." };
  if (user.id === parsedTarget.data) {
    return { error: "You cannot follow your own profile." };
  }

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", parsedTarget.data)
    .maybeSingle();

  if (targetError) {
    console.error("Error checking follow target:", targetError);
    return { error: "Could not load this profile. Please try again." };
  }
  if (!target) return { error: "This profile is no longer available." };

  const { data: existing, error: followError } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", target.id)
    .maybeSingle();

  if (followError) {
    console.error("Error checking follow:", followError);
    return { error: "Could not update your follows. Please try again." };
  }

  if (existing) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", target.id);

    if (error) {
      console.error("Error unfollowing author:", error);
      return { error: "Could not unfollow this author. Please try again." };
    }

    revalidatePath("/profile/[username]", "page");
    revalidatePath("/following");
    revalidatePath("/notifications");
    return { following: false };
  }

  const { error } = await supabase.from("follows").insert({
    follower_id: user.id,
    following_id: target.id,
  });

  if (error) {
    console.error("Error following author:", error);
    return { error: "Could not follow this author. Please try again." };
  }

  revalidatePath("/profile/[username]", "page");
  revalidatePath("/following");
  revalidatePath("/notifications");
  return { following: true };
}

export async function createReport(
  _previousState: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const validated = reportSchema.safeParse({
    postId: formData.get("postId") || undefined,
    commentId: formData.get("commentId") || undefined,
    reason: formData.get("reason"),
  });

  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || "Invalid report." };
  }

  const { supabase, user, error: accessError } = await getActiveUser();
  if (accessError || !user) return { error: accessError || "Sign in to report content." };

  if (validated.data.postId) {
    const { data: post, error } = await supabase
      .from("posts")
      .select("id")
      .eq("id", validated.data.postId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("Error checking reported post:", error);
      return { error: "Could not verify this story. Please try again." };
    }
    if (!post) return { error: "This story is no longer available." };
  }

  if (validated.data.commentId) {
    const { data: comment, error } = await supabase
      .from("comments")
      .select("id")
      .eq("id", validated.data.commentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("Error checking reported comment:", error);
      return { error: "Could not verify this comment. Please try again." };
    }
    if (!comment) return { error: "This comment is no longer available." };
  }

  const baseReportQuery = supabase
    .from("reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("status", "pending");

  const existingReportQuery = validated.data.postId
    ? baseReportQuery.eq("post_id", validated.data.postId)
    : validated.data.commentId
      ? baseReportQuery.eq("comment_id", validated.data.commentId)
      : null;

  if (!existingReportQuery) {
    return { error: "Select one post or comment to report." };
  }

  const { data: existingReport, error: existingReportError } =
    await existingReportQuery.maybeSingle();

  if (existingReportError) {
    console.error("Error checking duplicate content report:", existingReportError);
    return { error: "Could not check for an existing report. Please try again." };
  }
  if (existingReport) {
    return { error: "You already have a pending report for this content." };
  }

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    post_id: validated.data.postId || null,
    comment_id: validated.data.commentId || null,
    reason: validated.data.reason,
    status: "pending",
  });

  if (error) {
    console.error("Error submitting report:", error);
    return { error: "Could not submit your report. Please try again." };
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function markNotificationRead(
  notificationId: string,
): Promise<{ error?: string }> {
  const parsedId = uuidSchema.safeParse(notificationId);
  if (!parsedId.success) return { error: "Invalid notification." };

  const { supabase, user, error: accessError } = await getActiveUser();
  if (accessError || !user) return { error: accessError || "Sign in to view notifications." };

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", parsedId.data)
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) {
    console.error("Error marking notification read:", error);
    return { error: "Could not update this notification." };
  }

  revalidatePath("/notifications");
  return {};
}

export async function markAllNotificationsRead(): Promise<{ error?: string }> {
  const { supabase, user, error: accessError } = await getActiveUser();
  if (accessError || !user) return { error: accessError || "Sign in to view notifications." };

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) {
    console.error("Error marking notifications read:", error);
    return { error: "Could not update your notifications." };
  }

  revalidatePath("/notifications");
  return {};
}
