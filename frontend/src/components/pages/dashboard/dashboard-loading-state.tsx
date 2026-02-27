import { cn } from '@/lib/utils';

export interface DashboardLoadingStateProps {
  className?: string;
}

export function DashboardLoadingState({
  className,
}: DashboardLoadingStateProps) {
  return (
    <div className={cn('p-8 space-y-6', className)}>
      {/* Header */}
      <div className="space-y-1">
        <div className="h-7 w-36 bg-zinc-800 rounded animate-pulse" />
        <div className="h-4 w-52 bg-zinc-800/50 rounded animate-pulse" />
      </div>

      {/* Stats row — 4 cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6"
          >
            <div className="animate-pulse space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 w-28 bg-zinc-800 rounded" />
                <div className="h-4 w-4 bg-zinc-800 rounded" />
              </div>
              <div className="h-8 w-16 bg-zinc-800 rounded" />
              <div className="h-3 w-32 bg-zinc-800/50 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Daily Overview — 2 column */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <div className="animate-pulse space-y-1">
            <div className="h-4 w-28 bg-zinc-800 rounded" />
            <div className="h-3 w-44 bg-zinc-800/50 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800">
          {[1, 2].map((i) => (
            <div key={i} className="p-6 space-y-3">
              <div className="animate-pulse space-y-3">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div
                    key={j}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="h-4 w-3/4 bg-zinc-800 rounded" />
                      <div className="h-3 w-1/3 bg-zinc-800/50 rounded" />
                    </div>
                    <div className="h-5 w-12 bg-zinc-800 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trends + Quick Actions row */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Weekly Trends */}
        <div className="lg:col-span-4 bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <div className="animate-pulse space-y-1">
              <div className="h-4 w-28 bg-zinc-800 rounded" />
              <div className="h-3 w-44 bg-zinc-800/50 rounded" />
            </div>
          </div>
          <div className="p-6">
            <div className="h-[200px] flex items-end gap-2 animate-pulse">
              {[40, 65, 30, 80, 50, 70, 45].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-zinc-800 rounded-t"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <div className="animate-pulse space-y-1">
              <div className="h-4 w-24 bg-zinc-800 rounded" />
              <div className="h-3 w-36 bg-zinc-800/50 rounded" />
            </div>
          </div>
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 rounded-lg border border-zinc-800 animate-pulse"
              >
                <div className="w-9 h-9 bg-zinc-800 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-24 bg-zinc-800 rounded" />
                  <div className="h-3 w-full bg-zinc-800/50 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
