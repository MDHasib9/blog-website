import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PostCard } from "@/components/posts/post-card";
import { createClient } from "@/lib/server";
import { getPostFeed } from "@/lib/posts";
import { FollowButton } from "@/components/profile/follow-button";
import Link from "next/link";

type Props = {
  params: Promise<{ username: string }>;
};

type Profile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  deleted_at: string | null;
};

async function getProfile(username: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, bio, deleted_at")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    console.error("Error fetching profile:", error);
    throw new Error("Failed to load profile");
  }

  if (!data || data.deleted_at || !data.username) return null;
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);

  if (!profile) {
    return { title: "Author not found" };
  }

  const displayName = profile.full_name || `@${profile.username}`;
  return {
    title: displayName,
    description:
      profile.bio?.slice(0, 160) || `Read stories by ${displayName} on Blogify.`,
  };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const profile = await getProfile(username);

  if (!profile) notFound();

  const { posts, total } = await getPostFeed({
    authorId: profile.id,
    pageSize: 24,
  });
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Error verifying profile viewer:", authError);
    throw new Error("Could not verify your account.");
  }

  const [
    { count: followerCount, error: followerError },
    { count: followingCount, error: followingError },
  ] = await Promise.all([
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", profile.id),
    supabase
      .from("follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", profile.id),
  ]);

  if (followerError || followingError) {
    console.error("Error loading profile follow counts:", {
      followerError,
      followingError,
    });
    throw new Error("Failed to load profile.");
  }

  let isFollowing = false;
  if (user && user.id !== profile.id) {
    const { data: follow, error: followError } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", profile.id)
      .maybeSingle();

    if (followError) {
      console.error("Error checking profile follow:", followError);
      throw new Error("Failed to load profile.");
    }
    isFollowing = Boolean(follow);
  }

  const displayName = profile.full_name || `@${profile.username}`;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      <header className="mb-12 flex flex-col items-center gap-5 rounded-2xl border bg-card px-6 py-10 text-center sm:flex-row sm:text-left">
        <Avatar className="h-24 w-24">
          <AvatarImage src={profile.avatar_url || ""} alt={displayName} />
          <AvatarFallback className="text-2xl">
            {displayName[0]?.toUpperCase() || "A"}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {displayName}
          </h1>
          {profile.bio && (
            <p className="mt-3 max-w-2xl whitespace-pre-wrap text-muted-foreground">
              {profile.bio}
            </p>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            {total} {total === 1 ? "story" : "stories"} published
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {followerCount ?? 0} followers · {followingCount ?? 0} following
          </p>
          {user?.id === profile.id ? (
            <p className="mt-4 text-sm text-muted-foreground">
              This is your public profile.
            </p>
          ) : user ? (
            <div className="mt-4">
              <FollowButton
                userId={profile.id}
                initiallyFollowing={isFollowing}
              />
            </div>
          ) : (
            <Link
                href={`/auth/login?next=${encodeURIComponent(`/profile/${profile.username}`)}`}
                className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Sign in to follow
            </Link>
          )}
        </div>
      </header>

      <section aria-labelledby="author-stories">
        <h2 id="author-stories" className="mb-6 text-2xl font-semibold">
          Stories by {profile.full_name || profile.username}
        </h2>
        {posts.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
            This author has not published any stories yet.
          </p>
        )}
      </section>
    </div>
  );
}
