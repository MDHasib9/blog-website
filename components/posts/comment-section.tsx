"use client";

type Props = {
  postId: string;
  currentUserId?: string;
};

export function CommentSection({ postId }: Props) {
  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold">Comments</h2>
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        Comment system coming next...
        <p className="mt-2 text-sm">(Post ID: {postId})</p>
      </div>
    </div>
  );
}