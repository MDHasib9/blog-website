import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { PostCard } from "@/components/posts/post-card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/server";
import { getPostFeed } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Saved stories",
};

export default async function BookmarksPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Error verifying bookmark viewer:", authError);
    throw new Error("Could not verify your account.");
  }
  if (!user) redirect("/auth/login?next=%2Fbookmarks");

  const { data: bookmarks, error: bookmarksError } = await supabase
    .from("bookmarks")
    .select("post_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (bookmarksError) {
    console.error("Error loading saved stories:", bookmarksError);
    throw new Error("Failed to load saved stories.");
  }

  const postIds = (bookmarks || []).map((bookmark) => bookmark.post_id);
  const { posts } = await getPostFeed({
    postIds,
    pageSize: Math.max(1, postIds.length),
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      <header className="mb-10 flex items-start gap-4">
        <div className="rounded-xl border bg-card p-3">
          <Bookmark className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Saved stories</h1>
          <p className="mt-2 text-muted-foreground">
            Keep interesting reads close for later.
          </p>
        </div>
      </header>

      {posts.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center">
          <h2 className="text-xl font-semibold">No saved stories yet</h2>
          <p className="mt-2 text-muted-foreground">
            Save stories you want to come back to and they&apos;ll appear here.
          </p>
          <Button className="mt-5" asChild>
            <Link href="/blog">Explore stories</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
