import { useEffect, useMemo, useRef, useState } from "react";
import { SecureImg } from "@/lib/secureMedia";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Plus,
  Megaphone,
  Send,
  ArrowLeft,
  Trash2,
  Upload,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Search,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  FileSpreadsheet,
  Users,
  Check,
  MoreVertical,
  Calendar,
  MessageSquare,
  Repeat,
  Download,
} from "lucide-react";
import { resolveWorkspaceId } from "@/lib/workspace";
import ConfirmDialog from "@/components/ConfirmDialog";

// ---------- Turbodev-Style Preset WhatsApp Templates (Image 116) ----------
const TURBODEV_TEMPLATES = [
  {
    id: "order_processed_ithink",
    name: "order_processed_ithink",
    category: "Utility",
    language: "en",
    status: "APPROVED",
    created_at_label: "11 days ago",
    body_text:
      "Hi {{1}},\n\n📦 {{2}} in your order ({{3}}) has been packed and is ready for courier pickup from our dispatch hub.\n\nThe estimated delivery date will be automatically updated in your tracking link.",
  },
  {
    id: "diwali_campaign",
    name: "diwali_campaign",
    category: "Marketing",
    language: "en",
    status: "APPROVED",
    created_at_label: "14 days ago",
    header_media_url: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&auto=format&fit=crop&q=80",
    body_text:
      "💥 KAPA Diwali Mega Sale is LIVE! Buy more, save up to ₹250 OFF on all official kits and custom prints. Tap below to shop before stock runs out!",
  },
  {
    id: "not_available",
    name: "not_available",
    category: "Utility",
    language: "en_gb",
    status: "APPROVED",
    created_at_label: "14 days ago",
    body_text:
      "Hi {{1}},\n\n⚠️ We're sorry, but {{2}} in your order ({{3}}) is unavailable. We've checked with all our warehouses, but the item is CURRENTLY UNAVAILABLE.\n\nWe apologize for the inconvenience and will initiate a full refund immediately.",
  },
  {
    id: "print_order_processed_shi",
    name: "print_order_processed_shi...",
    category: "Utility",
    language: "en",
    status: "APPROVED",
    created_at_label: "14 days ago",
    body_text:
      "Hi {{1}},\n\n📦 Your order for {{2}} ({{3}}) has been processed, and the shipping label has been created.\n\n👕 The item will now be sent for printing. Once printing is complete it will return to our hub.",
  },
  {
    id: "argentina_farewell",
    name: "argentina_farewell_",
    category: "Marketing",
    language: "en",
    status: "APPROVED",
    created_at_label: "a month ago",
    header_media_url: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=80",
    body_text:
      "The GOAT. The memories. The legendary #10 jersey is back in limited quantities. Claim yours today with free express delivery!",
  },
  {
    id: "abandoned_cart",
    name: "abandoned_cart",
    category: "Marketing",
    language: "en",
    status: "APPROVED",
    created_at_label: "2 months ago",
    body_text:
      "Hi {{1}},\n\n👋 We noticed you were checking out {{2}} on KAPA but didn't complete your purchase.\n\nIf you had any questions or faced an issue while placing your order, you can let us know.",
  },
  {
    id: "still_under_procurement",
    name: "still_under_procurement",
    category: "Utility",
    language: "en",
    status: "APPROVED",
    created_at_label: "2 months ago",
    body_text:
      "Hi {{1}},\n\n📦 A quick update regarding the item {{2}} in your order ({{3}}).\n\n⏳ The item is still under procurement, and we are currently working to source it for dispatch as soon as possible.",
  },
  {
    id: "review",
    name: "review",
    category: "Marketing",
    language: "en",
    status: "APPROVED",
    created_at_label: "3 months ago",
    body_text:
      "Hi {{1}},\n\n😍 Hope you're loving your {{2}} !\n\n⭐ If you've got a minute, it would really help us if you could leave a review on our website.",
  },
];

