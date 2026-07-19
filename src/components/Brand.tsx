import wordmarkLight from '@/assets/reachably-wordmark-light.png.asset.json';
import wordmarkDark from '@/assets/reachably-wordmark-dark.png.asset.json';
import iconLight from '@/assets/reachably-icon-light.png.asset.json';
import iconDark from '@/assets/reachably-icon-dark.png.asset.json';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

export const BRAND_ICON_URL = iconLight.url;
export const BRAND_WORDMARK_URL = wordmarkLight.url;
export const BRAND_LOGO_URL = wordmarkLight.url;

/**
 * Reachably brand logo. Always uses the static Reachably asset — never a
 * tenant/business-uploaded logo. Auto-switches between light/dark variants.
 */
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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const src =
    variant === 'wordmark'
      ? (isDark ? wordmarkDark.url : wordmarkLight.url)
      : (isDark ? iconDark.url : iconLight.url);

  return (
    <img
      src={src}
      alt="Reachably"
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

export const BrandLockup = ({
  caption,
  size = 32,
  className,
  showName = true,
}: { caption?: string; size?: number; className?: string; showName?: boolean }) => {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <BrandMark variant="wordmark" size={size} />
      {showName && caption && (
        <span className="text-[9px] text-muted-foreground uppercase tracking-[0.18em] truncate max-w-[160px]">{caption}</span>
      )}
    </div>
  );
};

export default BrandMark;
