import { Client } from '@/types/client';
import { cn } from '@/lib/utils';
import TrustScoreDial from '../TrustScoreDial';
import RiskBadge from '../RiskBadge';
import { formatCurrency } from '@/data/mockData';
import { Link } from 'react-router-dom';
import { ChevronRight, Users } from 'lucide-react';

interface ClientRiskHeatmapProps {
  clients: Client[];
}

const ClientRiskHeatmap = ({ clients }: ClientRiskHeatmapProps) => {
  // Sort by risk level (high first), then by outstanding amount
  const sortedClients = [...clients].sort((a, b) => {
    const riskOrder = { high: 0, medium: 1, safe: 2 };
    if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    }
    return b.totalOutstanding - a.totalOutstanding;
  });

  // Take only top 6 for display
  const displayClients = sortedClients.slice(0, 6);

  if (clients.length === 0) {
    return (
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Client Risk Overview</h3>
        </div>
        <div className="p-8 text-center">
          <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
            <Users className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">No clients to display</p>
          <Link 
            to="/clients" 
            className="text-sm text-primary hover:text-primary/80 mt-2 inline-block"
          >
            Add your first client →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm sm:text-base">Client Risk Overview</h3>
        <Link 
          to="/clients" 
          className="text-xs sm:text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
        >
          <span className="hidden xs:inline">View all</span>
          <span className="xs:hidden">All</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      
      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-2 xs:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {displayClients.map((client, index) => (
            <Link
              key={client.id}
              to={`/clients/${client.id}`}
              className={cn(
                'p-2.5 sm:p-3 rounded-xl border transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer animate-fade-up group',
                client.riskLevel === 'high' 
                  ? 'bg-risk-high/10 border-risk-high/30 hover:border-risk-high/50 hover:bg-risk-high/15'
                  : client.riskLevel === 'medium'
                  ? 'bg-risk-medium/10 border-risk-medium/30 hover:border-risk-medium/50 hover:bg-risk-medium/15'
                  : 'bg-risk-safe/10 border-risk-safe/30 hover:border-risk-safe/50 hover:bg-risk-safe/15'
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex flex-col items-center text-center">
                <div className="transform scale-[0.7] sm:scale-[0.8] lg:scale-[0.85]">
                  <TrustScoreDial score={client.trustScore} size="sm" showLabel={false} />
                </div>
                <h4 className="font-semibold text-foreground text-xs sm:text-sm mt-1.5 truncate w-full group-hover:text-primary transition-colors">
                  {client.company ? client.company.split(' ')[0] : client.name.split(' ')[0]}
                </h4>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate w-full">
                  {client.name}
                </p>
                <div className="mt-1.5 transform scale-90 sm:scale-100">
                  <RiskBadge level={client.riskLevel} size="sm" showIcon={false} />
                </div>
                {client.totalOutstanding > 0 && (
                  <p className="text-[10px] sm:text-xs font-semibold text-risk-medium mt-1.5 truncate w-full">
                    {formatCurrency(client.totalOutstanding)} due
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
        
        {clients.length > 6 && (
          <div className="mt-3 pt-3 border-t border-border/50 text-center">
            <Link 
              to="/clients" 
              className="text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              +{clients.length - 6} more clients
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientRiskHeatmap;