// Helper: Highlight template variables as Turbodev Green Pills
function renderTemplateWithPills(text: string) {
  if (!text) return null;
  const sampleValues: Record<string, string> = {
    "1": "Vishal Raaj",
    "2": "Real Madrid Home Kit 26/27 (FV)",
    "3": "# 42094",
  };

  const parts = text.split(/(\{\{[0-9a-zA-Z_]+\}\}|\[[^\]]+\])/g);
  return parts.map((part, index) => {
    const match = part.match(/\{\{([0-9a-zA-Z_]+)\}\}/);
    if (match) {
      const varKey = match[1];
      const displayVal = sampleValues[varKey] || `Var ${varKey}`;
      return (
        <span
          key={index}
          className="inline-block bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-medium px-1.5 py-0.5 rounded text-[11px] mx-0.5 border border-emerald-200/50 dark:border-emerald-800/40"
        >
          {displayVal}
        </span>
      );
    }
    return part;
  });
}

// ---------- Circular Gauge Component (Turbodev Style) ----------
const CircularGauge = ({
  percent = 0,
  count = 0,
  color = "stroke-purple-600 text-purple-600",
}: {
  percent: number;
  count: number;
  color?: string;
}) => {
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <div className="flex items-center justify-center gap-2">
      <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
        <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r={radius} className="stroke-muted/40 fill-none" strokeWidth="2.5" />
          <circle
            cx="16"
            cy="16"
            r={radius}
            className={`fill-none transition-all duration-500 ${color}`}
            strokeWidth="2.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="text-left">
        <div className="font-semibold text-xs leading-none">{count}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5 leading-none">{percent}%</div>
      </div>
    </div>
  );
};

