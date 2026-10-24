import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = { wsId: string | null; credits: number; creditsPack: number; aiReplies: number };
type MetricType = "chats" | "messages";

/** Turbodev-style "Today" overview: Open chats / Messages received dropdown + hourly chart + Meta/AI status. */
const TodayActivityCard = ({ wsId, credits, creditsPack, aiReplies }: Props) => {
  const navigate = useNavigate();
  const [metric, setMetric] = useState<MetricType>("chats");
  const [hours, setHours] = useState<{ h: string; chats: number; messages: number }[]>([]);
  const [openChats, setOpenChats] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);

  useEffect(() => {
    if (!wsId) return;
    (async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("wa_messages" as any)
        .select("created_at,conversation_id")
        .eq("workspace_id", wsId)
        .eq("direction", "inbound")
        .gte("created_at", start.toISOString())
        .limit(5000);

      const rows = (data as any[]) || [];
      const buckets = Array.from({ length: 24 }, (_, i) => ({
        h: new Date(2000, 0, 1, i).toLocaleTimeString([], { hour: "numeric" }),
        chats: 0,
        messages: 0,
      }));

      const convsByHour = Array.from({ length: 24 }, () => new Set<string>());
      rows.forEach((r) => {
        const hour = new Date(r.created_at).getHours();
        buckets[hour].messages++;
        if (r.conversation_id) convsByHour[hour].add(r.conversation_id);
      });

      buckets.forEach((b, i) => {
        b.chats = convsByHour[i].size;
      });

      setHours(buckets);
      setTotalMessages(rows.length);
      setOpenChats(new Set(rows.map((r) => r.conversation_id).filter(Boolean)).size);
    })();
  }, [wsId]);

  const today = new Date().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,0.45fr)] gap-6 lg:gap-8">
      <div className="space-y-6 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="sr-only">Today</h2>

            {/* TurboDev Metric Selector Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group cursor-pointer"
                >
                  <span>{metric === "chats" ? "Open chats" : "Messages received"}</span>
                  <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover:translate-y-0.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-card border shadow-lg rounded-xl p-1">
                <DropdownMenuItem
                  onClick={() => setMetric("chats")}
                  className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer ${
                    metric === "chats" ? "font-semibold text-primary bg-primary/10" : ""
                  }`}
                >
                  <span>Open chats</span>
                  {metric === "chats" && <Check className="w-4 h-4 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setMetric("messages")}
                  className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer ${
                    metric === "messages" ? "font-semibold text-primary bg-primary/10" : ""
                  }`}
                >
                  <span>Messages received</span>
                  {metric === "messages" && <Check className="w-4 h-4 text-primary" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Big Stat Value */}
            <p className="text-4xl font-semibold leading-tight tabular-nums mt-1 text-foreground">
              {metric === "chats" ? openChats : totalMessages.toLocaleString("en-IN")}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {metric === "chats" ? "Chats with customer messages today" : "Customer messages received today"}
            </p>
          </div>

          <p className="text-sm text-muted-foreground text-right shrink-0">
            {today}
            <br />
            <span className="text-foreground font-medium">Today</span>
          </p>
        </div>

        {/* Dynamic Hourly Recharts Graph */}
        <div className="h-36 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hours} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="todayFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="h"
                tickLine={false}
                axisLine={false}
                interval={2}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: any) => [v, metric === "chats" ? "Open chats" : "Messages"]}
              />
              <Area
                type="monotone"
                dataKey={metric}
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill="url(#todayFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Meta & AI Right Column */}
      <div className="lg:border-l lg:pl-8 pt-2 lg:pt-14 space-y-2">
        <p className="font-semibold mb-2 text-foreground">Meta & AI Status</p>

        {/* 0% Markup Direct Meta Card */}
        <button
          type="button"
          onClick={() => navigate("/whatsapp-settings")}
          className="group w-full flex items-center justify-between py-4 border-b text-left transition-colors cursor-pointer"
        >
          <span>
            <span className="block text-sm text-muted-foreground">Meta conversation fees</span>
            <span className="block text-xl font-semibold mt-1 text-primary">0% Markup · Direct</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              Marketing & Utility billed directly by Meta
            </span>
            <span className="block text-xs font-medium text-primary mt-1 group-hover:underline">
              Manage WhatsApp API →
            </span>
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>

        {/* AI Usage */}
        <button
          type="button"
          onClick={() => navigate("/chatbots")}
          className="group w-full flex items-center justify-between py-4 text-left transition-colors cursor-pointer"
        >
          <span>
            <span className="block text-sm text-muted-foreground">AI replies this month</span>
            <span className="block text-2xl font-semibold mt-1 tabular-nums text-foreground">
              {aiReplies.toLocaleString("en-IN")}
            </span>
            <span className="block text-xs text-muted-foreground mt-0.5">Handled by Reachably AI assistants</span>
            <span className="block text-xs font-medium text-primary mt-1 group-hover:underline">Configure bots →</span>
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </section>
  );
};

export default TodayActivityCard;
