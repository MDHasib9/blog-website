import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-3 text-muted-foreground">
        It may have moved, been removed, or the address may be incorrect.
      </p>
      <Button className="mt-6" asChild>
        <Link href="/blog">Explore stories</Link>
      </Button>
    </div>
  );
}