export default function Campaigns() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [wsId, setWsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [waCred, setWaCred] = useState<any>(null);

  // Wizard state: 0 = list view, 1 = Select Template, 2 = Select Audience, 3 = Schedule
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2 | 3>(0);

  // Filters & Table State
  const [dateRange, setDateRange] = useState("last_7_days");
  const [searchQuery, setSearchQuery] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");

  // New Broadcast Form State
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [broadcastName, setBroadcastName] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Array<{ name?: string; phone: string }>>([]);
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const id = await resolveWorkspaceId(user.id, profile);
    setWsId(id);
    if (!id) {
      setLoading(false);
      return;
    }

    const [{ data: camps }, { data: tmpls }, { data: lds }, { data: wa }] = await Promise.all([
      supabase
        .from("campaigns" as any)
        .select("*")
        .eq("workspace_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("whatsapp_templates" as any)
        .select("*")
        .eq("workspace_id", id)
        .eq("status", "APPROVED"),
      supabase
        .from("leads")
        .select("id, full_name, phone, tags, source, created_at")
        .eq("workspace_id", id)
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("whatsapp_credentials" as any)
        .select("label, verified_name, phone_number_id")
        .eq("workspace_id", id)
        .maybeSingle(),
    ]);

    setItems((camps as any[]) || []);
    setTemplates((tmpls as any[]) || []);
    setLeads(lds || []);
    setWaCred(wa || null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user, profile]);

  // Combine DB templates with Turbodev presets
  const allTemplates = useMemo(() => {
    return templates.length > 0 ? templates : TURBODEV_TEMPLATES;
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return allTemplates;
    return allTemplates.filter((t) => t.name.toLowerCase().includes(templateSearch.toLowerCase()));
  }, [allTemplates, templateSearch]);

  // Download CSV Broadcast Report
  const handleDownloadReport = (broadcast: any) => {
    const rows = [
      ["Broadcast Name", broadcast.name],
      ["Status", broadcast.status],
      ["Date", new Date(broadcast.created_at).toLocaleString()],
      ["Recipients", broadcast.total_count || 0],
      ["Sent", broadcast.sent_count || 0],
      ["Delivered", broadcast.delivered_count || 0],
      ["Read", broadcast.read_count || 0],
      ["Reacted", broadcast.reacted_count || 0],
      ["Replied", broadcast.replied_count || 0],
      ["Failed", broadcast.failed_count || 0],
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," + rows.map((e) => e.map((val) => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `broadcast_report_${broadcast.name.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloaded report for "${broadcast.name}"`);
  };

  // Repeat Broadcast
  const handleRepeatBroadcast = (broadcast: any) => {
    setBroadcastName(`${broadcast.name}_repeat`);
    const matched = allTemplates.find((t) => t.id === broadcast.template_id) || allTemplates[0];
    setSelectedTemplate(matched);
    setWizardStep(2);
    toast.info(`Repeating broadcast: ${broadcast.name}`);
  };

  // Calculate Overview Totals
  const overviewTotals = useMemo(() => {
    const recipients = items.reduce((sum, b) => sum + (b.total_count || 0), 0);
    const sent = items.reduce((sum, b) => sum + (b.sent_count || 0), 0);
    const delivered = items.reduce((sum, b) => sum + (b.delivered_count || 0), 0);
    const read = items.reduce((sum, b) => sum + (b.read_count || 0), 0);
    const replied = items.reduce((sum, b) => sum + (b.replied_count || 0), 0);
    const failed = items.reduce((sum, b) => sum + (b.failed_count || 0), 0);

    const sentPct = recipients > 0 ? Math.round((sent / recipients) * 100) : 0;
    const deliveredPct = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
    const readPct = delivered > 0 ? Math.round((read / delivered) * 100) : 0;
    const repliedPct = read > 0 ? Math.round((replied / read) * 100) : 0;
    const failedPct = sent > 0 ? Math.round((failed / sent) * 100) : 0;

    return {
      recipients,
      sent,
      delivered,
      read,
      replied,
      failed,
      sentPct,
      deliveredPct,
      readPct,
      repliedPct,
      failedPct,
    };
  }, [items]);

  // Filter Broadcasts
  const filteredBroadcasts = useMemo(() => {
    return items.filter((b) => {
      const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [items, searchQuery]);

  // Handle CSV Upload for Audience
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = String(evt.target?.result || "");
      const lines = text.split(/\r?\n/).filter(Boolean);
      const parsed: Array<{ name?: string; phone: string }> = [];

      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
        if (!parts[0]) continue;
        if (i === 0 && /phone|mobile|number|name/i.test(parts.join(" "))) continue;

        let phone = parts[0];
        let name = parts[1] || "";
        if (/\D/.test(parts[0]) && /^\+?\d{8,15}$/.test(parts[1])) {
          name = parts[0];
          phone = parts[1];
        }

        const clean = phone.replace(/[^\d+]/g, "");
        if (clean.length >= 8) {
          parsed.push({ name, phone: clean });
        }
      }

      if (parsed.length === 0) {
        toast.error("No valid phone numbers found in CSV");
        return;
      }

      setSelectedContacts((prev) => {
        const set = new Map(prev.map((c) => [c.phone, c]));
        parsed.forEach((c) => set.set(c.phone, c));
        return Array.from(set.values());
      });

      toast.success(`Imported ${parsed.length} contacts from CSV`);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  // Launch Broadcast
  const handleSend = async () => {
    if (!wsId || !selectedTemplate) {
      toast.error("Please pick a template");
      return;
    }
    if (!broadcastName.trim()) {
      toast.error("Please enter a broadcast name");
      return;
    }
    if (selectedContacts.length === 0) {
      toast.error("Please select at least 1 contact or upload an audience");
      return;
    }

    setSending(true);
    try {
      const { data: camp, error } = await supabase
        .from("campaigns" as any)
        .insert({
          workspace_id: wsId,
          name: broadcastName.trim(),
          template_id: selectedTemplate.id,
          total_count: selectedContacts.length,
          status: scheduleType === "later" ? "scheduled" : "sending",
          scheduled_at: scheduleType === "later" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          metadata: {
            audience_preview: selectedContacts.slice(0, 10),
            template_name: selectedTemplate.name,
          },
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(
        scheduleType === "later"
          ? `Broadcast scheduled for ${selectedContacts.length} recipients`
          : `Broadcast launched for ${selectedContacts.length} recipients!`,
      );

      setWizardStep(0);
      setSelectedContacts([]);
      setSelectedTemplate(null);
      setBroadcastName("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create broadcast");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Wizard Progress Bar when creating new broadcast */}
        {wizardStep > 0 && (
          <div className="flex items-center justify-center gap-3 sm:gap-8 pb-4 border-b text-xs sm:text-sm font-medium">
            <div
              className={`flex items-center gap-2 ${
                wizardStep === 1
                  ? "text-foreground font-bold"
                  : wizardStep > 1
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  wizardStep === 1
                    ? "bg-slate-900 text-white dark:bg-white dark:text-black font-bold"
                    : wizardStep > 1
                      ? "bg-emerald-500 text-white"
                      : "border"
                }`}
              >
                {wizardStep > 1 ? "✓" : "1"}
              </span>
              <span>Select Template</span>
            </div>

            <div className="w-8 sm:w-16 h-0.5 bg-muted" />

            <div
              className={`flex items-center gap-2 ${
                wizardStep === 2
                  ? "text-foreground font-bold"
                  : wizardStep > 2
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  wizardStep === 2
                    ? "bg-slate-900 text-white dark:bg-white dark:text-black font-bold"
                    : wizardStep > 2
                      ? "bg-emerald-500 text-white"
                      : "border"
                }`}
              >
                {wizardStep > 2 ? "✓" : "2"}
              </span>
              <span>Select Audience</span>
            </div>

            <div className="w-8 sm:w-16 h-0.5 bg-muted" />

            <div
              className={`flex items-center gap-2 ${
                wizardStep === 3 ? "text-foreground font-bold" : "text-muted-foreground"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  wizardStep === 3 ? "bg-slate-900 text-white dark:bg-white dark:text-black font-bold" : "border"
                }`}
              >
                3
              </span>
              <span>Schedule Broadcast</span>
            </div>
          </div>
        )}

        {/* STEP 1: SELECT TEMPLATE (Image 116) */}
        {wizardStep === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setWizardStep(0)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold">Select Template</h2>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{waCred?.verified_name || waCred?.label || "The Kapa"}</span>
                </div>

                <div className="relative w-64">
                  <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search by name"
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    className="pl-8 h-9 text-xs"
                  />
                </div>

                <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
                  <a href="/templates/new" target="_blank" rel="noopener noreferrer">
                    + New Template <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredTemplates.map((t) => (
                <Card
                  key={t.id}
                  onClick={() => {
                    setSelectedTemplate(t);
                    setBroadcastName(`${t.name}_${new Date().toLocaleDateString("en-GB").replace(/\//g, "")}`);
                    setWizardStep(2);
                  }}
                  className="p-4 rounded-xl border flex flex-col justify-between hover:border-slate-900 dark:hover:border-slate-100 hover:shadow-md cursor-pointer transition-all bg-card group relative"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-bold text-xs truncate text-foreground">{t.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] py-0 px-1.5">
                        Approved
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 px-1.5 uppercase font-medium text-muted-foreground"
                      >
                        {t.category || "Utility"}
                      </Badge>
                    </div>

                    {/* WhatsApp Chat Bubble Mockup */}
                    <div className="bg-muted/40 dark:bg-muted/20 p-3 rounded-lg border text-xs text-foreground space-y-2 font-sans relative">
                      {t.header_media_url && (
                        <img src={t.header_media_url} alt="" className="w-full h-28 rounded object-cover mb-2 border" />
                      )}
                      <p className="text-foreground leading-relaxed line-clamp-6 whitespace-pre-wrap font-sans">
                        {renderTemplateWithPills(t.body_text)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-4 pt-2.5 border-t">
                    <span className="font-semibold uppercase">{t.language?.toUpperCase() || "EN"}</span>
                    <span>{t.created_at_label || "Active"}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: SELECT AUDIENCE */}
        {wizardStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setWizardStep(1)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-xl font-bold">Select Audience</h2>
                <p className="text-xs text-muted-foreground">
                  Using template: <span className="font-semibold text-foreground">{selectedTemplate?.name}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-5 border space-y-3 bg-card hover:border-foreground/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Upload CSV File</h3>
                    <p className="text-xs text-muted-foreground">Upload any file with phone numbers</p>
                  </div>
                </div>

                <div className="border-2 border-dashed rounded-xl p-6 text-center space-y-2">
                  <Upload className="w-6 h-6 text-muted-foreground mx-auto" />
                  <p className="text-xs font-medium">Click to upload or drag & drop CSV</p>
                  <p className="text-[11px] text-muted-foreground">Columns: phone, name (optional)</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleCsvUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose CSV File
                  </Button>
                </div>
              </Card>

              <Card className="p-5 border space-y-3 bg-card flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Select from CRM Leads</h3>
                      <p className="text-xs text-muted-foreground">{leads.length} contacts saved in workspace</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2">
                    <span className="text-muted-foreground">Currently selected:</span>
                    <Badge variant="secondary" className="font-bold">
                      {selectedContacts.length} Recipients
                    </Badge>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => {
                      const all = leads.map((l) => ({ name: l.full_name || "", phone: l.phone }));
                      setSelectedContacts(all);
                      toast.success(`Selected all ${all.length} CRM contacts`);
                    }}
                  >
                    Select All ({leads.length})
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedContacts([])}>
                    Clear
                  </Button>
                </div>
              </Card>
            </div>

            {/* Contacts Table Preview */}
            <Card className="p-4 border space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">CRM Contacts Preview</h3>
                <span className="text-xs text-muted-foreground">{selectedContacts.length} selected</span>
              </div>

              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="text-xs">
                      <TableHead className="w-10">Select</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {leads.map((l) => {
                      const isSelected = selectedContacts.some((c) => c.phone === l.phone);
                      return (
                        <TableRow key={l.id} className="hover:bg-muted/30">
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedContacts((prev) => [...prev, { name: l.full_name || "", phone: l.phone }]);
                                } else {
                                  setSelectedContacts((prev) => prev.filter((c) => c.phone !== l.phone));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{l.full_name || "Guest"}</TableCell>
                          <TableCell>{l.phone}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {l.source || "organic"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>

            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" onClick={() => setWizardStep(1)}>
                Back to Templates
              </Button>
              <Button
                disabled={selectedContacts.length === 0}
                onClick={() => setWizardStep(3)}
                className="bg-slate-900 hover:bg-black text-white dark:bg-white dark:text-black"
              >
                Continue to Schedule ({selectedContacts.length} recipients)
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: SCHEDULE BROADCAST */}
        {wizardStep === 3 && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setWizardStep(2)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-xl font-bold">Schedule Broadcast</h2>
                <p className="text-xs text-muted-foreground">Review your campaign details and send</p>
              </div>
            </div>

            <Card className="p-6 border space-y-5 bg-card">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Broadcast Name</Label>
                <Input
                  value={broadcastName}
                  onChange={(e) => setBroadcastName(e.target.value)}
                  placeholder="e.g. Diwali_Offer_Batch_1"
                  className="text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 border text-xs">
                <div>
                  <span className="text-muted-foreground">Template:</span>
                  <div className="font-bold text-foreground mt-0.5">{selectedTemplate?.name}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Audience:</span>
                  <div className="font-bold text-foreground mt-0.5">{selectedContacts.length} Recipients</div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-semibold">Sending Time</Label>
                <RadioGroup
                  value={scheduleType}
                  onValueChange={(v) => setScheduleType(v as "now" | "later")}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-muted/20 cursor-pointer">
                    <RadioGroupItem value="now" id="now" />
                    <Label htmlFor="now" className="cursor-pointer text-xs font-medium">
                      Send immediately
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-muted/20 cursor-pointer">
                    <RadioGroupItem value="later" id="later" />
                    <Label htmlFor="later" className="cursor-pointer text-xs font-medium">
                      Schedule for later
                    </Label>
                  </div>
                </RadioGroup>

                {scheduleType === "later" && (
                  <div className="pt-2">
                    <Label className="text-[11px] text-muted-foreground">Date & Time</Label>
                    <Input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="text-xs mt-1"
                    />
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setWizardStep(2)}>
                  Back
                </Button>
                <Button
                  className="flex-1 bg-slate-900 hover:bg-black text-white dark:bg-white dark:text-black gap-2 font-medium"
                  disabled={sending}
                  onClick={handleSend}
                >
                  <Send className="w-4 h-4" />
                  {sending ? "Launching..." : scheduleType === "later" ? "Schedule Broadcast" : "Send Now"}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* STEP 0: DASHBOARD / BROADCAST LIST VIEW (Images 114 & 115) */}
        {wizardStep === 0 && (
          <div className="space-y-6">
            {/* Header: Title, Channel Selector, Signal Tower, + New Broadcast Button */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Broadcast</h1>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Channel Selector Pill */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card text-xs font-medium shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{waCred?.verified_name || waCred?.label || "The Kapa"}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </div>

                {/* Refresh Button */}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => load()}
                  title="Refresh Data"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>

                {/* 10k Broadcast Signal Tower (Right Top next to Button) */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-emerald-500/10 border-emerald-500/20 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                  <span>Today's Limit: 0 / 10K</span>
                  <div className="flex items-end gap-0.5 h-3.5">
                    <span className="w-1 h-1 bg-emerald-500 rounded-sm" />
                    <span className="w-1 h-2 bg-emerald-500 rounded-sm" />
                    <span className="w-1 h-2.5 bg-emerald-500 rounded-sm" />
                    <span className="w-1 h-3.5 bg-emerald-500 rounded-sm" />
                  </div>
                  <span className="font-bold text-emerald-600">Green</span>
                </div>

                {/* + New Broadcast Primary Button (Solid Black Turbodev Style) */}
                <Button
                  onClick={() => setWizardStep(1)}
                  className="bg-slate-900 hover:bg-black text-white dark:bg-white dark:text-black dark:hover:bg-slate-200 gap-2 font-medium shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4" /> New Broadcast
                </Button>
              </div>
            </div>

            {/* Overview Section with 6 KPI Cards (Image 114) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base">Overview</h3>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-36 h-8 text-xs bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="last_7_days">Last 7 days</SelectItem>
                    <SelectItem value="last_30_days">Last 30 days</SelectItem>
                    <SelectItem value="this_week">This week</SelectItem>
                    <SelectItem value="this_month">This month</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 6 KPI Cards Single Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card className="p-3.5 border bg-card space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
                    <Users className="w-3.5 h-3.5" /> RECIPIENTS
                  </div>
                  <p className="text-xl font-bold text-foreground">{overviewTotals.recipients}</p>
                </Card>

                <Card className="p-3.5 border bg-card space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
                    <Check className="w-3.5 h-3.5" /> SENT
                  </div>
                  <p className="text-xl font-bold text-foreground">
                    {overviewTotals.sent}{" "}
                    <span className="text-xs font-normal text-muted-foreground">({overviewTotals.sentPct}%)</span>
                  </p>
                </Card>

                <Card className="p-3.5 border bg-card space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" /> DELIVERED
                  </div>
                  <p className="text-xl font-bold text-foreground">
                    {overviewTotals.delivered}{" "}
                    <span className="text-xs font-normal text-muted-foreground">({overviewTotals.deliveredPct}%)</span>
                  </p>
                </Card>

                <Card className="p-3.5 border bg-card space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" /> READ
                  </div>
                  <p className="text-xl font-bold text-foreground">
                    {overviewTotals.read}{" "}
                    <span className="text-xs font-normal text-muted-foreground">({overviewTotals.readPct}%)</span>
                  </p>
                </Card>

                <Card className="p-3.5 border bg-card space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
                    <Send className="w-3.5 h-3.5 text-emerald-500" /> REPLIED
                  </div>
                  <p className="text-xl font-bold text-foreground">
                    {overviewTotals.replied}{" "}
                    <span className="text-xs font-normal text-muted-foreground">({overviewTotals.repliedPct}%)</span>
                  </p>
                </Card>

                <Card className="p-3.5 border bg-card space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
                    <span className="w-3.5 h-3.5 rounded-full bg-rose-500/20 text-rose-600 flex items-center justify-center text-[10px] font-bold">
                      !
                    </span>{" "}
                    FAILED
                  </div>
                  <p className="text-xl font-bold text-foreground">
                    {overviewTotals.failed}{" "}
                    <span className="text-xs font-normal text-muted-foreground">({overviewTotals.failedPct}%)</span>
                  </p>
                </Card>
              </div>
            </div>

            {/* All Broadcasts Table Section with Circular Gauges (Images 114 & 115) */}
            <Card className="p-5 border space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <h3 className="font-bold text-base">All Broadcasts</h3>

                <div className="relative w-72">
                  <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search by name"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-xs"
                  />
                </div>
              </div>

              <div className="border rounded-xl overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="text-xs">
                      <TableHead className="min-w-[180px]">Name</TableHead>
                      <TableHead className="text-center">Sent</TableHead>
                      <TableHead className="text-center">Delivered</TableHead>
                      <TableHead className="text-center">Read</TableHead>
                      <TableHead className="text-center">Reacted</TableHead>
                      <TableHead className="text-center">Replied</TableHead>
                      <TableHead className="text-center">Failed</TableHead>
                      <TableHead className="min-w-[140px]">Created</TableHead>
                      <TableHead className="w-10 text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {filteredBroadcasts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                          No broadcasts found. Click "+ New Broadcast" to launch your first WhatsApp campaign.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredBroadcasts.map((b) => {
                        const total = b.total_count || 1;
                        const sent = b.sent_count || 0;
                        const delivered = b.delivered_count || 0;
                        const read = b.read_count || 0;
                        const reacted = b.reacted_count || 0;
                        const replied = b.replied_count || 0;
                        const failed = b.failed_count || 0;

                        // Creator avatar initials & display name
                        const creatorName = b.creator_name || profile?.full_name || "Vishal Raaj";
                        const initials =
                          creatorName
                            .split(" ")
                            .map((p: string) => p[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase() || "VR";

                        const createdDate = b.created_at
                          ? new Date(b.created_at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              hour: "numeric",
                              minute: "numeric",
                              hour12: true,
                            })
                          : "9 Nov at 1:21 AM";

                        return (
                          <TableRow key={b.id} className="hover:bg-muted/30">
                            <TableCell className="font-semibold text-foreground">
                              <span
                                onClick={() => navigate(`/campaigns/${b.id}`)}
                                className="cursor-pointer hover:underline"
                              >
                                {b.name}
                              </span>
                            </TableCell>

                            {/* Sent */}
                            <TableCell className="text-center">
                              <CircularGauge
                                percent={Math.round((sent / total) * 100)}
                                count={sent}
                                color="stroke-slate-600 text-slate-700 dark:stroke-slate-400 dark:text-slate-300"
                              />
                            </TableCell>

                            {/* Delivered */}
                            <TableCell className="text-center">
                              <CircularGauge
                                percent={Math.round((delivered / total) * 100)}
                                count={delivered}
                                color="stroke-indigo-600 text-indigo-600"
                              />
                            </TableCell>

                            {/* Read */}
                            <TableCell className="text-center">
                              <CircularGauge
                                percent={Math.round((read / total) * 100)}
                                count={read}
                                color="stroke-blue-500 text-blue-500"
                              />
                            </TableCell>

                            {/* Reacted */}
                            <TableCell className="text-center">
                              <CircularGauge
                                percent={Math.round((reacted / total) * 100)}
                                count={reacted}
                                color="stroke-amber-500 text-amber-500"
                              />
                            </TableCell>

                            {/* Replied */}
                            <TableCell className="text-center">
                              <CircularGauge
                                percent={Math.round((replied / total) * 100)}
                                count={replied}
                                color="stroke-emerald-600 text-emerald-600"
                              />
                            </TableCell>

                            {/* Failed */}
                            <TableCell className="text-center">
                              <CircularGauge
                                percent={Math.round((failed / total) * 100)}
                                count={failed}
                                color="stroke-rose-500 text-rose-500"
                              />
                            </TableCell>

                            {/* Created By Column (Avatar + Name + Timestamp) */}
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold text-[11px] shrink-0 border border-amber-300/40">
                                  {initials}
                                </div>
                                <div className="leading-tight">
                                  <div className="font-medium text-foreground">{creatorName}</div>
                                  <div className="text-[10px] text-muted-foreground">{createdDate}</div>
                                </div>
                              </div>
                            </TableCell>

                            {/* Actions Dropdown Menu (Image 115) */}
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 text-xs">
                                  <DropdownMenuItem
                                    onClick={() => handleRepeatBroadcast(b)}
                                    className="gap-2 cursor-pointer py-2"
                                  >
                                    <Repeat className="w-4 h-4 text-muted-foreground" />
                                    <span>Repeat Broadcast</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDownloadReport(b)}
                                    className="gap-2 cursor-pointer py-2"
                                  >
                                    <Download className="w-4 h-4 text-muted-foreground" />
                                    <span>Download Broadcast Report</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Table Pagination Bar */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                <div className="flex items-center gap-2">
                  <span>Show rows per page</span>
                  <Select defaultValue="20">
                    <SelectTrigger className="w-16 h-7 text-xs bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3">
                  <span>
                    Showing 1 - {filteredBroadcasts.length} of {items.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled>
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
