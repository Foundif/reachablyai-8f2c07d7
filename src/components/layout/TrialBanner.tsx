import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";
import { useTrial } from "@/hooks/useTrial";
import { useAuth } from "@/hooks/useAuth";

/**
 * Curved floating dark green announcement & trial banner (matching TurboDev aesthetic).
 */
const TrialBanner = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isTrialing, isExpired, daysLeft } = useTrial();

  if ((profile as any)?.is_staff) return null;
  if (!isTrialing && !isExpired) return null;

  return (
    <div className="w-full px-3 sm:px-6 pt-2 pb-1 bg-background z-50">
      <div className="max-w-7xl mx-auto bg-gradient-to-r from-[#022c22] via-[#064e3b] to-[#022c22] border border-emerald-500/40 text-emerald-50 py-1.5 px-4 rounded-full shadow-md flex items-center justify-between text-xs font-medium gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2.5 flex-wrap flex-1 justify-center sm:justify-start">
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
                Your Reachably free trial has <strong className="text-white">expired</strong>. Renew to keep automations
                active.
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 mx-auto sm:mx-0">
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
        </div>
      </div>
    </div>
  );
};

export default TrialBanner;
