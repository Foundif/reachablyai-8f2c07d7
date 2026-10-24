import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";
import { useTrial } from "@/hooks/useTrial";
import { useAuth } from "@/hooks/useAuth";

/**
 * Full-width futuristic announcement & trial bar inspired by TurboDev.
 */
const TrialBanner = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isTrialing, isExpired, daysLeft } = useTrial();

  if ((profile as any)?.is_staff) return null;
  if (!isTrialing && !isExpired) return null;

  return (
    <div className="w-full bg-[#5b38e0] text-white py-1.5 px-4 text-xs font-medium flex items-center justify-center relative z-50 border-b border-white/10 shadow-sm">
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <span className="inline-flex items-center gap-1.5 bg-white/15 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide">
          <Sparkles className="w-3 h-3 text-yellow-300 animate-pulse" />
          {isTrialing ? "FREE TRIAL" : "TRIAL EXPIRED"}
        </span>

        <span>
          {isTrialing ? (
            <>
              Your Reachably 7-day free trial has{" "}
              <strong>
                {daysLeft} {daysLeft === 1 ? "day" : "days"} remaining
              </strong>
              .
            </>
          ) : (
            <>
              Your Reachably free trial has <strong>expired</strong>. Renew your plan to continue.
            </>
          )}
        </span>

        <button
          onClick={() => navigate("/pricing")}
          className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-white/80 font-semibold cursor-pointer ml-1"
        >
          {isTrialing ? "I'm ready to upgrade" : "Renew now"}
          <ArrowRight className="w-3 h-3" />
        </button>

        <span className="opacity-40 hidden sm:inline">|</span>

        <a
          href="mailto:foundifinnovations@gmail.com?subject=Reachably%20Consultation"
          className="text-white/80 hover:text-white underline underline-offset-2 text-[11px] hidden sm:inline"
        >
          Book free consultation
        </a>
      </div>
    </div>
  );
};

export default TrialBanner;
