"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  Menu,
  Search,
  PenSquare,
  LogOut,
  User,
  Bookmark,
  Bell,
  ShieldCheck,
  Users,
  UserRoundPen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ModeToggle } from "./theme/mode-toggle";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
};

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [supabase] = useState(createClient);

  useEffect(() => {
    let isMounted = true;

    const fetchUserData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!isMounted) return;
        setUser(user);

        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url, role")
            .eq("id", user.id)
            .single();

          if (isMounted) {
            setProfile(data);
          }

          const { count, error: notificationError } = await supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("is_read", false);

          if (notificationError) {
            console.error("Error loading unread notification count:", notificationError);
          } else if (isMounted) {
            setUnreadCount(count ?? 0);
          }
        } else {
          setProfile(null);
          setUnreadCount(0);
        }
      } catch (error) {
        console.error("Error fetching user/profile:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchUserData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
        setUnreadCount(0);
        setLoading(false);
      } else {
        fetchUserData();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const userId = user?.id;
    if (
      !userId ||
      (!pathname.startsWith("/profile/") && pathname !== "/settings/profile")
    ) {
      return;
    }

    let isMounted = true;
    const refreshProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, role")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error refreshing navigation profile:", error);
      } else if (isMounted) {
        setProfile(data);
      }
    };

    void refreshProfile();
    return () => {
      isMounted = false;
    };
  }, [pathname, supabase, user?.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    router.push("/");
    router.refresh();
  };

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/blog", label: "Blog" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <span className="bg-primary text-primary-foreground px-2 py-1 rounded-md text-sm">
            B
          </span>
          <span>Blogify</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                pathname === link.href
                  ? "text-primary"
                  : "text-muted-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <Button variant="ghost" size="icon" asChild>
            <Link href="/search" aria-label="Search stories" title="Search stories">
              <Search className="h-5 w-5" />
            </Link>
          </Button>

          {/* Write button (logged in) */}
          {user && (
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="hidden sm:flex"
            >
              <Link href="/write" aria-label="Write a story" title="Write a story">
                <PenSquare className="h-5 w-5" />
              </Link>
            </Button>
          )}

          {/* Auth section */}
          {loading ? (
            <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full"
                  aria-label="Open account menu"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={profile?.avatar_url || ""} />
                    <AvatarFallback>
                      {profile?.full_name?.[0]?.toUpperCase() ||
                        profile?.username?.[0]?.toUpperCase() ||
                        "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {profile?.full_name || profile?.username || "User"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {profile?.username ? `@${profile.username}` : ""}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {profile?.username && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href={`/profile/${encodeURIComponent(profile.username)}`}>
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings/profile">
                        <UserRoundPen className="mr-2 h-4 w-4" />
                        Edit profile
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/bookmarks">
                    <Bookmark className="mr-2 h-4 w-4" />
                    Saved stories
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/notifications">
                    <Bell className="mr-2 h-4 w-4" />
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/following">
                    <Users className="mr-2 h-4 w-4" />
                    Following
                  </Link>
                </DropdownMenuItem>
                {profile?.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Moderation
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Button variant="ghost" asChild>
                <Link href="/auth/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/auth/sign-up">Sign up</Link>
              </Button>
            </div>
          )}

          <ModeToggle />
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="flex flex-col gap-4 mt-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="text-lg font-medium"
                  >
                    {link.label}
                  </Link>
                ))}

                {user ? (
                  <>
                    <Link
                      href="/write"
                      onClick={() => setMobileOpen(false)}
                      className="text-lg font-medium"
                    >
                      Write
                    </Link>
                    {profile?.username && (
                      <>
                        <Link
                          href={`/profile/${encodeURIComponent(profile.username)}`}
                          onClick={() => setMobileOpen(false)}
                          className="text-lg font-medium"
                        >
                          My profile
                        </Link>
                        <Link
                          href="/settings/profile"
                          onClick={() => setMobileOpen(false)}
                          className="text-lg font-medium"
                        >
                          Edit profile
                        </Link>
                      </>
                    )}
                    <Link
                      href="/bookmarks"
                      onClick={() => setMobileOpen(false)}
                      className="text-lg font-medium"
                    >
                      Saved stories
                    </Link>
                    <Link
                      href="/notifications"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 text-lg font-medium"
                    >
                      Notifications
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </Link>
                    <Link
                      href="/following"
                      onClick={() => setMobileOpen(false)}
                      className="text-lg font-medium"
                    >
                      Following
                    </Link>
                    {profile?.role === "admin" && (
                      <Link
                        href="/admin"
                        onClick={() => setMobileOpen(false)}
                        className="text-lg font-medium"
                      >
                        Moderation
                      </Link>
                    )}
                    <Button
                      variant="destructive"
                      onClick={() => {
                        handleLogout();
                        setMobileOpen(false);
                      }}
                    >
                      Sign out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild variant="outline">
                      <Link
                        href="/auth/login"
                        onClick={() => setMobileOpen(false)}
                      >
                        Sign in
                      </Link>
                    </Button>
                    <Button asChild>
                      <Link
                        href="/auth/sign-up"
                        onClick={() => setMobileOpen(false)}
                      >
                        Sign up
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
