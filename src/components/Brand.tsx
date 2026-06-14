import logoAsset from '@/assets/foundif-logo.png.asset.json';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export const BRAND_LOGO_URL = logoAsset.url;

/** Renders the tenant's uploaded logo if present, otherwise the Chatarly wordmark. */
export const BrandMark = ({ className, size = 36, fullWidth = false }: { className?: string; size?: number; fullWidth?: boolean }) => {
  const { profile } = useAuth();
  const url = (profile as any)?.logo_url || logoAsset.url;
  return (
    <img
      src={url}
      alt={profile?.store_name || 'Chatarly'}
      style={fullWidth ? undefined : { height: size }}
      className={cn(
        fullWidth ? 'w-full h-auto object-contain select-none' : 'w-auto max-w-[200px] object-contain select-none',
        className,
      )}
      draggable={false}
    />
  );
};

/** Compact lockup: logo + business name + optional caption. */
export const BrandLockup = ({
  caption,
  size = 28,
  className,
  showName = true,
}: { caption?: string; size?: number; className?: string; showName?: boolean }) => {
  const { profile } = useAuth();
  const name = profile?.store_name?.trim() || 'My Workspace';
  const tagline = (profile as any)?.tagline || caption;
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <BrandMark size={size} />
      {showName && (
        <div className="flex flex-col leading-tight min-w-0">
          <span className="font-bold text-foreground tracking-tight text-sm truncate max-w-[160px]">{name}</span>
          {tagline && (
            <span className="text-[9px] text-muted-foreground uppercase tracking-[0.18em] truncate max-w-[160px]">{tagline}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default BrandMark;
