import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  change?: {
    value: number;
    label: string;
  };
  icon: LucideIcon;
  variant?: 'default' | 'primary' | 'warning' | 'danger';
}

const StatsCard = ({ title, value, change, icon: Icon, variant = 'default' }: StatsCardProps) => {
  const variantStyles = {
    default: 'border-border',
    primary: 'border-primary/40 bg-primary/10',
    warning: 'border-risk-medium/40 bg-risk-medium/10',
    danger: 'border-risk-high/40 bg-risk-high/10',
  };

  const iconStyles = {
    default: 'bg-muted text-foreground',
    primary: 'bg-foreground text-background',
    warning: 'bg-muted text-foreground',
    danger: 'bg-foreground text-background',
  };

  return (
    <div className={cn(
      'glass-card p-3 sm:p-4 lg:p-5 border transition-all duration-300 hover-lift',
      variantStyles[variant]
    )}>
      <div className="flex items-start justify-between mb-2 sm:mb-3 lg:mb-4">
        <div className={cn('p-1.5 sm:p-2 lg:p-2.5 rounded-lg lg:rounded-xl', iconStyles[variant])}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        {change && (
          <span className={cn(
            'text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full',
            change.value >= 0
              ? 'bg-risk-safe/20 text-risk-safe'
              : 'bg-risk-high/20 text-risk-high'
          )}>
            {change.value >= 0 ? '+' : ''}{change.value}%
          </span>
        )}
      </div>
      
      <div>
        <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground mb-0.5 sm:mb-1 truncate">{title}</p>
        <p className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">{value}</p>
      </div>
    </div>
  );
};

export default StatsCard;
