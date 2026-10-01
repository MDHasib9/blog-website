import Link from "next/link";
import { ArrowRight, PenSquare, Sparkles } from "lucide-react";
import { PostCard } from "@/components/posts/post-card";
import { Button } from "@/components/ui/button";
import { getPostCategories, getPostFeed } from "@/lib/posts";

export default async function HomePage() {
  const [{ posts }, categories] = await Promise.all([
    getPostFeed({ pageSize: 3 }),
    getPostCategories(),
  ]);

  return (
    <div className="container mx-auto px-4">
      <section className="relative isolate my-8 overflow-hidden rounded-3xl border bg-card px-6 py-16 sm:my-12 sm:px-12 sm:py-20 lg:px-16">
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-32 -z-10 h-96 w-96 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            A community for curious minds
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Ideas worth sharing.
            <span className="block text-muted-foreground">
              Stories worth reading.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Discover thoughtful writing from independent voices, or publish
            something the world needs to hear.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/blog">
                Explore stories <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/write">
                <PenSquare className="mr-2 h-4 w-4" />
                Write a story
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section aria-labelledby="topics-heading" className="py-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Find your next read
              </p>
              <h2 id="topics-heading" className="mt-1 text-2xl font-semibold">
                Explore topics
              </h2>
            </div>
            <Link
              href="/blog"
              className="hidden items-center gap-1 text-sm font-medium hover:underline sm:flex"
            >
              All stories <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/blog?category=${encodeURIComponent(category.slug)}`}
                className="rounded-full border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="latest-heading" className="py-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Fresh from the community
            </p>
            <h2 id="latest-heading" className="mt-1 text-2xl font-semibold">
              Latest stories
            </h2>
          </div>
          <Button variant="ghost" asChild>
            <Link href="/blog">
              Browse all <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {posts.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed px-6 py-16 text-center">
            <h3 className="text-xl font-semibold">The first story is yours</h3>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              There are no published stories yet. Start the conversation by
              sharing an idea with the community.
            </p>
            <Button className="mt-6" asChild>
              <Link href="/write">Write the first story</Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
