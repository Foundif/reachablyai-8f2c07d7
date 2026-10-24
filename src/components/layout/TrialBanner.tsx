import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { useTrial } from "@/hooks/useTrial";
import { useAuth } from "@/hooks/useAuth";

/**
 * Announcement & trial banner matching TurboDev:
 * Flush to the top edge (flat on top) and curved ONLY at the bottom (rounded-b-2xl).
 */
const TrialBanner = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isTrialing, isExpired, daysLeft } = useTrial();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if ((profile as any)?.is_staff) return null;
  if (!isTrialing && !isExpired) return null;

  return (
    <aside
      aria-label="Announcement banner"
      className="w-full bg-gradient-to-r from-[#022c22] via-[#064e3b] to-[#022c22] border-b border-emerald-500/40 text-emerald-50 py-2 px-4 sm:px-6 rounded-b-2xl shadow-md z-50 transition-all"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between text-xs font-medium gap-3">
        {/* Left / Center: Badge + Trial info */}
        <div className="flex items-center gap-2.5 flex-1 justify-center sm:justify-start flex-wrap">
          <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase">
            <Sparkles className="w-3 h-3 text-emerald-300 animate-pulse" />
            {isTrialing ? "Free Trial" : "Trial Expired"}
          </span>

          <span className="text-emerald-100 text-xs">
            {isTrialing ? (
              <>
                Your Reachably 7-day free trial has{" "}
                <strong className="text-white font-semibold">
                  {daysLeft} {daysLeft === 1 ? "day" : "days"} remaining
                </strong>
                .
              </>
            ) : (
              <>
                Your Reachably free trial has <strong className="text-white font-semibold">expired</strong>. Renew to
                keep automations active.
              </>
            )}
          </span>
        </div>

        {/* Right: CTA Button & Dismiss X */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => navigate("/pricing")}
            className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold px-3 py-1 rounded-full text-xs shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
          >
            {isTrialing ? "Upgrade now" : "Renew plan"}
            <ArrowRight className="w-3 h-3" />
          </button>

          <span className="opacity-30 hidden sm:inline text-emerald-200">|</span>

          <a
            href="mailto:foundifinnovations@gmail.com?subject=Reachably%20Consultation"
            className="text-emerald-300 hover:text-white underline underline-offset-2 text-[11px] hidden sm:inline transition-colors"
          >
            Free consultation
          </a>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner"
            className="p-1 rounded-full hover:bg-emerald-900/60 text-emerald-300/80 hover:text-white transition-colors cursor-pointer ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default TrialBanner;
