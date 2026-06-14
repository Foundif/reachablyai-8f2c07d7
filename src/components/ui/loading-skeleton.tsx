import { Skeleton } from '@/components/ui/skeleton';

export const StatsCardSkeleton = () => (
  <div className="glass-card p-3 sm:p-4 lg:p-5">
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="w-8 h-8 rounded-lg" />
    </div>
  </div>
);

export const ClientRowSkeleton = () => (
  <div className="glass-card p-3 sm:p-4">
    <div className="flex items-center gap-3 sm:gap-4">
      <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-full" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  </div>
);

export const HeatmapSkeleton = () => (
  <div className="glass-card p-3 sm:p-4 lg:p-5">
    <div className="flex items-center justify-between mb-4">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-4 w-16" />
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-20 sm:h-24 rounded-lg" />
      ))}
    </div>
  </div>
);

export const TimelineSkeleton = () => (
  <div className="glass-card p-3 sm:p-4 lg:p-5">
    <Skeleton className="h-5 w-40 mb-4" />
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-3 h-3 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const AlertsSkeleton = () => (
  <div className="glass-card p-3 sm:p-4 lg:p-5">
    <Skeleton className="h-5 w-24 mb-4" />
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const DashboardSkeleton = () => (
  <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-5 lg:space-y-6">
    {/* Header */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
      <div>
        <Skeleton className="h-7 w-40 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-10 w-28" />
    </div>

    {/* Stats Grid */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
      <StatsCardSkeleton />
      <StatsCardSkeleton />
      <StatsCardSkeleton />
      <StatsCardSkeleton />
    </div>

    {/* Main Content */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
      <div className="lg:col-span-2 space-y-4 sm:space-y-5 lg:space-y-6">
        <HeatmapSkeleton />
        <TimelineSkeleton />
      </div>
      <div className="space-y-4 sm:space-y-5 lg:space-y-6">
        <AlertsSkeleton />
        <div className="glass-card p-4">
          <Skeleton className="h-5 w-40 mb-4" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const ClientsListSkeleton = () => (
  <div className="space-y-3">
    {[...Array(6)].map((_, i) => (
      <ClientRowSkeleton key={i} />
    ))}
  </div>
);
