import { createClient } from "@/lib/server";

export type PostCardAuthor = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  isFollowing: boolean;
};

type RawPostAuthor = Omit<PostCardAuthor, "isFollowing">;

export type PostCardCategory = {
  name: string;
  slug: string;
};

export type PostCardTag = {
  name: string;
  slug: string;
};

export type PostCardItem = {
  id: string;
  title: string;
  content: string;
  cover_image_url: string | null;
  created_at: string;
  author: PostCardAuthor;
  viewerId: string | null;
  category: PostCardCategory | null;
  tags: PostCardTag[];
  reaction_count: number;
  comment_count: number;
};

export type PostCategory = {
  id: string;
  name: string;
  slug: string;
};

type RawCount = { count: number };
type RawPostTag = { tag: PostCardTag | PostCardTag[] | null };

type RawPost = {
  id: string;
  title: string;
  content: string;
  cover_image_url: string | null;
  created_at: string;
  author: RawPostAuthor | RawPostAuthor[] | null;
  category: PostCardCategory | PostCardCategory[] | null;
  post_tags: RawPostTag[] | null;
  reactions: RawCount[] | null;
  comments: RawCount[] | null;
};

type PostFeedOptions = {
  search?: string;
  category?: string;
  authorId?: string;
  authorIds?: string[];
  postIds?: string[];
  page?: number;
  pageSize?: number;
};

export async function getPostFeed({
  search,
  category,
  authorId,
  authorIds,
  postIds,
  page = 1,
  pageSize = 24,
}: PostFeedOptions = {}): Promise<{ posts: PostCardItem[]; total: number }> {
  if (authorIds && authorIds.length === 0) return { posts: [], total: 0 };
  if (postIds && postIds.length === 0) return { posts: [], total: 0 };

  const supabase = await createClient();

  let query = supabase
    .from("posts")
    .select(
      `
      id,
      title,
      content,
      cover_image_url,
      created_at,
      author:profiles!author_id (
        id,
        username,
        full_name,
        avatar_url
      ),
      category:categories (
        name,
        slug
      ),
      post_tags (
        tag:tags (
          name,
          slug
        )
      ),
      reactions (count),
      comments (count)
    `,
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (authorId) {
    query = query.eq("author_id", authorId);
  }

  if (authorIds) {
    query = query.in("author_id", authorIds);
  }

  if (postIds) {
    query = query.in("id", postIds);
  }

  if (category) {
    const { data: categoryRow, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", category)
      .maybeSingle();

    if (categoryError) {
      console.error("Error loading post category:", categoryError);
      throw new Error("Failed to load posts");
    }

    if (!categoryRow) return { posts: [], total: 0 };
    query = query.eq("category_id", categoryRow.id);
  }

  const safeSearch = search
    ?.trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);

  if (safeSearch) {
    const slugSearch = safeSearch.replace(/\s+/g, "-");
    const { data: matchingTags, error: tagSearchError } = await supabase
      .from("tags")
      .select("id")
      .or(`name.ilike.%${safeSearch}%,slug.ilike.%${slugSearch}%`)
      .limit(100);

    if (tagSearchError) {
      console.error("Error searching post tags:", tagSearchError);
      throw new Error("Failed to search posts");
    }

    const tagIds = (matchingTags || []).map((tag) => tag.id);
    const tagPostIds: string[] = [];

    if (tagIds.length > 0) {
      const { data: postTagRows, error: postTagError } = await supabase
        .from("post_tags")
        .select("post_id")
        .in("tag_id", tagIds)
        .limit(5000);

      if (postTagError) {
        console.error("Error searching tagged posts:", postTagError);
        throw new Error("Failed to search posts");
      }

      tagPostIds.push(
        ...new Set((postTagRows || []).map((row) => row.post_id)),
      );
    }

    const filters = [
      `title.ilike.%${safeSearch}%`,
      `content.ilike.%${safeSearch}%`,
    ];
    if (tagPostIds.length > 0) {
      filters.push(`id.in.(${tagPostIds.join(",")})`);
    }
    query = query.or(filters.join(","));
  }

  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range((safePage - 1) * safePageSize, safePage * safePageSize - 1);

  if (error) {
    console.error("Error fetching posts:", error);
    throw new Error("Failed to load posts");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && authError.name !== "AuthSessionMissingError") {
    console.error("Error verifying post feed viewer:", authError);
    throw new Error("Could not verify your account.");
  }

  const rawPosts = (data || []) as unknown as RawPost[];
  const postAuthorIds = [
    ...new Set(
      rawPosts.flatMap((post) => {
        const author = Array.isArray(post.author) ? post.author[0] : post.author;
        return author?.id ? [author.id] : [];
      }),
    ),
  ];
  let followedAuthorIds = new Set<string>();

  if (user && postAuthorIds.length > 0) {
    const { data: follows, error: followsError } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .in("following_id", postAuthorIds);

    if (followsError) {
      console.error("Error loading post feed follow status:", followsError);
      throw new Error("Failed to load post follows.");
    }

    followedAuthorIds = new Set(
      (follows || []).map((follow) => follow.following_id),
    );
  }

  const posts = rawPosts.map(
    (post): PostCardItem => {
      const author = Array.isArray(post.author)
        ? post.author[0]
        : post.author;
      const category = Array.isArray(post.category)
        ? post.category[0]
        : post.category;
      const tags = (post.post_tags || []).flatMap((relation) => {
        if (!relation.tag) return [];
        return Array.isArray(relation.tag) ? relation.tag : [relation.tag];
      });

      return {
        id: post.id,
        title: post.title,
        content: post.content,
        cover_image_url: post.cover_image_url,
        created_at: post.created_at,
        author: author
          ? {
              ...author,
              isFollowing: followedAuthorIds.has(author.id),
            }
          : {
              id: "",
              username: null,
              full_name: "Anonymous",
              avatar_url: null,
              isFollowing: false,
            },
        viewerId: user?.id ?? null,
        category: category ?? null,
        tags,
        reaction_count: post.reactions?.[0]?.count ?? 0,
        comment_count: post.comments?.[0]?.count ?? 0,
      };
    },
  );

  if (postIds) {
    const order = new Map(postIds.map((id, index) => [id, index]));
    posts.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  return { posts, total: count ?? 0 };
}

export async function getPostCategories(): Promise<PostCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("name");

  if (error) {
    console.error("Error fetching post categories:", error);
    throw new Error("Failed to load categories");
  }

  return data ?? [];
}
