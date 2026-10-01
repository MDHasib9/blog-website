import Link from "next/link";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Heart } from "lucide-react";
import { formatDistanceToNow } from "date-fns"; 

type PostCardProps = {
  post: {
    id: string;
    title: string;
    content: string;
    cover_image_url: string | null;
    created_at: string;
    author: {
      username: string | null;
      full_name: string | null;
      avatar_url: string | null;
    };
    category: {
      name: string;
      slug: string;
    } | null;
    tags: { name: string; slug: string }[];
    reaction_count: number;
    comment_count: number;
  };
};

export function PostCard({ post }: PostCardProps) {
  const plainText = post.content
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  const excerpt =
    plainText.slice(0, 160) + (plainText.length > 160 ? "..." : "");
  const authorName =
    post.author.full_name || post.author.username || "Anonymous";

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:shadow-md">
      {/* Cover Image */}
      {post.cover_image_url ? (
        <Link href={`/blog/${post.id}`} className="relative aspect-video overflow-hidden">
          <Image
            src={post.cover_image_url}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </Link>
      ) : (
        <Link
          href={`/blog/${post.id}`}
          className="flex aspect-video items-center justify-center bg-muted"
        >
          <span className="text-4xl font-bold text-muted-foreground/40">
            {post.title[0]}
          </span>
        </Link>
      )}

      <div className="flex flex-1 flex-col p-5">
        {/* Category + Date */}
        <div className="mb-3 flex items-center justify-between gap-2 text-sm text-muted-foreground">
          {post.category ? (
            <Link href={`/blog?category=${encodeURIComponent(post.category.slug)}`}>
              <Badge
                variant="secondary"
                className="font-normal hover:bg-secondary/70"
              >
                {post.category.name}
              </Badge>
            </Link>
          ) : (
            <span />
          )}
          <time dateTime={post.created_at}>
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </time>
        </div>

        {/* Title */}
        <Link href={`/blog/${post.id}`}>
          <h2 className="mb-2 line-clamp-2 text-xl font-semibold leading-snug tracking-tight transition-colors group-hover:text-primary">
            {post.title}
          </h2>
        </Link>

        {/* Excerpt */}
        <p className="mb-4 line-clamp-3 flex-1 text-sm text-muted-foreground">
          {excerpt}
        </p>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {post.tags.slice(0, 3).map((tag) => (
              <Badge key={tag.slug} variant="outline" className="text-xs font-normal">
                #{tag.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Author + Stats */}
        <div className="mt-auto flex items-center justify-between border-t pt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar className="h-8 w-8">
              <AvatarImage src={post.author.avatar_url || ""} alt={authorName} />
              <AvatarFallback>
                {post.author.full_name?.[0] || post.author.username?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            {post.author.username ? (
              <Link
                href={`/profile/${encodeURIComponent(post.author.username)}`}
                className="truncate text-sm font-medium transition-opacity hover:opacity-80"
              >
                {authorName}
              </Link>
            ) : (
              <span className="truncate text-sm font-medium">{authorName}</span>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart className="h-4 w-4" />
              {post.reaction_count}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              {post.comment_count}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}