import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { FollowButton } from "@/components/profile/follow-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/server";
import { getPostFeed } from "@/lib/posts";
import { PostCard } from "@/components/posts/post-card";
import type { FollowProfile, FollowRow } from "@/types/follow";

export const metadata: Metadata = {
  title: "Authors you follow",
};

export default async function FollowingPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && authError.name !== "AuthSessionMissingError") {
    console.error("Error verifying followed authors viewer:", authError);
    throw new Error("Could not verify your account.");
  }
  if (!user) redirect("/auth/login?next=%2Ffollowing");

  const {
    data: followRows,
    count: followingCount,
    error: followsError,
  } = await supabase
    .from("follows")
    .select("following_id, created_at", { count: "exact" })
    .eq("follower_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (followsError) {
    console.error("Error loading followed authors:", followsError);
    throw new Error("Failed to load followed authors.");
  }

  const follows = (followRows || []) as FollowRow[];
  const followedIds = follows.map((follow) => follow.following_id);
  let profiles: FollowProfile[] = [];
  let posts: Awaited<ReturnType<typeof getPostFeed>>["posts"] = [];

  if (followedIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, bio")
      .in("id", followedIds);

    if (error) {
      console.error("Error loading followed profiles:", error);
      throw new Error("Failed to load followed authors.");
    }

    const profileById = new Map(
      ((data || []) as FollowProfile[]).map((profile) => [profile.id, profile]),
    );
    profiles = followedIds.flatMap((id) => {
      const profile = profileById.get(id);
      return profile && profile.username ? [profile] : [];
    });

    ({ posts } = await getPostFeed({ authorIds: followedIds, pageSize: 24 }));
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <header className="mb-8 flex items-center gap-4">
        <div className="rounded-xl border bg-card p-3">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your following</h1>
          <p className="mt-1 text-muted-foreground">
            You follow {followingCount ?? 0}{" "}
            {followingCount === 1 ? "author" : "authors"}. Keep up with their
            latest stories.
          </p>
        </div>
      </header>

      <section aria-labelledby="following-authors-heading" className="mb-12">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="following-authors-heading" className="text-xl font-semibold">
            Following
          </h2>
          <span className="text-sm text-muted-foreground">
            {followingCount ?? 0}{" "}
            {followingCount === 1 ? "author" : "authors"}
          </span>
        </div>
        {profiles.length > 0 ? (
          <ul className="space-y-3">
            {profiles.map((profile) => {
              if (!profile.username) return null;

              const username = profile.username;
              const name = profile.full_name || `@${profile.username}`;
              return (
                <li
                  key={profile.id}
                  className="flex items-center gap-4 rounded-xl border bg-card p-4"
                >
                  <Link href={`/profile/${encodeURIComponent(username)}`}>
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={profile.avatar_url || ""} alt={name} />
                      <AvatarFallback>
                        {name[0]?.toUpperCase() || "A"}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/profile/${encodeURIComponent(username)}`}
                      className="font-semibold hover:underline"
                    >
                      {name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      @{profile.username}
                    </p>
                    {profile.bio && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {profile.bio}
                      </p>
                    )}
                  </div>
                  <FollowButton userId={profile.id} initiallyFollowing />
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed px-6 py-16 text-center">
            <h3 className="text-xl font-semibold">
              {followingCount
                ? "No followed authors are available"
                : "You're not following anyone yet"}
            </h3>
            <p className="mt-2 text-muted-foreground">
              {followingCount
                ? "The authors you followed may have removed their profiles."
                : "Visit an author's profile and follow them to stay connected."}
            </p>
            {!followingCount && (
              <Button className="mt-5" asChild>
                <Link href="/blog">Discover authors</Link>
              </Button>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="followed-stories-heading">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Fresh from your authors
            </p>
            <h2
              id="followed-stories-heading"
              className="mt-1 text-2xl font-semibold"
            >
              Latest stories
            </h2>
          </div>
        </div>
        {posts.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center">
            <h3 className="font-semibold">
              {(followingCount ?? 0) > 0
                ? "No stories from followed authors yet"
                : "Follow authors to build your feed"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {(followingCount ?? 0) > 0
                ? "Stories from authors you follow will appear here."
                : "Follow authors to see their stories here."}
            </p>
            {(followingCount ?? 0) === 0 && (
              <Button className="mt-5" asChild>
                <Link href="/blog">Discover authors</Link>
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
