"use server";

import { createClient } from "@/lib/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const commentSchema = z.object({
  postId: z.string().uuid("Invalid Post ID"),
  content: z.string().trim().min(1, "Comment cannot be empty").max(2000, "Comment is too long"),
  parentId: z.string().uuid("Invalid Parent ID").optional().nullable(),
});

export async function createComment(
  postId: string,
  content: string,
  parentId?: string | null
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to comment." };
  }

  // Check user profile ban / deletion status
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, deleted_at")
    .eq("id", user.id)
    .single();

  if (!profile || profile.is_banned || profile.deleted_at) {
    return { error: "Your account is not allowed to comment." };
  }

  // Schema Validation
  const parsed = commentSchema.safeParse({
    postId,
    content,
    parentId: parentId || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid comment data." };
  }

  const { postId: validPostId, content: validContent, parentId: validParentId } = parsed.data;

  // Validate parent comment if nested reply
  if (validParentId) {
    const { data: parentComment } = await supabase
      .from("comments")
      .select("id, post_id, deleted_at")
      .eq("id", validParentId)
      .single();

    if (!parentComment || parentComment.post_id !== validPostId || parentComment.deleted_at) {
      return { error: "The comment you are replying to no longer exists." };
    }
  }

  // Insert Comment
  const { data, error } = await supabase
    .from("comments")
    .insert({
      post_id: validPostId,
      author_id: user.id,
      content: validContent,
      parent_id: validParentId,
    })
    .select(
      `
      id,
      content,
      created_at,
      parent_id,
      author:profiles!author_id (
        id,
        username,
        full_name,
        avatar_url
      )
    `
    )
    .single();

  if (error) {
    console.error("Error creating comment:", error);
    return { error: "Failed to post comment." };
  }

  revalidatePath(`/blog/${validPostId}`);
  return { data };
}

export async function deleteComment(commentId: string, postId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  // Soft Delete
  const { data, error } = await supabase
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("author_id", user.id)
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Failed to delete comment or permission denied." };
  }

  revalidatePath(`/blog/${postId}`);
  return { success: true };
}