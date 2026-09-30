"use server";

import { createClient } from "@/lib/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const createPostSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  content: z.string().min(10, "Content is too short"),
  cover_image_url: z.string().url().optional().or(z.literal("")),
  category_id: z.string().uuid().optional().or(z.literal("")),
  tags: z.string().optional(), // comma separated
});

export type CreatePostState = {
  errors?: {
    title?: string[];
    content?: string[];
    cover_image_url?: string[];
    category_id?: string[];
    tags?: string[];
    _form?: string[];
  };
  success?: boolean;
};

export async function createPost(
  prevState: CreatePostState,
  formData: FormData
): Promise<CreatePostState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { errors: { _form: ["You must be logged in to create a post."] } };
  }

  // Check if user is banned
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, deleted_at")
    .eq("id", user.id)
    .single();

  if (!profile || profile.is_banned || profile.deleted_at) {
    return { errors: { _form: ["Your account cannot create posts."] } };
  }

  const raw = {
    title: formData.get("title"),
    content: formData.get("content"),
    cover_image_url: formData.get("cover_image_url") || "",
    category_id: formData.get("category_id") || "",
    tags: formData.get("tags") || "",
  };

  const validated = createPostSchema.safeParse(raw);

  if (!validated.success) {
    return {
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const { title, content, cover_image_url, category_id, tags } = validated.data;

  // Create the post
  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      title,
      content,
      cover_image_url: cover_image_url || null,
      category_id: category_id || null,
    })
    .select("id")
    .single();

  if (postError || !post) {
    console.error(postError);
    return { errors: { _form: ["Failed to create post. Please try again."] } };
  }

  // Handle tags
  if (tags && tags.trim()) {
    const tagNames = tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    for (const name of tagNames) {
      // Upsert tag
      const slug = name.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

      const { data: tag } = await supabase
        .from("tags")
        .upsert({ name, slug }, { onConflict: "slug" })
        .select("id")
        .single();

      if (tag) {
        await supabase.from("post_tags").insert({
          post_id: post.id,
          tag_id: tag.id,
        });
      }
    }
  }

  revalidatePath("/blog");
  redirect(`/blog/${post.id}`);
}