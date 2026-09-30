import { Skeleton } from "@/components/ui/skeleton";

export default function SinglePostLoading() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <Skeleton className="mb-4 h-6 w-24" />
      <Skeleton className="mb-4 h-12 w-full" />
      <Skeleton className="mb-8 h-12 w-3/4" />

      <div className="mb-8 flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      <Skeleton className="mb-10 aspect-video w-full rounded-xl" />

      <div className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}