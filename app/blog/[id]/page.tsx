import { createClient } from "@/lib/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { PostActions } from "@/components/posts/post-actions";
import { CommentSection } from "@/components/posts/comment-section";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("title, content")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!post) return { title: "Post not found" };

  return {
    title: `${post.title} | Blogify`,
    description: post.content.replace(/<[^>]*>/g, "").slice(0, 160),
  };
}

async function getPost(id: string) {
  const supabase = await createClient();

  const { data: post, error } = await supabase
    .from("posts")
    .select(
      `
      id,
      title,
      content,
      cover_image_url,
      created_at,
      updated_at,
      author_id,
      author:profiles!author_id (
        id,
        username,
        full_name,
        avatar_url,
        bio
      ),
      category:categories (
        id,
        name,
        slug
      ),
      post_tags (
        tag:tags (
          id,
          name,
          slug
        )
      )
    `
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !post) return null;

  // Get reaction counts grouped by type
  const { data: reactions } = await supabase
    .from("reactions")
    .select("type")
    .eq("post_id", id);

  const reactionCounts: Record<string, number> = {
    like: 0,
    love: 0,
    care: 0,
    haha: 0,
    wow: 0,
    sad: 0,
    angry: 0,
  };

  reactions?.forEach((r) => {
    reactionCounts[r.type] = (reactionCounts[r.type] || 0) + 1;
  });

  const totalReactions = reactions?.length || 0;

  // Get comment count
  const { count: commentCount } = await supabase
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("post_id", id)
    .is("deleted_at", null);

  return {
    ...post,
    tags: (post.post_tags || []).map((pt: any) => pt.tag),
    reactionCounts,
    totalReactions,
    commentCount: commentCount || 0,
  };
}

export default async function SinglePostPage({ params }: Props) {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthor = user?.id === post.author_id;

  return (
    <article className="container mx-auto max-w-3xl px-4 py-10">
      {/* Header */}
      <header className="mb-8">
        {post.category && (
          <Badge variant="secondary" className="mb-4">
            {post.category.name}
          </Badge>
        )}

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          {post.title}
        </h1>

        <div className="mt-6 flex items-center justify-between gap-4">
          <Link
            href={`/profile/${post.author.username}`}
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <Avatar className="h-11 w-11">
              <AvatarImage src={post.author.avatar_url || ""} />
              <AvatarFallback>
                {post.author.full_name?.[0] || post.author.username?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">
                {post.author.full_name || post.author.username}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </Link>

          {isAuthor && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/posts/${post.id}/edit`}>Edit</Link>
            </Button>
          )}
        </div>
      </header>

      {/* Cover Image */}
      {post.cover_image_url && (
        <div className="relative mb-10 aspect-video overflow-hidden rounded-xl">
          <Image
            src={post.cover_image_url}
            alt={post.title}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>
      )}

      {/* Content */}
      <div
        className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-primary prose-img:rounded-lg"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-2">
          {post.tags.map((tag: any) => (
            <Badge key={tag.id} variant="outline">
              #{tag.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Reactions + Actions */}
      <div className="mt-10 border-t pt-8">
        <PostActions
          postId={post.id}
          initialCounts={post.reactionCounts}
          totalReactions={post.totalReactions}
          commentCount={post.commentCount}
          currentUserId={user?.id}
        />
      </div>

      {/* Comments */}
      <div className="mt-12 border-t pt-10">
        <CommentSection postId={post.id} currentUserId={user?.id} />
      </div>
    </article>
  );
}