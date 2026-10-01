import { createClient } from "@/lib/server";
import { redirect } from "next/navigation";
import { WriteForm } from "@/components/posts/write-form";

export const metadata = {
  title: "Write a story",
};

export default async function WritePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=%2Fwrite");
  }

  // Check banned
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_banned, deleted_at")
    .eq("id", user.id)
    .single();

  if (!profile || profile.is_banned || profile.deleted_at) {
    redirect("/blog");
  }

  // Fetch categories
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Write a new story</h1>
        <p className="mt-2 text-muted-foreground">
          Share your ideas with the community
        </p>
      </div>

      <WriteForm categories={categories || []} />
    </div>
  );
}