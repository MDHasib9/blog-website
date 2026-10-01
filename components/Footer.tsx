import Link from "next/link";
import { createClient } from "@/lib/server";

export default async function Footer() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && authError.name !== "AuthSessionMissingError") {
    console.error("Error verifying footer visitor:", authError);
    throw new Error("Could not verify your account.");
  }

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto grid gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-3">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <span className="rounded-md bg-primary px-2 py-1 text-sm text-primary-foreground">
              B
            </span>
            <span>Blogify</span>
          </Link>
          <p className="max-w-xs text-sm text-muted-foreground">
            A home for thoughtful stories, independent voices, and curious
            readers.
          </p>
        </div>

        <nav aria-label="Footer navigation">
          <h2 className="mb-3 font-semibold">Explore</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="transition hover:text-foreground">
                Home
              </Link>
            </li>
            <li>
              <Link href="/blog" className="transition hover:text-foreground">
                Stories
              </Link>
            </li>
            <li>
              <Link
                href="/search"
                className="transition hover:text-foreground"
              >
                Search
              </Link>
            </li>
            <li>
              <Link
                href="/following"
                className="transition hover:text-foreground"
              >
                Authors you follow
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Account navigation">
          <h2 className="mb-3 font-semibold">
            {user ? "Your account" : "Join the community"}
          </h2>
          {user ? (
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/settings/profile" className="transition hover:text-foreground">
                  Edit profile
                </Link>
              </li>
              <li>
                <Link href="/write" className="transition hover:text-foreground">
                  Write a story
                </Link>
              </li>
              <li>
                <Link href="/bookmarks" className="transition hover:text-foreground">
                  Saved stories
                </Link>
              </li>
              <li>
                <Link href="/notifications" className="transition hover:text-foreground">
                  Notifications
                </Link>
              </li>
              <li>
                <Link href="/following" className="transition hover:text-foreground">
                  Authors you follow
                </Link>
              </li>
            </ul>
          ) : (
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/blog" className="transition hover:text-foreground">
                  Explore stories
                </Link>
              </li>
              <li>
                <Link href="/auth/login" className="transition hover:text-foreground">
                  Sign in
                </Link>
              </li>
              <li>
                <Link href="/auth/sign-up" className="transition hover:text-foreground">
                  Sign up
                </Link>
              </li>
            </ul>
          )}
        </nav>
      </div>
      <div className="border-t px-4 py-5 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Blogify. Stories worth reading.
      </div>
    </footer>
  );
}
