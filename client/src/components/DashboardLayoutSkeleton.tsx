import { Skeleton } from './ui/skeleton';

const sidebarBlock = 'animate-pulse rounded-md bg-primary-foreground/10';

export function DashboardLayoutSkeleton() {
  return (
    <div className="min-h-screen bg-background lg:flex" role="status" aria-live="polite">
      {/* Sidebar skeleton */}
      <aside className="hidden border-r border-primary-foreground/10 bg-primary p-5 lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex items-center gap-3 px-1 pb-7">
          <div className="size-9 animate-pulse rounded-md bg-primary-foreground/15" />
          <div className="space-y-2">
            <div className={`${sidebarBlock} h-3.5 w-24`} />
            <div className="h-2 w-16 animate-pulse rounded-md bg-primary-foreground/10" />
          </div>
        </div>

        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map(item => (
            <div key={item} className={`${sidebarBlock} h-10 w-full`} />
          ))}
        </div>

        <div className="mt-auto flex items-center gap-3 border-t border-primary-foreground/10 px-1 pt-4">
          <div className="size-9 animate-pulse rounded-full bg-primary-foreground/15" />
          <div className="flex-1 space-y-2">
            <div className={`${sidebarBlock} h-3 w-20`} />
            <div className="h-2 w-32 animate-pulse rounded-md bg-primary-foreground/10" />
          </div>
        </div>
      </aside>

      {/* Main content skeleton */}
      <div className="min-w-0 flex-1 lg:pl-72">
        <div className="border-b border-border bg-card/60 px-5 py-4 sm:px-8">
          <Skeleton className="h-3 w-40" />
        </div>

        <div className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
          <div className="space-y-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>

          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>

      <span className="sr-only">Loading your workspace</span>
    </div>
  );
}
