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
} from "lucide-react";
import { resolveWorkspaceId } from "@/lib/workspace";
import ConfirmDialog from "@/components/ConfirmDialog";

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
    <div className="flex items-center gap-2">
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
  const [dateRange, setDateRange] = useState("last_month");
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
        .from("templates" as any)
        .select("*")
        .eq("workspace_id", id)
        .eq("status", "approved"),
      supabase.from("leads").select("id,name,phone,tags,created_at").eq("workspace_id", id).limit(500),
      supabase
        .from("whatsapp_credentials")
        .select("verified_name,label,business_phone,status,verified")
        .eq("workspace_id", id)
        .maybeSingle(),
    ]);

    setItems((camps as any[]) || []);
    setTemplates((tmpls as any[]) || []);
    setLeads((lds as any[]) || []);
    setWaCred(wa);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user, profile]);

  // Totals for Overview KPIs
  const overviewTotals = useMemo(() => {
    const recipients = items.reduce((s, i) => s + (i.total_count || 0), 0);
    const sent = items.reduce((s, i) => s + (i.sent_count || 0), 0);
    const delivered = items.reduce((s, i) => s + (i.delivered_count || 0), 0);
    const read = items.reduce((s, i) => s + (i.read_count || 0), 0);
    const replied = items.reduce((s, i) => s + (i.replied_count || 0), 0);
    const failed = items.reduce((s, i) => s + (i.failed_count || 0), 0);

    const calcPct = (num: number) => (recipients > 0 ? Math.round((num / recipients) * 100) : 0);

    return {
      recipients,
      sent,
      sentPct: calcPct(sent),
      delivered,
      deliveredPct: calcPct(delivered),
      read,
      readPct: calcPct(read),
      replied,
      repliedPct: calcPct(replied),
      failed,
      failedPct: calcPct(failed),
    };
  }, [items]);

  // Filtered Broadcasts
  const filteredBroadcasts = useMemo(() => {
    return items.filter((b) => b.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [items, searchQuery]);

  // Filtered Templates for Step 1
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => t.name?.toLowerCase().includes(templateSearch.toLowerCase()));
  }, [templates, templateSearch]);

  // Handle CSV file upload
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      const parsed: Array<{ name?: string; phone: string }> = [];

      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split(/[;,,\t]/).map((s) => s.trim().replace(/^["']|["']$/g, ""));
        const rawPhone = parts[0]?.replace(/[^\d+]/g, "");
        if (rawPhone && rawPhone.length >= 10) {
          parsed.push({
            phone: rawPhone,
            name: parts[1] || undefined,
          });
        }
      }

      if (parsed.length === 0) {
        toast.error("No valid contacts found in CSV");
        return;
      }

      setSelectedContacts(parsed);
      toast.success(`Loaded ${parsed.length} contacts from CSV!`);
    };
    reader.readAsText(file);
  };

  // Launch / Schedule Broadcast
  const handleSendBroadcast = async () => {
    if (!wsId || !user) return;
    if (!broadcastName.trim()) {
      toast.error("Please enter a broadcast name");
      return;
    }
    if (selectedContacts.length === 0) {
      toast.error("Please select at least 1 contact");
      return;
    }

    setSending(true);
    try {
      const { data: campaign, error } = await supabase
        .from("campaigns" as any)
        .insert({
          workspace_id: wsId,
          name: broadcastName.trim(),
          mode: "template",
          template_id: selectedTemplate?.id || null,
          min_delay_sec: 2,
          max_delay_sec: 5,
          status: scheduleType === "later" ? "scheduled" : "sending",
          scheduled_at: scheduleType === "later" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          total_count: selectedContacts.length,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Insert recipients in batch
      const recipientRows = selectedContacts.map((c) => ({
        campaign_id: (campaign as any).id,
        phone: c.phone,
        name: c.name || null,
        status: "pending",
      }));

      await supabase.from("campaign_recipients" as any).insert(recipientRows);

      toast.success(
        scheduleType === "later"
          ? "Broadcast scheduled successfully!"
          : "Broadcast queued! Messages will begin sending immediately.",
      );

      setWizardStep(0);
      load();
      navigate(`/campaigns/${(campaign as any).id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create broadcast");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* ============================================================== */}
        {/* WIZARD VIEW: 3-MILESTONE FLOW (Screens 111 & 113) */}
        {/* ============================================================== */}
        {wizardStep > 0 ? (
          <div className="space-y-6">
            {/* Top Stepper Bar */}
            <div className="flex items-center justify-center gap-3 py-3 border-b text-xs sm:text-sm font-medium">
              <div
                onClick={() => setWizardStep(1)}
                className={`flex items-center gap-2 cursor-pointer ${
                  wizardStep === 1
                    ? "text-purple-600 font-bold"
                    : wizardStep > 1
                      ? "text-purple-600"
                      : "text-muted-foreground"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    wizardStep > 1
                      ? "bg-purple-600 text-white"
                      : wizardStep === 1
                        ? "border-2 border-purple-600 text-purple-600 font-bold"
                        : "border border-muted-foreground text-muted-foreground"
                  }`}
                >
                  {wizardStep > 1 ? <Check className="w-3.5 h-3.5" /> : "1"}
                </div>
                <span>Select Template</span>
              </div>

              <div className="w-10 sm:w-16 h-0.5 bg-muted" />

              <div
                onClick={() => selectedTemplate && setWizardStep(2)}
                className={`flex items-center gap-2 ${
                  wizardStep === 2
                    ? "text-purple-600 font-bold"
                    : wizardStep > 2
                      ? "text-purple-600"
                      : "text-muted-foreground"
                } ${selectedTemplate ? "cursor-pointer" : "opacity-60"}`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    wizardStep > 2
                      ? "bg-purple-600 text-white"
                      : wizardStep === 2
                        ? "border-2 border-purple-600 text-purple-600 font-bold"
                        : "border border-muted-foreground text-muted-foreground"
                  }`}
                >
                  {wizardStep > 2 ? <Check className="w-3.5 h-3.5" /> : "2"}
                </div>
                <span>Select Audience</span>
              </div>

              <div className="w-10 sm:w-16 h-0.5 bg-muted" />

              <div
                onClick={() => selectedTemplate && selectedContacts.length > 0 && setWizardStep(3)}
                className={`flex items-center gap-2 ${
                  wizardStep === 3 ? "text-purple-600 font-bold" : "text-muted-foreground"
                } ${selectedContacts.length > 0 ? "cursor-pointer" : "opacity-60"}`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    wizardStep === 3
                      ? "border-2 border-purple-600 text-purple-600 font-bold"
                      : "border border-muted-foreground text-muted-foreground"
                  }`}
                >
                  3
                </div>
                <span>Schedule Broadcast</span>
              </div>
            </div>

            {/* STEP 1: SELECT TEMPLATE (Image 111) */}
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
                      <span>{waCred?.verified_name || waCred?.label || "TN45 Travel Aid"}</span>
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

                {filteredTemplates.length === 0 ? (
                  <div className="text-center py-16 border rounded-2xl bg-muted/20 space-y-3">
                    <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
                    <p className="font-semibold text-sm">No approved WhatsApp templates found</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Create and submit a template to Meta Cloud API to start sending broadcasts.
                    </p>
                    <Button size="sm" asChild>
                      <a href="/templates/new" target="_blank" rel="noopener noreferrer">
                        Create Template
                      </a>
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {filteredTemplates.map((t) => (
                      <Card
                        key={t.id}
                        onClick={() => {
                          setSelectedTemplate(t);
                          setBroadcastName(`${t.name}_${new Date().toLocaleDateString("en-GB").replace(/\//g, "")}`);
                          setWizardStep(2);
                        }}
                        className="p-4 rounded-xl border flex flex-col justify-between hover:border-purple-600 hover:shadow-md cursor-pointer transition-all bg-card group relative"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <span className="font-bold text-xs truncate text-foreground">{t.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mb-3">
                            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] py-0 px-1.5">
                              Approved
                            </Badge>
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 uppercase font-medium">
                              {t.category || "Marketing"}
                            </Badge>
                          </div>

                          {/* WhatsApp Chat Bubble Mockup */}
                          <div className="bg-muted/40 dark:bg-muted/20 p-3 rounded-lg border text-xs text-foreground space-y-2 font-sans relative">
                            {t.header_media_url && (
                              <SecureImg
                                src={t.header_media_url}
                                alt=""
                                className="w-full h-24 rounded object-cover mb-2"
                              />
                            )}
                            <p className="text-muted-foreground leading-relaxed line-clamp-4 whitespace-pre-wrap">
                              {t.body_text || "Your broadcast announcement preview text."}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-4 pt-2.5 border-t">
                          <span>{t.language?.toUpperCase() || "EN"}</span>
                          <span>Active</span>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: SELECT AUDIENCE (Image 113) */}
            {wizardStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setWizardStep(1)}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-xl font-bold">Select Audience</h2>
                </div>

                {/* Upload Contacts from CSV Card */}
                <Card className="p-5 border space-y-3">
                  <p className="font-semibold text-sm">Upload Contacts from CSV</p>
                  <div className="p-4 rounded-xl border border-dashed bg-muted/20 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">
                          Broadcast customized messages to your contacts available in your CSV file
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Format: Phone number (column 1), Full name (column 2)
                        </p>
                      </div>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={handleCsvUpload}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2 text-xs"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-600" /> Upload Contacts
                    </Button>
                  </div>
                </Card>

                <div className="relative text-center">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <span className="relative bg-background px-4 text-xs uppercase font-semibold text-muted-foreground">
                    OR
                  </span>
                </div>

                {/* Pick from CRM Segments / All Leads */}
                <Card className="p-5 border space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <p className="font-semibold text-sm">Pick from Segments & CRM Leads</p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const allValid = leads.filter((l) => l.phone).map((l) => ({ phone: l.phone, name: l.name }));
                          setSelectedContacts(allValid);
                          toast.success(`Selected all ${allValid.length} active CRM leads`);
                        }}
                        className="text-xs"
                      >
                        Select All CRM Leads ({leads.length})
                      </Button>
                    </div>
                  </div>

                  <div className="border rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="text-xs">
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedContacts.length > 0 && selectedContacts.length === leads.length}
                              onCheckedChange={(chk) => {
                                if (chk) {
                                  setSelectedContacts(leads.map((l) => ({ phone: l.phone, name: l.name })));
                                } else {
                                  setSelectedContacts([]);
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead>Lead Name</TableHead>
                          <TableHead>Phone Number</TableHead>
                          <TableHead>Tags</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {leads.slice(0, 10).map((l) => {
                          const isSelected = selectedContacts.some((c) => c.phone === l.phone);
                          return (
                            <TableRow key={l.id}>
                              <TableCell>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(chk) => {
                                    if (chk) {
                                      setSelectedContacts((prev) => [...prev, { phone: l.phone, name: l.name }]);
                                    } else {
                                      setSelectedContacts((prev) => prev.filter((c) => c.phone !== l.phone));
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{l.name || "Customer"}</TableCell>
                              <TableCell className="font-mono text-muted-foreground">{l.phone}</TableCell>
                              <TableCell>
                                {(l.tags || ["Lead"]).map((tag: string, idx: number) => (
                                  <Badge key={idx} variant="outline" className="text-[10px] py-0 px-1.5 mr-1">
                                    {tag}
                                  </Badge>
                                ))}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Card>

                {/* Sticky Bottom Bar */}
                <div className="p-4 rounded-xl border bg-card flex items-center justify-between flex-wrap gap-3 shadow-sm">
                  <p className="text-xs text-muted-foreground">
                    These segments update dynamically according to the filters. Click "View count" to verify.
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold">
                      {selectedContacts.length === 0
                        ? "No Audience Selected"
                        : `${selectedContacts.length} Contacts Selected`}
                    </span>
                    <Button
                      size="sm"
                      disabled={selectedContacts.length === 0}
                      onClick={() => setWizardStep(3)}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: SCHEDULE BROADCAST */}
            {wizardStep === 3 && (
              <div className="space-y-6 max-w-4xl mx-auto">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setWizardStep(2)}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-xl font-bold">Schedule Broadcast</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  <Card className="md:col-span-7 p-6 space-y-5 border">
                    <div>
                      <Label className="text-xs font-semibold">Broadcast Name</Label>
                      <Input
                        value={broadcastName}
                        onChange={(e) => setBroadcastName(e.target.value)}
                        placeholder="e.g. Diwali 2026 Batch 3"
                        className="mt-1.5"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs font-semibold">Sending Time</Label>
                      <RadioGroup
                        value={scheduleType}
                        onValueChange={(v: "now" | "later") => setScheduleType(v)}
                        className="space-y-2"
                      >
                        <div className="flex items-center space-x-2 border p-3 rounded-lg cursor-pointer">
                          <RadioGroupItem value="now" id="r-now" />
                          <Label htmlFor="r-now" className="cursor-pointer text-xs flex-1">
                            <span className="font-semibold block text-sm">Send Immediately</span>
                            <span className="text-muted-foreground">Start sending messages as soon as confirmed</span>
                          </Label>
                        </div>

                        <div className="flex items-center space-x-2 border p-3 rounded-lg cursor-pointer">
                          <RadioGroupItem value="later" id="r-later" />
                          <Label htmlFor="r-later" className="cursor-pointer text-xs flex-1">
                            <span className="font-semibold block text-sm">Schedule for Later</span>
                            <span className="text-muted-foreground">Pick a specific date and time</span>
                          </Label>
                        </div>
                      </RadioGroup>

                      {scheduleType === "later" && (
                        <div className="pt-2">
                          <Label className="text-xs font-semibold">Schedule Date & Time</Label>
                          <Input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            className="mt-1.5"
                          />
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Review Summary Column */}
                  <Card className="md:col-span-5 p-6 space-y-4 border bg-muted/10">
                    <p className="font-bold text-sm">Broadcast Summary</p>

                    <div className="space-y-2 text-xs divide-y">
                      <div className="flex justify-between py-1.5">
                        <span className="text-muted-foreground">Template</span>
                        <span className="font-semibold">{selectedTemplate?.name}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-muted-foreground">Recipients</span>
                        <span className="font-bold text-foreground">{selectedContacts.length} contacts</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-muted-foreground">Channel</span>
                        <span className="font-medium text-emerald-600">WhatsApp (Official Meta API)</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-muted-foreground">Tier Limit</span>
                        <span className="font-medium">10,000 / day</span>
                      </div>
                    </div>

                    <div className="pt-4 space-y-2">
                      <Button
                        onClick={handleSendBroadcast}
                        disabled={sending}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-2"
                      >
                        <Send className="w-4 h-4" />
                        {sending
                          ? "Processing..."
                          : scheduleType === "later"
                            ? "Schedule Broadcast"
                            : "Send Broadcast Now"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setWizardStep(2)} className="w-full text-xs">
                        Back to Audience
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ============================================================== */
          /* MAIN BROADCAST PAGE (Screen 112) */
          /* ============================================================== */
          <div className="space-y-6">
            {/* Top Bar Header with Signal Tower & Actions */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Broadcast</h1>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Channel Selector */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card text-xs font-medium cursor-pointer shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{waCred?.verified_name || waCred?.label || "TN45 Travel Aid"}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </div>

                {/* Refresh Icon Button */}
                <Button variant="outline" size="icon" onClick={load} disabled={loading} className="h-9 w-9">
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
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

                {/* + New Broadcast Primary Button */}
                <Button
                  onClick={() => setWizardStep(1)}
                  className="bg-purple-600 hover:bg-purple-700 text-white gap-2 font-medium"
                >
                  <Plus className="w-4 h-4" /> New Broadcast
                </Button>
              </div>
            </div>

            {/* Overview Section with 6 KPI Cards (Image 112) */}
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
                    <SelectItem value="last_week">Last week</SelectItem>
                    <SelectItem value="this_month">This month</SelectItem>
                    <SelectItem value="last_month">Last month</SelectItem>
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

            {/* All Broadcasts Table Section with Circular Gauges */}
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
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Delivered</TableHead>
                      <TableHead>Read</TableHead>
                      <TableHead>Reacted</TableHead>
                      <TableHead>Replied</TableHead>
                      <TableHead className="w-12 text-right">Action</TableHead>
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
                        const replied = b.replied_count || 0;

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

                            <TableCell>
                              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] py-0.5">
                                {b.status === "draft" ? "Draft" : b.status === "sending" ? "Sending" : "Completed"}
                              </Badge>
                            </TableCell>

                            <TableCell className="font-medium">
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <Users className="w-3.5 h-3.5" />
                                <b className="text-foreground">{b.total_count}</b>
                              </span>
                            </TableCell>

                            <TableCell>
                              <CircularGauge
                                percent={Math.round((sent / total) * 100)}
                                count={sent}
                                color="stroke-slate-700 text-slate-700"
                              />
                            </TableCell>

                            <TableCell>
                              <CircularGauge
                                percent={Math.round((delivered / total) * 100)}
                                count={delivered}
                                color="stroke-blue-600 text-blue-600"
                              />
                            </TableCell>

                            <TableCell>
                              <CircularGauge
                                percent={Math.round((read / total) * 100)}
                                count={read}
                                color="stroke-purple-600 text-purple-600"
                              />
                            </TableCell>

                            <TableCell>
                              <CircularGauge percent={0} count={0} color="stroke-amber-500 text-amber-500" />
                            </TableCell>

                            <TableCell>
                              <CircularGauge
                                percent={Math.round((replied / total) * 100)}
                                count={replied}
                                color="stroke-emerald-600 text-emerald-600"
                              />
                            </TableCell>

                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigate(`/campaigns/${b.id}`)}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
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
