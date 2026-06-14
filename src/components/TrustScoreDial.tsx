import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface TrustScoreDialProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
}

const TrustScoreDial = ({ score, size = 'md', showLabel = true, animated = true }: TrustScoreDialProps) => {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
  
  useEffect(() => {
    if (!animated) {
      setDisplayScore(score);
      return;
    }
    
    const duration = 1000;
    const steps = 60;
    const increment = score / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= score) {
        setDisplayScore(score);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.round(current));
      }
    }, duration / steps);
    
    return () => clearInterval(timer);
  }, [score, animated]);

  const getScoreColor = (s: number): string => {
    if (s >= 80) return 'text-trust-excellent';
    if (s >= 60) return 'text-trust-high';
    if (s >= 40) return 'text-trust-medium';
    return 'text-trust-low';
  };

  const getScoreLabel = (s: number): string => {
    if (s >= 80) return 'Excellent';
    if (s >= 60) return 'Good';
    if (s >= 40) return 'Medium';
    return 'High Risk';
  };

  const getGradientStops = (): string => {
    const percentage = (displayScore / 100) * 270; // 270 degrees arc
    return `conic-gradient(
      from 135deg,
      hsl(var(--trust-low)) 0deg,
      hsl(var(--trust-medium)) 90deg,
      hsl(var(--trust-high)) 180deg,
      hsl(var(--trust-excellent)) 270deg,
      hsl(var(--muted)) ${percentage}deg,
      hsl(var(--muted)) 270deg
    )`;
  };

  const sizeClasses = {
    sm: 'w-20 h-20',
    md: 'w-32 h-32',
    lg: 'w-48 h-48',
  };

  const innerSizeClasses = {
    sm: 'w-14 h-14',
    md: 'w-24 h-24',
    lg: 'w-36 h-36',
  };

  const scoreTextClasses = {
    sm: 'text-lg',
    md: 'text-3xl',
    lg: 'text-5xl',
  };

  const labelTextClasses = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn('relative rounded-full p-1', sizeClasses[size])}>
        {/* Background gradient arc */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: getGradientStops(),
            clipPath: 'polygon(50% 50%, 0 100%, 0 0, 100% 0, 100% 100%)',
          }}
        />
        
        {/* Animated glow ring */}
        <div className="absolute inset-0 rounded-full animate-pulse-ring opacity-30"
          style={{
            background: `radial-gradient(circle, hsl(var(--primary) / 0.4), transparent 70%)`,
          }}
        />
        
        {/* Inner circle */}
        <div className={cn(
          'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background flex flex-col items-center justify-center',
          innerSizeClasses[size]
        )}>
          <span className={cn('font-bold tabular-nums', scoreTextClasses[size], getScoreColor(displayScore))}>
            {displayScore}
          </span>
          {showLabel && (
            <span className={cn('text-muted-foreground font-medium uppercase tracking-wider', labelTextClasses[size])}>
              {getScoreLabel(displayScore)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrustScoreDial;
