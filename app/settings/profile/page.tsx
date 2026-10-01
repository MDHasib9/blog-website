import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, UserRoundPen } from "lucide-react";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { createClient } from "@/lib/server";

export const metadata: Metadata = {
  title: "Edit profile",
};

export default async function EditProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && authError.name !== "AuthSessionMissingError") {
    console.error("Error verifying profile editor:", authError);
    throw new Error("Could not verify your account.");
  }
  if (!user) redirect("/auth/login?next=%2Fsettings%2Fprofile");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, bio, is_banned, deleted_at")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error loading profile editor:", profileError);
    throw new Error("Could not load your profile.");
  }
  if (!profile || profile.is_banned || profile.deleted_at || !profile.username) {
    redirect("/blog");
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <Link
        href={`/profile/${encodeURIComponent(profile.username)}`}
        className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to profile
      </Link>

      <header className="mb-8 flex items-center gap-4">
        <div className="rounded-xl border bg-card p-3">
          <UserRoundPen className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update how your name, photo, and bio appear to readers.
          </p>
        </div>
      </header>

      <ProfileEditor
        userId={profile.id}
        username={profile.username}
        fullName={profile.full_name}
        bio={profile.bio}
        avatarUrl={profile.avatar_url}
      />
    </div>
  );
}
