import iconAsset from '@/assets/chatarly-icon.png.asset.json';
import wordmarkAsset from '@/assets/chatarly-wordmark.png.asset.json';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export const BRAND_ICON_URL = iconAsset.url;
export const BRAND_WORDMARK_URL = wordmarkAsset.url;
export const BRAND_LOGO_URL = iconAsset.url;

/** Renders the tenant's uploaded logo if present, otherwise the Chatarly icon. */
export const BrandMark = ({
  className,
  size = 36,
  fullWidth = false,
  variant = 'icon',
}: {
  className?: string;
  size?: number;
  fullWidth?: boolean;
  variant?: 'icon' | 'wordmark';
}) => {
  const { profile } = useAuth();
  const tenantLogo = (profile as any)?.logo_url;
  const src = tenantLogo || (variant === 'wordmark' ? wordmarkAsset.url : iconAsset.url);
  return (
    <img
      src={src}
      alt={profile?.store_name || 'Chatarly'}
      style={fullWidth ? undefined : { height: size, width: variant === 'wordmark' ? 'auto' : size }}
      className={cn(
        fullWidth
          ? 'w-full h-auto object-contain select-none'
          : 'object-contain select-none',
        className,
      )}
      draggable={false}
    />
  );
};

/** Compact lockup: icon + business name + optional caption. */
export const BrandLockup = ({
  caption,
  size = 32,
  className,
  showName = true,
}: { caption?: string; size?: number; className?: string; showName?: boolean }) => {
  const { profile } = useAuth();
  const name = profile?.store_name?.trim() || 'Chatarly';
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
