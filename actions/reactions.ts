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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to react." };
  }

  const parsed = reactionSchema.safeParse({ postId, type });
  if (!parsed.success) {
    return { error: "Invalid reaction." };
  }

  // Check if user already has a reaction on this post
  const { data: existing } = await supabase
    .from("reactions")
    .select("id, type")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .maybeSingle();

  if (existing) {
    if (existing.type === type) {
      // Same reaction → remove it
      await supabase.from("reactions").delete().eq("id", existing.id);
    } else {
      // Different reaction → update it
      await supabase
        .from("reactions")
        .update({ type })
        .eq("id", existing.id);
    }
  } else {
    // No reaction yet → insert
    await supabase.from("reactions").insert({
      user_id: user.id,
      post_id: postId,
      type,
    });
  }

  revalidatePath(`/blog/${postId}`);
  return { success: true };
}