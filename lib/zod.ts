import { z } from "zod";

// 1. Route Params Schema (Validates post ID format)
export const postIdParamSchema = z.object({
  id: z.string().uuid({ message: "Invalid post ID format" }),
});

// 2. Post Create/Edit Schema
export const postSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(150, "Title must be less than 150 characters")
    .trim(),
  content: z
    .string()
    .min(10, "Content must be at least 10 characters")
    .trim(),
  category_id: z.string().uuid("Invalid category ID").nullable().optional(),
  cover_image_url: z
    .string()
    .url("Must be a valid URL")
    .or(z.literal(""))
    .nullable()
    .optional(),
  tag_ids: z.array(z.string().uuid()).optional().default([]),
});

// 3. Post Reaction Schema
export const reactionSchema = z.object({
  postId: z.string().uuid("Invalid post ID"),
  type: z.enum(["like", "love", "care", "haha", "wow", "sad", "angry"], {
    message: "Invalid reaction type",
  }),
});

// 4. Comment Schema
export const commentSchema = z.object({
  postId: z.string().uuid("Invalid post ID"),
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(1000, "Comment cannot exceed 1000 characters")
    .trim(),
});

// Infer Types
export type PostIdParam = z.infer<typeof postIdParamSchema>;
export type PostInput = z.infer<typeof postSchema>;
export type ReactionInput = z.infer<typeof reactionSchema>;
export type CommentInput = z.infer<typeof commentSchema>;






// 5. Blog Feed Query Params Schema (for search, filter & pagination)
export const postsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(24),
  category: z.string().optional(),
  search: z.string().optional(),
});

export type PostsQueryInput = z.infer<typeof postsQuerySchema>;