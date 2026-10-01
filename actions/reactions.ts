"use server";

import { createClient } from "@/lib/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const reactionSchema = z.object({
  postId: z.string().uuid(),
  type: z.enum(["like", "love", "care", "haha", "wow", "sad", "angry"]),
});

export async function toggleReaction(postId: string, type: string) {
  const supabase = await createClient();

  const parsed = reactionSchema.safeParse({ postId, type });
  if (!parsed.success) {
    return { error: "Invalid reaction." };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Error verifying reaction author:", authError);
    return { error: "Could not verify your account. Please try again." };
  }

  if (!user) {
    return { error: "You must be logged in to react." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_banned, deleted_at")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error checking reaction permissions:", profileError);
    return { error: "Could not verify your account permissions." };
  }
  if (profile.is_banned || profile.deleted_at) {
    return { error: "Your account is not allowed to react." };
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id")
    .eq("id", parsed.data.postId)
    .is("deleted_at", null)
    .maybeSingle();

  if (postError) {
    console.error("Error checking reaction target:", postError);
    return { error: "Could not load this post. Please try again." };
  }
  if (!post) {
    return { error: "This post is no longer available." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("reactions")
    .select("id, type")
    .eq("user_id", user.id)
    .eq("post_id", parsed.data.postId)
    .maybeSingle();

  if (existingError) {
    console.error("Error loading existing reaction:", existingError);
    return { error: "Could not update your reaction. Please try again." };
  }

  let mutationError: unknown = null;
  if (existing) {
    if (existing.type === parsed.data.type) {
      ({ error: mutationError } = await supabase
        .from("reactions")
        .delete()
        .eq("id", existing.id));
    } else {
      ({ error: mutationError } = await supabase
        .from("reactions")
        .update({ type: parsed.data.type })
        .eq("id", existing.id));
    }
  } else {
    ({ error: mutationError } = await supabase.from("reactions").insert({
      user_id: user.id,
      post_id: parsed.data.postId,
      type: parsed.data.type,
    }));
  }

  if (mutationError) {
    console.error("Error saving reaction:", mutationError);
    return { error: "Could not update your reaction. Please try again." };
  }

  revalidatePath(`/blog/${parsed.data.postId}`);
  return { success: true };
}