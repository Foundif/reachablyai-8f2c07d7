import { cn } from '@/lib/utils';
import { RiskLevel } from '@/types/client';
import { Shield, AlertTriangle, XCircle } from 'lucide-react';

interface RiskBadgeProps {
  level: RiskLevel;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const RiskBadge = ({ level, showIcon = true, size = 'md' }: RiskBadgeProps) => {
  const config = {
    safe: {
      label: 'Safe',
      icon: Shield,
      classes: 'bg-risk-safe/25 text-risk-safe border-risk-safe/40',
    },
    medium: {
      label: 'Medium',
      icon: AlertTriangle,
      classes: 'bg-risk-medium/25 text-risk-medium border-risk-medium/40',
    },
    high: {
      label: 'High Risk',
      icon: XCircle,
      classes: 'bg-risk-high/25 text-risk-high border-risk-high/40',
    },
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
    lg: 'px-4 py-1.5 text-base gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const { label, icon: Icon, classes } = config[level];

  return (
    <span className={cn(
      'inline-flex items-center font-medium rounded-full border',
      classes,
      sizeClasses[size]
    )}>
      {showIcon && <Icon className={iconSizes[size]} />}
      {label}
    </span>
  );
};

export default RiskBadge;
