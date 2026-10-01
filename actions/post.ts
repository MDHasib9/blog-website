"use server";

import { createClient } from "@/lib/server";
import { sanitizePostContent } from "@/lib/sanitize-post-content";
import { postIdParamSchema } from "@/lib/zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const postSubmissionSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(150),
  content: z.string().max(100_000, "Post content is too long"),
  cover_image_url: z.string().url().optional().or(z.literal("")),
  category_id: z.string().uuid().optional().or(z.literal("")),
  tags: z.string().max(500, "Tags are too long").optional(),
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
};

async function canPublish(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_banned, deleted_at")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error checking post author permissions:", error);
    return false;
  }

  return !profile.is_banned && !profile.deleted_at;
}

function getSubmission(formData: FormData) {
  return postSubmissionSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
    cover_image_url: formData.get("cover_image_url") || "",
    category_id: formData.get("category_id") || "",
    tags: formData.get("tags") || "",
  });
}

function validatePostText(content: string): boolean {
  const text = sanitizePostContent(content)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length >= 10;
}

function getTagNames(value: string | undefined):
  | { names: string[] }
  | { error: string } {
  const names = (value || "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  const uniqueTags = new Map<string, string>();

  for (const name of names) {
    if (name.length > 40) {
      return { error: "Each tag must be 40 characters or fewer." };
    }

    const slug = slugifyTag(name);
    if (!slug) {
      return { error: "Tags must include at least one letter or number." };
    }
    if (!uniqueTags.has(slug)) uniqueTags.set(slug, name);
  }

  if (uniqueTags.size > 10) {
    return { error: "You can add up to 10 tags." };
  }

  return { names: [...uniqueTags.values()] };
}

function slugifyTag(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 -]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export async function createPost(
  _previousState: CreatePostState,
  formData: FormData,
): Promise<CreatePostState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Error verifying post author:", authError);
    return { errors: { _form: ["Could not verify your account. Please try again."] } };
  }

  if (!user) {
    return { errors: { _form: ["You must be logged in to create a post."] } };
  }

  if (!(await canPublish(user.id))) {
    return { errors: { _form: ["Your account cannot create posts."] } };
  }

  const validated = getSubmission(formData);
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { title, content, cover_image_url, category_id, tags } = validated.data;
  if (!validatePostText(content)) {
    return { errors: { content: ["Write at least 10 characters in your post."] } };
  }

  const parsedTags = getTagNames(tags);
  if ("error" in parsedTags) {
    return { errors: { tags: [parsedTags.error] } };
  }

  const tagIds: string[] = [];
  for (const name of parsedTags.names) {
    const slug = slugifyTag(name);
    const { data: tag, error: tagError } = await supabase
      .from("tags")
      .upsert({ name, slug }, { onConflict: "slug" })
      .select("id")
      .single();

    if (tagError || !tag) {
      console.error("Error saving post tag:", tagError);
      return {
        errors: { tags: ["Could not save tags. Please review them and try again."] },
      };
    }

    tagIds.push(tag.id);
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      title,
      content: sanitizePostContent(content),
      cover_image_url: cover_image_url || null,
      category_id: category_id || null,
    })
    .select("id")
    .single();

  if (postError || !post) {
    console.error("Error creating post:", postError);
    return { errors: { _form: ["Failed to create post. Please try again."] } };
  }

  if (tagIds.length > 0) {
    const { error: relationError } = await supabase.from("post_tags").insert(
      tagIds.map((tagId) => ({ post_id: post.id, tag_id: tagId })),
    );

    if (relationError) {
      console.error("Error attaching tags to post:", relationError);
      const { error: rollbackError } = await supabase
        .from("posts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", post.id)
        .eq("author_id", user.id);

      if (rollbackError) {
        console.error("Error hiding incomplete post:", rollbackError);
      }

      return {
        errors: {
          _form: ["The post could not be published with its tags. Please try again."],
        },
      };
    }
  }

  revalidatePath("/");
  revalidatePath("/blog");
  redirect(`/blog/${post.id}`);
}

export async function updatePost(
  postId: string,
  _previousState: CreatePostState,
  formData: FormData,
): Promise<CreatePostState> {
  const parsedId = postIdParamSchema.safeParse({ id: postId });
  if (!parsedId.success) {
    return { errors: { _form: ["Invalid post."] } };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Error verifying post author:", authError);
    return { errors: { _form: ["Could not verify your account. Please try again."] } };
  }
  if (!user) {
    return { errors: { _form: ["You must be logged in to edit a post."] } };
  }
  if (!(await canPublish(user.id))) {
    return { errors: { _form: ["Your account cannot edit posts."] } };
  }

  const validated = getSubmission(formData);
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { title, content, cover_image_url, category_id } = validated.data;
  if (!validatePostText(content)) {
    return { errors: { content: ["Write at least 10 characters in your post."] } };
  }

  const { data: post, error } = await supabase
    .from("posts")
    .update({
      title,
      content: sanitizePostContent(content),
      cover_image_url: cover_image_url || null,
      category_id: category_id || null,
    })
    .eq("id", parsedId.data.id)
    .eq("author_id", user.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Error updating post:", error);
    return { errors: { _form: ["Failed to save changes. Please try again."] } };
  }
  if (!post) {
    return {
      errors: { _form: ["This post no longer exists or you cannot edit it."] },
    };
  }

  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.id}`);
  redirect(`/blog/${post.id}`);
}

export async function deletePost(postId: string): Promise<{ error?: string }> {
  const parsedId = postIdParamSchema.safeParse({ id: postId });
  if (!parsedId.success) return { error: "Invalid post." };

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Error verifying post author:", authError);
    return { error: "Could not verify your account. Please try again." };
  }
  if (!user) return { error: "You must be logged in to delete a post." };

  const { data: post, error } = await supabase
    .from("posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsedId.data.id)
    .eq("author_id", user.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Error deleting post:", error);
    return { error: "Failed to delete post. Please try again." };
  }
  if (!post) return { error: "This post no longer exists or you cannot delete it." };

  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.id}`);
  return {};
}
