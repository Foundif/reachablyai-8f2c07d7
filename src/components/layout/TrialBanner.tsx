import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { useTrial } from "@/hooks/useTrial";
import { useAuth } from "@/hooks/useAuth";

const TrialBanner = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isTrialing, isExpired, daysLeft } = useTrial();
  const [dismissed, setDismissed] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  const slides = isTrialing
    ? [
        `Free trial: ${daysLeft} ${daysLeft === 1 ? "day" : "days"} remaining`,
        "All automations active & ready",
        "Upgrade now to lock your plan",
      ]
    : ["Trial expired: Automations paused", "Renew now to keep chats active"];

  // Auto-slides text smoothly on mobile
  useEffect(() => {
    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (dismissed) return null;
  if ((profile as any)?.is_staff) return null;
  if (!isTrialing && !isExpired) return null;

  return (
    <aside
      aria-label="Announcement banner"
      className="w-full bg-gradient-to-r from-[#022c22] via-[#064e3b] to-[#022c22] border-b border-emerald-500/30 text-emerald-50 z-50 shrink-0"
    >
      {/* Mobile View: Strictly 1 Single Compact Row */}
      <div className="flex sm:hidden items-center justify-between h-9 px-3 text-xs gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
          <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider shrink-0 uppercase">
            <Sparkles className="w-2.5 h-2.5 text-emerald-300" />
            {isTrialing ? "Trial" : "Expired"}
          </span>
          <span className="text-[11px] text-emerald-100 truncate transition-all duration-300 font-medium">
            {slides[slideIndex]}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => navigate("/pricing")}
            className="inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold px-2 py-0.5 rounded-full text-[10px] shadow-sm transition-transform active:scale-95"
          >
            {isTrialing ? "Upgrade" : "Renew"}
            <ArrowRight className="w-2.5 h-2.5" />
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner"
            className="p-1 rounded-full text-emerald-300/80 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Desktop View: Expanded Announcement Row */}
      <div className="hidden sm:flex max-w-7xl mx-auto items-center justify-between py-2 px-6 text-xs font-medium gap-3">
        <div className="flex items-center gap-2.5 flex-1">
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

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => navigate("/pricing")}
            className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold px-3 py-1 rounded-full text-xs shadow-sm transition-all hover:scale-[1.02]"
          >
            {isTrialing ? "Upgrade now" : "Renew plan"}
            <ArrowRight className="w-3 h-3" />
          </button>

          <span className="opacity-30 text-emerald-200">|</span>

          <a
            href="mailto:foundifinnovations@gmail.com?subject=Reachably%20Consultation"
            className="text-emerald-300 hover:text-white underline underline-offset-2 text-[11px]"
          >
            Free consultation
          </a>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner"
            className="p-1 rounded-full hover:bg-emerald-900/60 text-emerald-300/80 hover:text-white ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default TrialBanner;
