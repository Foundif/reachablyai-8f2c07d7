import { CommunityInsight } from '@/types/client';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Globe } from 'lucide-react';

interface CommunityTrendsProps {
  insights: CommunityInsight[];
}

const CommunityTrends = ({ insights }: CommunityTrendsProps) => {
  const getTrendIcon = (trend: CommunityInsight['riskTrend']) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-risk-safe" />;
      case 'declining':
        return <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-risk-high" />;
      case 'stable':
        return <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />;
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-trust-excellent';
    if (score >= 60) return 'text-trust-high';
    if (score >= 40) return 'text-trust-medium';
    return 'text-trust-low';
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-3 sm:px-4 lg:px-5 py-3 sm:py-4 border-b border-border flex items-center gap-1.5 sm:gap-2">
        <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        <h3 className="font-semibold text-foreground text-sm sm:text-base">Community Risk Trends</h3>
      </div>
      
      <div className="divide-y divide-border">
        {insights.map((insight, index) => (
          <div
            key={`${insight.industry}-${insight.country}`}
            className="px-3 sm:px-4 lg:px-5 py-3 sm:py-4 hover:bg-accent/30 transition-colors animate-fade-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                  <span className="font-semibold text-foreground text-xs sm:text-sm">
                    {insight.industry}
                  </span>
                  <span className="text-muted-foreground hidden sm:inline">•</span>
                  <span className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:inline">
                    {insight.country}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {insight.totalReports.toLocaleString()} reports
                </p>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="text-right">
                  <p className={cn('text-sm sm:text-lg font-bold tabular-nums', getScoreColor(insight.avgTrustScore))}>
                    {insight.avgTrustScore}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">avg score</p>
                </div>
                
                <div className="flex items-center gap-1">
                  {getTrendIcon(insight.riskTrend)}
                </div>
              </div>
            </div>
            
            {/* Score bar */}
            <div className="mt-2 sm:mt-3 data-bar">
              <div 
                className="data-bar-fill"
                style={{ width: `${insight.avgTrustScore}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommunityTrends;
