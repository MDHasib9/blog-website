import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  CalendarDays,
  FileText,
  Heart,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import { ModerationControls } from "@/components/admin/moderation-controls";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/server";
import { formatDistanceToNow } from "date-fns";

export const metadata: Metadata = {
  title: "Community moderation",
};

type Report = {
  id: string;
  reporter_id: string;
  post_id: string | null;
  comment_id: string | null;
  reason: string;
  status: "pending" | "resolved" | "dismissed";
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

type ProfileSummary = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type ReportedPost = {
  id: string;
  title: string;
  content: string;
  author_id: string;
  deleted_at: string | null;
};

type ReportedComment = {
  id: string;
  content: string;
  author_id: string;
  post_id: string;
  deleted_at: string | null;
};

function excerpt(content: string, length = 260): string {
  const plainText = content
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return plainText.length > length
    ? `${plainText.slice(0, length).trim()}…`
    : plainText;
}

async function collectDistinctUsers(
  loadPage: (
    from: number,
    to: number,
  ) => Promise<{ userIds: string[]; error: unknown }>,
  activity: string,
): Promise<Set<string>> {
  const userIds = new Set<string>();
  const pageSize = 500;

  for (let offset = 0; ; offset += pageSize) {
    const { userIds: page, error } = await loadPage(
      offset,
      offset + pageSize - 1,
    );

    if (error) {
      console.error(`Error loading recent ${activity} for analytics:`, error);
      throw new Error("Failed to load admin analytics.");
    }

    page.forEach((id) => userIds.add(id));
    if (page.length < pageSize) return userIds;
  }
}

function getSevenDaysAgo(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Error verifying administrator:", authError);
    throw new Error("Could not verify your account.");
  }
  if (!user) redirect("/auth/login?next=%2Fadmin");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_banned, deleted_at")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error checking moderation access:", profileError);
    throw new Error("Could not verify administrator permissions.");
  }
  if (
    !profile ||
    profile.role !== "admin" ||
    profile.is_banned ||
    profile.deleted_at
  ) {
    redirect("/blog");
  }

  const sevenDaysAgo = getSevenDaysAgo();

  const [
    usersResult,
    postsCountResult,
    recentPostsResult,
    commentsCountResult,
    likesCountResult,
    postAuthors,
    commentAuthors,
    reactionUsers,
    recentFollowers,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .gte("created_at", sevenDaysAgo),
    supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("reactions")
      .select("user_id", { count: "exact", head: true })
      .eq("type", "like"),
    collectDistinctUsers(
      async (from, to) => {
        const { data, error } = await supabase
          .from("posts")
          .select("author_id")
          .is("deleted_at", null)
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: true })
          .range(from, to);
        return { userIds: (data || []).map((row) => row.author_id), error };
      },
      "posts",
    ),
    collectDistinctUsers(
      async (from, to) => {
        const { data, error } = await supabase
          .from("comments")
          .select("author_id")
          .is("deleted_at", null)
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: true })
          .range(from, to);
        return { userIds: (data || []).map((row) => row.author_id), error };
      },
      "comments",
    ),
    collectDistinctUsers(
      async (from, to) => {
        const { data, error } = await supabase
          .from("reactions")
          .select("user_id")
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: true })
          .range(from, to);
        return { userIds: (data || []).map((row) => row.user_id), error };
      },
      "reactions",
    ),
    collectDistinctUsers(
      async (from, to) => {
        const { data, error } = await supabase
          .from("follows")
          .select("follower_id")
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: true })
          .range(from, to);
        return { userIds: (data || []).map((row) => row.follower_id), error };
      },
      "follows",
    ),
  ]);

  const analyticsErrors = [
    usersResult.error,
    postsCountResult.error,
    recentPostsResult.error,
    commentsCountResult.error,
    likesCountResult.error,
  ];
  if (analyticsErrors.some(Boolean)) {
    console.error("Error loading admin analytics:", analyticsErrors);
    throw new Error("Failed to load admin analytics.");
  }

  const activeUsers = new Set([
    ...postAuthors,
    ...commentAuthors,
    ...reactionUsers,
    ...recentFollowers,
  ]).size;

  const { data: reportRows, error: reportsError } = await supabase
    .from("reports")
    .select(
      "id, reporter_id, post_id, comment_id, reason, status, admin_note, created_at, reviewed_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (reportsError) {
    console.error("Error loading moderation reports:", reportsError);
    throw new Error("Failed to load moderation reports.");
  }

  const reports = (reportRows || []) as Report[];
  const reporterIds = [...new Set(reports.map((report) => report.reporter_id))];
  const postIds = [
    ...new Set(
      reports.flatMap((report) => (report.post_id ? [report.post_id] : [])),
    ),
  ];
  const commentIds = [
    ...new Set(
      reports.flatMap((report) => (report.comment_id ? [report.comment_id] : [])),
    ),
  ];

  const [profilesResult, postsResult, commentsResult] = await Promise.all([
    reporterIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", reporterIds)
      : Promise.resolve({ data: [], error: null }),
    postIds.length > 0
      ? supabase
          .from("posts")
          .select("id, title, content, author_id, deleted_at")
          .in("id", postIds)
      : Promise.resolve({ data: [], error: null }),
    commentIds.length > 0
      ? supabase
          .from("comments")
          .select("id, content, author_id, post_id, deleted_at")
          .in("id", commentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error || postsResult.error || commentsResult.error) {
    console.error("Error loading moderation report details:", {
      profilesError: profilesResult.error,
      postsError: postsResult.error,
      commentsError: commentsResult.error,
    });
    throw new Error("Failed to load moderation report details.");
  }

  const reporters = (profilesResult.data || []) as ProfileSummary[];
  const posts = (postsResult.data || []) as ReportedPost[];
  const comments = (commentsResult.data || []) as ReportedComment[];
  const reporterById = new Map(reporters.map((item) => [item.id, item]));
  const postById = new Map(posts.map((item) => [item.id, item]));
  const commentById = new Map(comments.map((item) => [item.id, item]));
  const authorIds = [
    ...new Set(
      [
        ...posts.map((post) => post.author_id),
        ...comments.map((comment) => comment.author_id),
      ],
    ),
  ];

  let authors: ProfileSummary[] = [];
  if (authorIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", authorIds);

    if (error) {
      console.error("Error loading reported authors:", error);
      throw new Error("Failed to load reported authors.");
    }
    authors = (data || []) as ProfileSummary[];
  }
  const authorById = new Map(authors.map((item) => [item.id, item]));
  const pendingCount = reports.filter((report) => report.status === "pending").length;

  const analytics = [
    {
      label: "Total users",
      value: usersResult.count || 0,
      description: "Non-deleted accounts",
      icon: Users,
    },
    {
      label: "Total stories",
      value: postsCountResult.count || 0,
      description: "Published stories",
      icon: FileText,
    },
    {
      label: "Stories this week",
      value: recentPostsResult.count || 0,
      description: "Published in the last 7 days",
      icon: CalendarDays,
    },
    {
      label: "Comments",
      value: commentsCountResult.count || 0,
      description: "Visible community comments",
      icon: MessageSquare,
    },
    {
      label: "Likes",
      value: likesCountResult.count || 0,
      description: "Like reactions across stories and comments",
      icon: Heart,
    },
    {
      label: "Active users",
      value: activeUsers,
      description: "Unique users active in the last 7 days",
      icon: Activity,
    },
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      <header className="mb-8 flex flex-wrap items-center gap-4">
        <div className="rounded-xl border bg-card p-3">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Community analytics and moderation tools.
          </p>
        </div>
        <Badge
          variant={pendingCount ? "destructive" : "secondary"}
          className="ml-auto"
        >
          {pendingCount} pending {pendingCount === 1 ? "report" : "reports"}
        </Badge>
      </header>

      <section aria-labelledby="analytics-heading" className="mb-12">
        <div className="mb-4">
          <h2 id="analytics-heading" className="text-xl font-semibold">
            Community analytics
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Current totals and activity over the last seven days.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {analytics.map(({ label, value, description, icon: Icon }) => (
            <Card key={label}>
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {label}
                </CardTitle>
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tracking-tight">
                  {new Intl.NumberFormat().format(value)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="moderation-heading">
        <div className="mb-4">
          <h2 id="moderation-heading" className="text-xl font-semibold">
            Community moderation
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review reports and take action using the report audit trail.
          </p>
        </div>
      {reports.length > 0 ? (
        <div className="space-y-4">
          {reports.map((report) => {
            const reporter = reporterById.get(report.reporter_id);
            const reportedPost = report.post_id
              ? postById.get(report.post_id)
              : undefined;
            const reportedComment = report.comment_id
              ? commentById.get(report.comment_id)
              : undefined;
            const reportedAuthorId =
              reportedPost?.author_id || reportedComment?.author_id;
            const reportedAuthor = reportedAuthorId
              ? authorById.get(reportedAuthorId)
              : undefined;
            const reporterName =
              reporter?.full_name || reporter?.username || "Unknown user";
            const authorName =
              reportedAuthor?.full_name ||
              reportedAuthor?.username ||
              "Unknown author";
            const isPostReport = Boolean(report.post_id) && !report.comment_id;
            const invalidTarget = Boolean(report.post_id) === Boolean(report.comment_id);

            return (
              <article key={report.id} className="rounded-xl border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage
                        src={reporter?.avatar_url || ""}
                        alt={reporterName}
                      />
                      <AvatarFallback>
                        {reporterName[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        Reported by{" "}
                        {reporter?.username ? (
                          <Link
                            href={`/profile/${encodeURIComponent(reporter.username)}`}
                            className="hover:underline"
                          >
                            {reporterName}
                          </Link>
                        ) : (
                          reporterName
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(report.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      report.status === "pending" ? "destructive" : "secondary"
                    }
                  >
                    {report.status}
                  </Badge>
                </div>

                <div className="my-4 rounded-lg border bg-background p-4">
                  {invalidTarget ? (
                    <p className="text-sm text-destructive">
                      This report has no unique post/comment target. Review the
                      database record before taking action.
                    </p>
                  ) : isPostReport ? (
                    reportedPost ? (
                      <>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Reported story by {authorName}
                        </p>
                        <h2 className="mt-1 font-semibold">
                          <Link
                            href={`/blog/${reportedPost.id}`}
                            className="hover:underline"
                          >
                            {reportedPost.title}
                          </Link>
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {excerpt(reportedPost.content)}
                        </p>
                        {reportedPost.deleted_at && (
                          <p className="mt-2 text-xs text-destructive">
                            This story has already been removed.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        The reported story is no longer available.
                      </p>
                    )
                  ) : reportedComment ? (
                    <>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Reported comment by {authorName}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm">
                        {excerpt(reportedComment.content)}
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-2 h-auto p-0"
                        asChild
                      >
                        <Link href={`/blog/${reportedComment.post_id}#comments`}>
                          View conversation
                        </Link>
                      </Button>
                      {reportedComment.deleted_at && (
                        <p className="mt-2 text-xs text-destructive">
                          This comment has already been removed.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      The reported comment is no longer available.
                    </p>
                  )}
                </div>

                <p className="text-sm">
                  <span className="font-semibold">Reason:</span> {report.reason}
                </p>
                {report.admin_note && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Moderator note:</span>{" "}
                    {report.admin_note}
                  </p>
                )}
                {report.reviewed_at && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reviewed{" "}
                    {formatDistanceToNow(new Date(report.reviewed_at), {
                      addSuffix: true,
                    })}
                  </p>
                )}

                <div className="mt-4 border-t pt-4">
                  {invalidTarget && report.status === "pending" ? (
                    <p className="text-sm text-muted-foreground">
                      This malformed report cannot be actioned from the dashboard.
                    </p>
                  ) : (
                    <ModerationControls
                      reportId={report.id}
                      pending={report.status === "pending"}
                    />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center">
          <h3 className="text-xl font-semibold">No reports to review</h3>
          <p className="mt-2 text-muted-foreground">
            New community reports will appear here.
          </p>
        </div>
      )}
      </section>
    </div>
  );
}
