import { createClient } from "@/lib/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { PostActions } from "@/components/posts/post-actions";
import { ShareButton } from "@/components/posts/share-button";
import { CommentSection } from "@/components/posts/comment-section";
import { DeletePostButton } from "@/components/posts/delete-post-button";
import { FollowButton } from "@/components/profile/follow-button";
import { postIdParamSchema } from "@/lib/zod";
import { sanitizePostContent } from "@/lib/sanitize-post-content";
import { ArrowLeft, BookOpen, Clock3 } from "lucide-react";

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
  let isFollowing = false;

  if (user && !isAuthor) {
    const { data: follow, error: followError } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", post.author_id)
      .maybeSingle();

    if (followError) {
      console.error("Error checking post author follow:", followError);
      throw new Error("Failed to load post.");
    }

    isFollowing = Boolean(follow);
  }

  const authorName = post.author.full_name || post.author.username || "Anonymous";
  const wordCount = post.content
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 220));
  const publishedDate = new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(post.created_at));

  return (
    <div className="min-h-screen bg-background">
      <article className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/blog"
            className="mb-10 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to stories
          </Link>

          <header className="mb-10">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              {post.category && (
                <Link
                  href={`/blog?category=${encodeURIComponent(post.category.slug)}`}
                  className="rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition-colors hover:bg-primary/10"
                >
                  {post.category.name}
                </Link>
              )}
              <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {publishedDate}
              </span>
            </div>

            <h1 className="max-w-4xl break-words font-serif text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
              {post.title}
            </h1>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-5 border-y py-5">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-12 w-12 ring-2 ring-background">
                  <AvatarImage src={post.author.avatar_url || ""} alt={authorName} />
                  <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                    {post.author.full_name?.[0] || post.author.username?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    {post.author.username ? (
                      <Link
                        href={`/profile/${encodeURIComponent(post.author.username)}`}
                        className="font-semibold decoration-primary/40 underline-offset-4 hover:underline"
                      >
                        {authorName}
                      </Link>
                    ) : (
                      <p className="font-semibold">{authorName}</p>
                    )}
                    {!isAuthor &&
                      (user ? (
                        <FollowButton
                          userId={post.author_id}
                          initiallyFollowing={isFollowing}
                          size="sm"
                        />
                      ) : (
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href={`/auth/login?next=${encodeURIComponent(
                              post.author.username
                                ? `/profile/${post.author.username}`
                                : `/blog/${post.id}`,
                            )}`}
                          >
                            Sign in to follow
                          </Link>
                        </Button>
                      ))}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>
                      {formatDistanceToNow(new Date(post.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {readingMinutes} min read
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <ShareButton title={post.title} />
                {isAuthor && (
                  <>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/posts/${post.id}/edit`}>Edit story</Link>
                    </Button>
                    <DeletePostButton postId={post.id} />
                  </>
                )}
              </div>
            </div>
          </header>
        </div>

        {post.cover_image_url && (
          <figure className="relative mx-auto mb-14 aspect-[16/9] max-h-[660px] overflow-hidden rounded-2xl border bg-muted shadow-xl shadow-black/5 sm:rounded-3xl">
            <Image
              src={post.cover_image_url}
              alt={post.title}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 92vw, 1152px"
            />
          </figure>
        )}

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-16">
          <div className="mx-auto w-full max-w-3xl">
            <div
              className="prose prose-neutral max-w-none break-words text-[1.075rem] leading-[1.9] dark:prose-invert sm:text-lg prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mt-12 prose-h2:text-3xl prose-h3:mt-10 prose-a:font-medium prose-a:text-primary prose-a:decoration-primary/40 prose-a:underline-offset-4 hover:prose-a:decoration-primary prose-blockquote:border-l-primary/50 prose-blockquote:font-serif prose-blockquote:text-xl prose-img:my-10 prose-img:rounded-2xl prose-pre:rounded-2xl prose-pre:border prose-pre:bg-muted/70"
              dangerouslySetInnerHTML={{
                __html: sanitizePostContent(post.content),
              }}
            />

            {post.tags.length > 0 && (
              <div className="mt-12 flex flex-wrap items-center gap-2 border-t pt-7">
                <span className="mr-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Filed under
                </span>
                {post.tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="rounded-full px-3 py-1 font-medium"
                  >
                    #{tag.name}
                  </Badge>
                ))}
              </div>
            )}

            <section className="mt-12 rounded-2xl border bg-card p-5 sm:p-7">
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14 shrink-0">
                  <AvatarImage src={post.author.avatar_url || ""} alt={authorName} />
                  <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                    {post.author.full_name?.[0] || post.author.username?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Written by
                  </p>
                  {post.author.username ? (
                    <Link
                      href={`/profile/${encodeURIComponent(post.author.username)}`}
                      className="mt-1 inline-block text-lg font-semibold hover:underline"
                    >
                      {authorName}
                    </Link>
                  ) : (
                    <p className="mt-1 text-lg font-semibold">{authorName}</p>
                  )}
                  {post.author.bio && (
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {post.author.bio}
                    </p>
                  )}
                </div>
                {post.author.username && (
                  <Button variant="outline" size="sm" className="shrink-0" asChild>
                    <Link
                      href={`/profile/${encodeURIComponent(post.author.username)}`}
                    >
                      Profile
                    </Link>
                  </Button>
                )}
              </div>
            </section>
          </div>

          <aside className="lg:pt-2">
            <div className="space-y-4 lg:sticky lg:top-8">
              <div className="rounded-2xl border bg-card p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                  <BookOpen className="h-4 w-4 text-primary" />
                  About this story
                </div>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Reading time</dt>
                    <dd className="font-medium">{readingMinutes} min</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Responses</dt>
                    <dd className="font-medium">{post.commentCount}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Reactions</dt>
                    <dd className="font-medium">{post.totalReactions}</dd>
                  </div>
                </dl>
              </div>
              <div className="rounded-2xl border bg-muted/40 p-5">
                <p className="text-sm font-semibold">Enjoyed this story?</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Save it for later or share it with someone who would appreciate it.
                </p>
                <div className="mt-4">
                  
                  <ShareButton title={post.title} label="Share this story" />
                </div>
              </div>
            </div>
          </aside>
        </div>

        <div className="mx-auto mt-12 max-w-6xl border-t pt-7">
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

        <section
          id="comments"
          className="mx-auto mt-14 max-w-4xl scroll-mt-8 border-t pt-10 sm:pt-14"
        >
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Join the conversation
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
                Reader responses
              </h2>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
              {post.commentCount}
            </span>
          </div>
          <CommentSection postId={post.id} currentUserId={user?.id} />
        </section>
      </article>
    </div>
  );
}