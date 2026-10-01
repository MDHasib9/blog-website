import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { PostCard } from "@/components/posts/post-card";
import { Button } from "@/components/ui/button";
import { getPostFeed } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Search stories",
  description: "Search stories and ideas from the Blogify community.",
};

type Props = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const { posts } = query
    ? await getPostFeed({ search: query, pageSize: 12 })
    : { posts: [] };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      <header className="mx-auto mb-10 max-w-2xl text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Find your next read
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Search stories
        </h1>
        <form action="/search" className="mt-6 flex gap-2">
          <label className="sr-only" htmlFor="story-search">
            Search stories
          </label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="story-search"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search by title or keyword"
              className="h-11 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <Button type="submit" size="lg">
            Search
          </Button>
        </form>
      </header>

      {!query ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="text-muted-foreground">
            Enter a topic, title, or keyword to find a story.
          </p>
          <Button variant="link" asChild className="mt-2">
            <Link href="/blog">Browse all stories</Link>
          </Button>
        </div>
      ) : posts.length > 0 ? (
        <>
          <p className="mb-5 text-sm text-muted-foreground">
            Showing results for <span className="font-medium text-foreground">“{query}”</span>
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <h2 className="text-xl font-semibold">No stories found</h2>
          <p className="mt-2 text-muted-foreground">
            Try a different word or browse all published stories.
          </p>
          <Button variant="outline" asChild className="mt-5">
            <Link href="/blog">Browse all stories</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
