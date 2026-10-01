export type CommentAuthor = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export type Comment = {
  id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  author: CommentAuthor;
  replies?: Comment[];
};

export type CommentRow = Omit<Comment, "author"> & {
  author: CommentAuthor | CommentAuthor[] | null;
};

export function normalizeComment(row: CommentRow): Comment | null {
  const author = Array.isArray(row.author) ? row.author[0] : row.author;
  return author ? { ...row, author } : null;
}