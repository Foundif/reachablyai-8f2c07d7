import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown, Minus, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

const loadRazorpay = () =>
  new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

interface Props {
  wsId: string | null;
  checks: {
    whatsapp: boolean;
    contacts: boolean;
    template: boolean;
    campaign: boolean;
    automation: boolean;
  };
}

const SETUP_PACKAGE_PRICE = 5990;

const SetupProgressCard = ({ wsId, checks }: Props) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [paid, setPaid] = useState(false);
  const [paying, setPaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!wsId) return;
    (async () => {
      const { data } = await supabase
        .from("workspace_onboarding" as any)
        .select("setup_package_paid")
        .eq("workspace_id", wsId)
        .maybeSingle();
      setPaid(!!(data as any)?.setup_package_paid);
      setReady(true);
    })();
  }, [wsId]);

  const steps = [
    { key: "whatsapp", label: "WhatsApp Connected", done: checks.whatsapp, to: "/whatsapp-settings" },
    { key: "contacts", label: "Contact Added", done: checks.contacts, to: "/leads" },
    { key: "automation", label: "Automation Created", done: checks.automation, to: "/automation" },
    { key: "campaign", label: "Broadcast Sent", done: checks.campaign, to: "/campaigns" },
    { key: "template", label: "Template Approved", done: checks.template, to: "/templates" },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const isComplete = doneCount === steps.length;

  const buySetup = async () => {
    if (!user) return;
    setPaying(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Could not open the payment window");

      const { data, error } = await supabase.functions.invoke("razorpay-create-order", {
        body: { kind: "onboarding" },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || "Order failed");
      const { order, key_id } = data as any;

      const rzp = new window.Razorpay({
        key: key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: "Reachably",
        description: "Done-for-you setup & onboarding",
        prefill: { email: user.email || "", name: (profile as any)?.full_name || "" },
        handler: async (resp: any) => {
          const { data: v, error: vErr } = await supabase.functions.invoke("razorpay-verify", {
            body: {
              kind: "onboarding",
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            },
          });
          if (vErr || (v as any)?.error) return toast.error((v as any)?.error || "Payment could not be confirmed");
          setPaid(true);
          toast.success("Payment received — our team will reach out within 24 hours.");
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.on("payment.failed", (r: any) => toast.error(r?.error?.description || "Payment failed"));
      rzp.open();
    } catch (e: any) {
      toast.error(e.message || "Payment error");
    } finally {
      setPaying(false);
    }
  };

  if (!ready) return null;

  return (
    <>
      {/* TurboDev Top-Right Header Pill */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border bg-card hover:bg-muted/50 shadow-sm transition-all text-sm font-medium shrink-0 cursor-pointer"
        aria-label="Workspace setup progress"
      >
        {isComplete ? (
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground shrink-0 shadow-sm">
            <Check className="w-3 h-3 stroke-[3]" />
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
            {doneCount}/{steps.length}
          </div>
        )}
        <span className="text-xs md:text-sm text-foreground font-medium">
          {isComplete ? "Setup completed" : `Setup ${doneCount}/${steps.length}`}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* TurboDev Workspace Setup Floating Card (Bottom-Right) */}
      {open && (
        <Card className="fixed z-50 right-4 sm:right-6 bottom-6 w-[340px] max-w-[calc(100vw-2rem)] bg-card rounded-2xl shadow-2xl border p-0 overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200">
          {/* Card Header */}
          <div className="flex items-center gap-3 p-4 border-b bg-card">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground shrink-0 shadow-sm">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground leading-tight">Workspace setup</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {doneCount}/{steps.length} complete {isComplete ? "· All done" : `· ${steps.length - doneCount} left`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Minimize"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          {/* List of 5 items */}
          <div className="p-3 space-y-1">
            {steps.map((step) => (
              <button
                key={step.key}
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate(step.to);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-muted/60 transition-colors group cursor-pointer"
              >
                {step.done ? (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 group-hover:border-primary shrink-0 transition-colors" />
                )}
                <span
                  className={`text-sm flex-1 ${step.done ? "font-medium text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}
                >
                  {step.label}
                </span>
                {!step.done && (
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            ))}
          </div>

          {/* Optional Done-for-you onboarding footer */}
          {!isComplete && (
            <div className="m-3 mt-0 rounded-xl border bg-muted/30 p-3 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">Done-for-you setup</p>
                <p className="text-[11px] text-muted-foreground">Expert onboarding & training.</p>
              </div>
              {paid ? (
                <Badge variant="secondary" className="text-[10px]">
                  Purchased
                </Badge>
              ) : (
                <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={buySetup} disabled={paying}>
                  {paying && <Loader2 className="w-3 h-3 animate-spin mr-1" />}₹
                  {SETUP_PACKAGE_PRICE.toLocaleString("en-IN")}
                </Button>
              )}
            </div>
          )}
        </Card>
      )}
    </>
  );
};

export default SetupProgressCard;
