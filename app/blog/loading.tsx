import { Skeleton } from "@/components/ui/skeleton";

function PostCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="mb-2 h-6 w-full" />
        <Skeleton className="mb-2 h-6 w-3/4" />
        <Skeleton className="mb-4 h-4 w-full" />
        <Skeleton className="mb-4 h-4 w-5/6" />
        <div className="mt-auto flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-10" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BlogLoading() {
  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}