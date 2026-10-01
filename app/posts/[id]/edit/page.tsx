import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { WriteForm } from "@/components/posts/write-form";
import { createClient } from "@/lib/server";
import { postIdParamSchema } from "@/lib/zod";

export const metadata: Metadata = {
  title: "Edit story",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditPostPage({ params }: Props) {
  const parsed = postIdParamSchema.safeParse(await params);
  if (!parsed.success) notFound();

  const { id } = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Error verifying post editor:", authError);
    throw new Error("Could not verify your account.");
  }
  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(`/posts/${id}/edit`)}`);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_banned, deleted_at")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error checking post editor permissions:", profileError);
    throw new Error("Could not verify your account permissions.");
  }
  if (!profile || profile.is_banned || profile.deleted_at) redirect("/blog");

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id, title, content, cover_image_url, category_id, author_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (postError) {
    console.error("Error loading post for editing:", postError);
    throw new Error("Failed to load this story.");
  }
  if (!post) notFound();
  if (post.author_id !== user.id) redirect(`/blog/${id}`);

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");

  if (categoriesError) {
    console.error("Error loading post categories:", categoriesError);
    throw new Error("Failed to load categories.");
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">Your story</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Edit story</h1>
        <p className="mt-2 text-muted-foreground">
          Update your story, cover image, or topic.
        </p>
      </div>
      <WriteForm categories={categories || []} initialPost={post} />
    </div>
  );
}
