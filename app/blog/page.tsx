import { PostCard } from "@/components/posts/post-card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PenSquare } from "lucide-react";
import { createClient } from "@/lib/server";

export const metadata = {
  title: "Blog | Blogify",
  description: "Discover the latest posts from our community",
};

async function getPosts() {
  const supabase = await createClient();

  const { data: posts, error } = await supabase
    .from("posts")
    .select(
      `
      id,
      title,
      content,
      cover_image_url,
      created_at,
      author:profiles!author_id (
        username,
        full_name,
        avatar_url
      ),
      category:categories (
        name,
        slug
      ),
      post_tags (
        tag:tags (
          name,
          slug
        )
      ),
      reactions (count),
      comments (count)
    `,
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) {
    console.error("Error fetching posts:", error);
    throw new Error("Failed to load posts");
  }

  // Normalize the data shape for PostCard
  return (posts || []).map((post: any) => ({
    id: post.id,
    title: post.title,
    content: post.content,
    cover_image_url: post.cover_image_url,
    created_at: post.created_at,
    author: post.author,
    category: post.category,
    tags: (post.post_tags || []).map((pt: any) => pt.tag),
    reaction_count: post.reactions?.[0]?.count || 0,
    comment_count: post.comments?.[0]?.count || 0,
  }));
}

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Latest Posts
          </h1>
          <p className="mt-2 text-muted-foreground">
            Discover stories, ideas, and insights from our community
          </p>
        </div>

        <Button asChild>
          <Link href="/write">
            <PenSquare className="mr-2 h-4 w-4" />
            Write a post
          </Link>
        </Button>
      </div>

      {/* Posts Grid */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-24 text-center">
          <h2 className="text-xl font-semibold">No posts yet</h2>
          <p className="mt-2 max-w-sm text-muted-foreground">
            Be the first to share something with the community.
          </p>
          <Button asChild className="mt-6">
            <Link href="/write">Create your first post</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
