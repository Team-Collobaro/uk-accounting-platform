import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background font-sans">
      {/* sidebar */}
      <div className="flex w-[260px] shrink-0 flex-col gap-2 border-r p-3">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="mb-3 h-4 w-4/5" />
        {[90, 75, 85, 70, 80, 88].map((w, i) => (
          <Skeleton key={i} className="h-9 rounded-md" style={{ width: `${w}%` }} />
        ))}
      </div>

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* header */}
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b px-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-7 w-40" />
          </div>
          <Skeleton className="h-2 w-40 rounded-full" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>

        {/* messages */}
        <div className="flex flex-1 flex-col gap-4 p-5">
          <Skeleton className="h-16 w-[65%] rounded-lg" />
          <Skeleton className="h-11 w-[45%] self-end rounded-lg" />
          <Skeleton className="h-20 w-[72%] rounded-lg" />
        </div>

        {/* input */}
        <div className="shrink-0 border-t p-3">
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
