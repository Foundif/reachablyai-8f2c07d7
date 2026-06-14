import { Alert } from '@/hooks/useAlerts';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, TrendingDown, Users, ChevronRight, UserPlus, CreditCard, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AlertPanelProps {
  alerts: Alert[];
}

const AlertPanel = ({ alerts }: AlertPanelProps) => {
  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'payment_overdue':
        return Clock;
      case 'trust_drop':
        return TrendingDown;
      case 'risk_increase':
        return AlertTriangle;
      case 'new_client':
        return UserPlus;
      case 'payment_received':
        return CreditCard;
      default:
        return Bell;
    }
  };

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'high':
        return 'border-l-risk-high bg-risk-high/5';
      case 'medium':
        return 'border-l-risk-medium bg-risk-medium/5';
      case 'low':
        return 'border-l-risk-safe bg-risk-safe/5';
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-3 sm:px-4 lg:px-5 py-3 sm:py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-risk-high" />
          <h3 className="font-semibold text-foreground text-sm sm:text-base">Risk Alerts</h3>
        </div>
        <Link 
          to="/alerts" 
          className="text-xs sm:text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
        >
          <span className="hidden sm:inline">View all</span>
          <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </Link>
      </div>
      
      <div className="divide-y divide-border">
        {alerts.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No alerts</p>
          </div>
        ) : (
          alerts.slice(0, 4).map((alert, index) => {
            const Icon = getAlertIcon(alert.type);
            
            return (
              <div
                key={alert.id}
                className={cn(
                  'px-3 sm:px-4 lg:px-5 py-3 sm:py-4 border-l-4 transition-colors hover:bg-accent/50 cursor-pointer animate-fade-up',
                  getSeverityColor(alert.severity),
                  !alert.read && 'bg-accent/20'
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className={cn(
                    'p-1.5 sm:p-2 rounded-lg flex-shrink-0',
                    alert.severity === 'high' ? 'bg-risk-high/20 text-risk-high' :
                    alert.severity === 'medium' ? 'bg-risk-medium/20 text-risk-medium' :
                    'bg-risk-safe/20 text-risk-safe'
                  )}>
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 sm:mb-1">
                      <span className="font-semibold text-foreground text-xs sm:text-sm truncate">
                        {alert.clientName || alert.title}
                      </span>
                      {!alert.read && (
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                      {alert.message}
                    </p>
                    <span className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 block">
                      {getTimeAgo(alert.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AlertPanel;
