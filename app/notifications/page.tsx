import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Bell, Heart, MessageCircle, UserPlus, Flag } from "lucide-react";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { MarkReadButton } from "@/components/notifications/mark-read-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/server";
import { formatDistanceToNow } from "date-fns";

export const metadata: Metadata = {
  title: "Notifications",
};

type Notification = {
  id: string;
  actor_id: string | null;
  type:
    | "reaction_post"
    | "reaction_comment"
    | "comment"
    | "reply"
    | "follow"
    | "report";
  post_id: string | null;
  comment_id: string | null;
  is_read: boolean;
  created_at: string;
};

type Actor = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

const notificationCopy: Record<Notification["type"], string> = {
  reaction_post: "reacted to your story",
  reaction_comment: "reacted to your comment",
  comment: "commented on your story",
  reply: "replied to a comment",
  follow: "started following you",
  report: "A community report needs review",
};

const notificationIcons: Record<Notification["type"], typeof Bell> = {
  reaction_post: Heart,
  reaction_comment: Heart,
  comment: MessageCircle,
  reply: MessageCircle,
  follow: UserPlus,
  report: Flag,
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Error verifying notification viewer:", authError);
    throw new Error("Could not verify your account.");
  }
  if (!user) redirect("/auth/login?next=%2Fnotifications");

  const { data, error } = await supabase
    .from("notifications")
    .select("id, actor_id, type, post_id, comment_id, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error loading notifications:", error);
    throw new Error("Failed to load notifications.");
  }

  const notifications = (data || []) as Notification[];
  const actorIds = [
    ...new Set(
      notifications.flatMap((notification) =>
        notification.actor_id ? [notification.actor_id] : [],
      ),
    ),
  ];

  let actors: Actor[] = [];
  if (actorIds.length > 0) {
    const { data: actorRows, error: actorError } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", actorIds);

    if (actorError) {
      console.error("Error loading notification authors:", actorError);
      throw new Error("Failed to load notifications.");
    }
    actors = actorRows || [];
  }

  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border bg-card p-3">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} unread ${unreadCount === 1 ? "notification" : "notifications"}`
                : "You are all caught up."}
            </p>
          </div>
        </div>
        {unreadCount > 0 && <MarkAllReadButton />}
      </header>

      {notifications.length > 0 ? (
        <ul className="divide-y rounded-xl border bg-card">
          {notifications.map((notification) => {
            const actor = notification.actor_id
              ? actorById.get(notification.actor_id)
              : undefined;
            const actorName =
              actor?.full_name || actor?.username || "A community member";
            const Icon = notificationIcons[notification.type];
            const profileHref = actor?.username
              ? `/profile/${encodeURIComponent(actor.username)}`
              : null;
            const storyHref = notification.post_id
              ? `/blog/${notification.post_id}${notification.comment_id ? "#comments" : ""}`
              : null;
            const href =
              notification.type === "report"
                ? "/admin"
                : notification.type === "follow"
                  ? profileHref
                  : storyHref || profileHref;

            return (
              <li
                key={notification.id}
                className={`flex items-start gap-4 p-4 sm:p-5 ${
                  notification.is_read ? "" : "bg-primary/[0.035]"
                }`}
              >
                <Avatar className="mt-1 h-10 w-10 shrink-0">
                  <AvatarImage
                    src={actor?.avatar_url || ""}
                    alt={actorName}
                  />
                  <AvatarFallback>
                    {actorName[0]?.toUpperCase() || "B"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="text-sm">
                      {notification.type === "report" ? (
                        notificationCopy.report
                      ) : (
                        <>
                          {actor && profileHref ? (
                            <Link
                              href={profileHref}
                              className="font-medium hover:underline"
                            >
                              {actorName}
                            </Link>
                          ) : (
                            <span className="font-medium">{actorName}</span>
                          )}{" "}
                          {notification.type === "reply"
                            ? "replied to your comment"
                            : notificationCopy[notification.type]}
                        </>
                      )}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                  {href && (
                    <Button variant="link" size="sm" className="mt-1 h-auto p-0" asChild>
                      <Link href={href}>
                        {notification.type === "follow"
                          ? "View profile"
                          : notification.type === "report"
                            ? "Review report"
                            : "View story"}
                      </Link>
                    </Button>
                  )}
                </div>
                {!notification.is_read && (
                  <MarkReadButton notificationId={notification.id} />
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center">
          <h2 className="text-xl font-semibold">No notifications yet</h2>
          <p className="mt-2 text-muted-foreground">
            Follows, story activity, and moderation updates will show up here.
          </p>
        </div>
      )}
    </div>
  );
}
