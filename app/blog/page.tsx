import Link from "next/link";
import { Search, PenSquare } from "lucide-react";
import { PostCard } from "@/components/posts/post-card";
import { Button } from "@/components/ui/button";
import { getPostCategories, getPostFeed } from "@/lib/posts";

export const metadata = {
  title: "Explore stories",
  description: "Discover the latest stories from our community.",
};

type Props = {
  searchParams: Promise<{
    q?: string | string[];
    category?: string | string[];
    page?: string | string[];
  }>;
};

export default async function BlogPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const category = typeof params.category === "string" ? params.category : "";
  const pageValue = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const pageSize = 9;
  const [{ posts, total }, categories] = await Promise.all([
    getPostFeed({ search: query, category, page, pageSize }),
    getPostCategories(),
  ]);
  const totalPages = Math.ceil(total / pageSize);

  const pageHref = (targetPage: number) => {
    const nextParams = new URLSearchParams();
    if (query) nextParams.set("q", query);
    if (category) nextParams.set("category", category);
    nextParams.set("page", String(targetPage));
    return `/blog?${nextParams.toString()}`;
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Explore stories
          </h1>
          <p className="mt-2 text-muted-foreground">
            Discover ideas, experiences, and perspectives from our community.
          </p>
        </div>
        <Button asChild>
          <Link href="/write">
            <PenSquare className="mr-2 h-4 w-4" />
            Write a story
          </Link>
        </Button>
      </div>

      <form
        action="/blog"
        className="mb-8 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_14rem_auto]"
      >
        <label className="sr-only" htmlFor="blog-search">
          Search stories
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="blog-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search stories and ideas"
            className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <label className="sr-only" htmlFor="blog-category">
          Filter by category
        </label>
        <select
          id="blog-category"
          name="category"
          defaultValue={category}
          className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All topics</option>
          {categories.map((item) => (
            <option key={item.id} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
        <Button type="submit">Search</Button>
      </form>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-24 text-center">
          <h2 className="text-xl font-semibold">
            {query || category ? "No matching stories" : "No stories yet"}
          </h2>
          <p className="mt-2 max-w-sm text-muted-foreground">
            {query || category
              ? "Try another search or choose a different topic."
              : "Be the first to share something with the community."}
          </p>
          {query || category ? (
            <Button variant="outline" asChild className="mt-6">
              <Link href="/blog">Clear filters</Link>
            </Button>
          ) : (
            <Button asChild className="mt-6">
              <Link href="/write">Create your first story</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Post pages"
          className="mt-10 flex items-center justify-center gap-3"
        >
          {page > 1 ? (
            <Button variant="outline" asChild>
              <Link href={pageHref(page - 1)}>Previous</Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Previous
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Button variant="outline" asChild>
              <Link href={pageHref(page + 1)}>Next</Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Next
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}