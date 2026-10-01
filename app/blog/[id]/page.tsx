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
import { DeletePostButton } from "@/components/posts/delete-post-button";
import { postIdParamSchema } from "@/lib/zod";
import { sanitizePostContent } from "@/lib/sanitize-post-content";

// --- Reaction & Data Types ---
export type ReactionType =
  | "like"
  | "love"
  | "care"
  | "haha"
  | "wow"
  | "sad"
  | "angry";

export type PostAuthor = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export type PostCategory = {
  id: string;
  name: string;
  slug: string;
};

export type PostTag = {
  id: string;
  name: string;
  slug: string;
};

// Raw response interfaces for Supabase relation mapping (No `any`)
type RawTagRelation = {
  id: string;
  name: string;
  slug: string;
};

type RawPostTag = {
  tag: RawTagRelation | RawTagRelation[] | null;
};

type RawAuthorRelation = PostAuthor | PostAuthor[] | null;
type RawCategoryRelation = PostCategory | PostCategory[] | null;

type RawPostResponse = {
  id: string;
  title: string;
  content: string;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
  author_id: string;
  author: RawAuthorRelation;
  category: RawCategoryRelation;
  post_tags: RawPostTag[] | null;
};

export type FormattedPost = {
  id: string;
  title: string;
  content: string;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
  author_id: string;
  author: PostAuthor;
  category: PostCategory | null;
  tags: PostTag[];
  reactionCounts: Record<ReactionType, number>;
  totalReactions: number;
  commentCount: number;
  userReaction: ReactionType | null;
  isBookmarked: boolean;
};

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props) {
  const rawParams = await params;
  
  const parsed = postIdParamSchema.safeParse(rawParams);
  if (!parsed.success) {
    return { title: "Post not found" };
  }

  const { id } = parsed.data;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("title, content")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!post) return { title: "Post not found" };

  return {
    title: post.title,
    description: post.content.replace(/<[^>]*>/g, "").slice(0, 160),
  };
}

async function getPost(id: string, userId?: string): Promise<FormattedPost | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
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

  if (error || !data) return null;

  const rawPost = data as unknown as RawPostResponse;

  // Safely normalize author join (Handles array vs object without `any`)
  const authorData = Array.isArray(rawPost.author) ? rawPost.author[0] : rawPost.author;
  if (!authorData) return null;

  const author: PostAuthor = authorData;

  // Safely normalize category join
  const categoryData = Array.isArray(rawPost.category) ? rawPost.category[0] : rawPost.category;
  const category: PostCategory | null = categoryData ?? null;

  // Extract nested tags cleanly using flatMap
  const tags: PostTag[] = (rawPost.post_tags || []).flatMap((pt) => {
    if (!pt.tag) return [];
    return Array.isArray(pt.tag) ? pt.tag : [pt.tag];
  });

  // Fetch reactions
  const { data: reactions } = await supabase
    .from("reactions")
    .select("type, user_id")
    .eq("post_id", id);

  const reactionCounts: Record<ReactionType, number> = {
    like: 0,
    love: 0,
    care: 0,
    haha: 0,
    wow: 0,
    sad: 0,
    angry: 0,
  };

  let userReaction: ReactionType | null = null;

  reactions?.forEach((r: { type: string; user_id: string }) => {
    if (r.type in reactionCounts) {
      const reactionKey = r.type as ReactionType;
      reactionCounts[reactionKey] = (reactionCounts[reactionKey] || 0) + 1;
      if (userId && r.user_id === userId) {
        userReaction = reactionKey;
      }
    }
  });

  const totalReactions = reactions?.length || 0;

  let isBookmarked = false;
  if (userId) {
    const { data: bookmark, error: bookmarkError } = await supabase
      .from("bookmarks")
      .select("post_id")
      .eq("user_id", userId)
      .eq("post_id", id)
      .maybeSingle();

    if (bookmarkError) {
      console.error("Error checking post bookmark:", bookmarkError);
      throw new Error("Failed to load post");
    }
    isBookmarked = Boolean(bookmark);
  }

  // Fetch comment count
  const { count: commentCount } = await supabase
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("post_id", id)
    .is("deleted_at", null);

  return {
    id: rawPost.id,
    title: rawPost.title,
    content: rawPost.content,
    cover_image_url: rawPost.cover_image_url,
    created_at: rawPost.created_at,
    updated_at: rawPost.updated_at,
    author_id: rawPost.author_id,
    author,
    category,
    tags,
    reactionCounts,
    totalReactions,
    commentCount: commentCount || 0,
    userReaction,
    isBookmarked,
  };
}

export default async function SinglePostPage({ params }: Props) {
  const rawParams = await params;

  // 1. Validate route parameter with Zod
  const parsed = postIdParamSchema.safeParse(rawParams);
  if (!parsed.success) {
    notFound();
  }

  const { id } = parsed.data;

  // 2. Fetch authenticated user first
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 3. Fetch formatted post
  const post = await getPost(id, user?.id);

  if (!post) notFound();

  const isAuthor = user?.id === post.author_id;
  const authorName = post.author.full_name || post.author.username || "Anonymous";

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
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <AvatarImage
                src={post.author.avatar_url || ""}
                alt={authorName}
              />
              <AvatarFallback>
                {post.author.full_name?.[0] || post.author.username?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              {post.author.username ? (
                <Link
                  href={`/profile/${encodeURIComponent(post.author.username)}`}
                  className="font-medium hover:underline"
                >
                  {authorName}
                </Link>
              ) : (
                <p className="font-medium">{authorName}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>

          {isAuthor && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/posts/${post.id}/edit`}>Edit</Link>
              </Button>
              <DeletePostButton postId={post.id} />
            </div>
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
        dangerouslySetInnerHTML={{
          __html: sanitizePostContent(post.content),
        }}
      />

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
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
          userReaction={post.userReaction}
          postAuthorId={post.author_id}
          initiallySaved={post.isBookmarked}
        />
      </div>

      {/* Comments */}
      <div id="comments" className="mt-12 border-t pt-10">
        <CommentSection postId={post.id} currentUserId={user?.id} />
      </div>
    </article>
  );
}