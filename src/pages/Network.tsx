import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useCommunityInsights } from '@/hooks/useCommunityInsights';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { 
  Globe, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Lock,
  Zap,
  Users,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const Network = () => {
  const navigate = useNavigate();
  const { insights, industries, loading } = useCommunityInsights();
  const [searchQuery, setSearchQuery] = useState('');
  const [industryFilter, setIndustryFilter] = useState<string>('all');

  const filteredInsights = insights.filter(insight => {
    const matchesSearch = 
      insight.industry.toLowerCase().includes(searchQuery.toLowerCase()) ||
      insight.country.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesIndustry = industryFilter === 'all' || insight.industry === industryFilter;
    
    return matchesSearch && matchesIndustry;
  });

  const getTrendIcon = (trend: 'improving' | 'stable' | 'declining') => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-5 h-5 text-risk-safe" />;
      case 'declining':
        return <TrendingDown className="w-5 h-5 text-risk-high" />;
      case 'stable':
        return <Minus className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-trust-excellent';
    if (score >= 60) return 'text-trust-high';
    if (score >= 40) return 'text-trust-medium';
    return 'text-trust-low';
  };

  if (loading) {
    return (
      <AppLayout>
        <DashboardSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Globe className="w-8 h-8 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Community Network
              </h1>
            </div>
            <p className="text-muted-foreground">
              Risk intelligence aggregated from your client data
            </p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="glass-card p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by industry or country..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background border-border"
              />
            </div>
            
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="w-[180px] bg-background">
                <SelectValue placeholder="All Industries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {industries.map(industry => (
                  <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Premium Banner */}
        <div className="glass-card p-6 border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/20">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">
                  Unlock Full Community Intelligence
                </h3>
                <p className="text-sm text-muted-foreground">
                  Get detailed high-risk reports, pattern analysis, and real-time alerts
                </p>
              </div>
            </div>
            <Button variant="trust" size="lg" onClick={() => navigate('/pricing')}>
              Upgrade to Pro
            </Button>
          </div>
        </div>

        {/* Empty State */}
        {insights.length === 0 && (
          <div className="glass-card p-12 text-center">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Insights Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Add clients with industry and country information to see aggregated risk insights.
            </p>
            <Button variant="trust" onClick={() => navigate('/clients')}>
              Add Clients
            </Button>
          </div>
        )}

        {/* Insights Grid */}
        {insights.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInsights.map((insight, index) => (
              <div
                key={`${insight.industry}-${insight.country}`}
                className="glass-card p-6 hover-lift cursor-pointer animate-fade-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{insight.industry}</h3>
                    <p className="text-sm text-muted-foreground">{insight.country}</p>
                  </div>
                  {getTrendIcon(insight.riskTrend)}
                </div>
                
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Avg Trust Score</p>
                    <p className={cn('text-3xl font-bold tabular-nums', getScoreColor(insight.avgTrustScore))}>
                      {insight.avgTrustScore}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground mb-1">Clients</p>
                    <p className="text-lg font-semibold text-foreground">
                      {insight.totalReports}
                    </p>
                  </div>
                </div>
                
                <div className="data-bar mb-3">
                  <div 
                    className="data-bar-fill"
                    style={{ width: `${insight.avgTrustScore}%` }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className={cn(
                    'text-xs px-2 py-1 rounded-full',
                    insight.riskTrend === 'improving' ? 'bg-risk-safe/20 text-risk-safe' :
                    insight.riskTrend === 'declining' ? 'bg-risk-high/20 text-risk-high' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {insight.riskTrend === 'improving' ? '↑ Improving' :
                     insight.riskTrend === 'declining' ? '↓ Declining' :
                     '→ Stable'}
                  </span>
                  
                  {insight.avgTrustScore < 60 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="w-3 h-3" />
                      Pro
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredInsights.length === 0 && insights.length > 0 && (
          <div className="glass-card p-12 text-center">
            <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No insights found matching your search.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Network;
