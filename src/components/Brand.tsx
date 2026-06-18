import logoLightSrc from '@/assets/brand/logo-light.png';
import logoDarkSrc from '@/assets/brand/logo-dark.png';
import iconLightSrc from '@/assets/brand/icon-light.png';
import iconDarkSrc from '@/assets/brand/icon-dark.png';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

export const BRAND_ICON_URL = iconLightSrc;
export const BRAND_WORDMARK_URL = logoLightSrc;
export const BRAND_LOGO_URL = logoLightSrc;

/** Theme-aware Chatarly logo. Falls back to tenant logo when uploaded. */
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
  const { theme } = useTheme();
  const tenantLogo = (profile as any)?.logo_url;
  const themedWord = theme === 'dark' ? logoDarkSrc : logoLightSrc;
  const themedIcon = theme === 'dark' ? iconDarkSrc : iconLightSrc;
  const src = tenantLogo
    ? tenantLogo
    : variant === 'wordmark'
      ? themedWord
      : themedIcon;

  return (
    <img
      src={src}
      alt={profile?.store_name || 'Chatarly'}
      style={
        fullWidth
          ? undefined
          : variant === 'wordmark'
            ? { height: size, width: 'auto' }
            : { height: size, width: size, objectFit: 'contain' }
      }
      className={cn(
        fullWidth ? 'w-full h-auto object-contain select-none' : 'object-contain select-none',
        className,
      )}
      draggable={false}
    />
  );
};

/** Compact lockup: logo + optional caption (logo already includes wordmark). */
export const BrandLockup = ({
  caption,
  size = 32,
  className,
  showName = true,
}: { caption?: string; size?: number; className?: string; showName?: boolean }) => {
  const { profile } = useAuth();
  const tagline = (profile as any)?.tagline || caption;
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <BrandMark variant="wordmark" size={size} />
      {showName && tagline && (
        <span className="text-[9px] text-muted-foreground uppercase tracking-[0.18em] truncate max-w-[160px]">{tagline}</span>
      )}
    </div>
  );
};

export default BrandMark;
