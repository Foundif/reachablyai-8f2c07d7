import { useMemo } from 'react';
import { useClients } from './useClients';

export interface CommunityInsight {
  industry: string;
  country: string;
  avgTrustScore: number;
  totalReports: number;
  riskTrend: 'improving' | 'stable' | 'declining';
}

export const useCommunityInsights = () => {
  const { clients, loading } = useClients();

  const insights = useMemo(() => {
    if (clients.length === 0) return [];

    // Group clients by industry and country
    const grouped = clients.reduce((acc, client) => {
      const key = `${client.industry || 'Other'}-${client.country || 'Unknown'}`;
      if (!acc[key]) {
        acc[key] = {
          industry: client.industry || 'Other',
          country: client.country || 'Unknown',
          scores: [],
          count: 0,
        };
      }
      acc[key].scores.push(client.trust_score);
      acc[key].count++;
      return acc;
    }, {} as Record<string, { industry: string; country: string; scores: number[]; count: number }>);

    // Calculate insights
    return Object.values(grouped).map((group) => {
      const avgScore = Math.round(
        group.scores.reduce((sum, s) => sum + s, 0) / group.scores.length
      );
      
      // Determine trend based on score distribution
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (avgScore >= 70) trend = 'improving';
      else if (avgScore < 50) trend = 'declining';

      return {
        industry: group.industry,
        country: group.country,
        avgTrustScore: avgScore,
        totalReports: group.count,
        riskTrend: trend,
      } as CommunityInsight;
    });
  }, [clients]);

  // Get unique industries from real data
  const industries = useMemo(() => {
    return [...new Set(clients.map((c) => c.industry || 'Other'))];
  }, [clients]);

  return { insights, industries, loading };
};
