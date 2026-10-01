import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { FollowButton } from "@/components/profile/follow-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/server";

export const metadata: Metadata = {
  title: "Authors you follow",
};

type FollowedProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export default async function FollowingPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Error verifying followed authors viewer:", authError);
    throw new Error("Could not verify your account.");
  }
  if (!user) redirect("/auth/login?next=%2Ffollowing");

  const { data: followRows, error: followsError } = await supabase
    .from("follows")
    .select("following_id, created_at")
    .eq("follower_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (followsError) {
    console.error("Error loading followed authors:", followsError);
    throw new Error("Failed to load followed authors.");
  }

  const followedIds = (followRows || []).map((follow) => follow.following_id);
  let profiles: FollowedProfile[] = [];

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
      ((data || []) as FollowedProfile[]).map((profile) => [
        profile.id,
        profile,
      ]),
    );
    profiles = followedIds.flatMap((id) => {
      const profile = profileById.get(id);
      return profile && profile.username ? [profile] : [];
    });
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <header className="mb-8 flex items-center gap-4">
        <div className="rounded-xl border bg-card p-3">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Authors you follow</h1>
          <p className="mt-1 text-muted-foreground">
            Keep up with the voices you enjoy reading.
          </p>
        </div>
      </header>

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
                    <AvatarFallback>{name[0]?.toUpperCase() || "A"}</AvatarFallback>
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
          <h2 className="text-xl font-semibold">You&apos;re not following anyone yet</h2>
          <p className="mt-2 text-muted-foreground">
            Visit an author&apos;s profile and follow them to stay connected.
          </p>
          <Button className="mt-5" asChild>
            <Link href="/blog">Discover authors</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
