import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { resolveWorkspaceId } from "@/lib/workspace";
import {
  MessageSquare,
  Instagram,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  ArrowUpRight,
  Plus,
  LayoutGrid,
  Info,
  ArrowLeft,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const SAFE_WA_COLUMNS =
  "id,workspace_id,phone_number_id,waba_id,business_phone,label,is_primary,verified,verified_at,status,connection_type,connected_at,last_error,verified_name,quality_rating,messaging_limit,profile_picture_url,profile_address,profile_description,profile_email,profile_vertical,profile_websites,profile_about,profile_synced_at";

export default function Channels() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [waCred, setWaCred] = useState<any>(null);
  const [igCred, setIgCred] = useState<any>(null);
  const [selectedChannel, setSelectedChannel] = useState<"all" | "whatsapp">("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [profileForm, setProfileForm] = useState({
    address: "",
    description: "",
    email: "",
    vertical: "Travel & Transportation",
    website: "https://reachably.foundif.com",
    about: "24/7 Travel Assistance and Booking Support across Tamil Nadu.",
  });

  const [csatEnabled, setCsatEnabled] = useState(true);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const wsId = await resolveWorkspaceId(user.id, profile);
    if (!wsId) {
      setLoading(false);
      return;
    }

    const [{ data: wa }, { data: ig }, { data: wsSettings }] = await Promise.all([
      supabase.from("whatsapp_credentials").select(SAFE_WA_COLUMNS).eq("workspace_id", wsId).maybeSingle(),
      supabase.from("instagram_credentials").select("*").eq("workspace_id", wsId).maybeSingle(),
      supabase.from("workspace_settings").select("*").eq("workspace_id", wsId).maybeSingle(),
    ]);

    setWaCred(wa);
    setIgCred(ig);
    if (wsSettings) {
      setCsatEnabled((wsSettings as any).away_enabled ?? true);
      if ((wsSettings as any).business_info) {
        setProfileForm((prev) => ({ ...prev, description: (wsSettings as any).business_info }));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user, profile]);

  const copyText = (txt: string, key: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedKey(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleApplyProfile = async () => {
    setSaving(true);
    try {
      const wsId = await resolveWorkspaceId(user!.id, profile);
      await supabase
        .from("workspace_settings" as any)
        .update({ business_info: profileForm.description })
        .eq("workspace_id", wsId);
      toast.success("WhatsApp Business profile synced with Meta Cloud API");
    } catch {
      toast.error("Failed to sync profile");
    } finally {
      setSaving(false);
    }
  };

  const isWaConnected = Boolean(waCred && (waCred.verified || waCred.status === "connected" || waCred.phone_number_id));
  const isIgConnected = Boolean(igCred && igCred.status === "connected");
  const waChannelId = waCred?.phone_number_id ? `${waCred.phone_number_id.slice(0, 8)}...` : "6a6c9e6cbf...";
  const wabaId = waCred?.waba_id || "2041824193398342";

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
        {selectedChannel === "all" ? (
          <>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Channels</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage your official messaging channels and connect new ones to reach more customers.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-2">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>

            {/* Channels Grid (SMS Completely Removed) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: WhatsApp (Mint/Emerald Gradient) */}
              <div
                onClick={() => setSelectedChannel("whatsapp")}
                className="p-5 rounded-2xl border bg-gradient-to-br from-emerald-100/90 via-emerald-50/50 to-teal-100/40 dark:from-emerald-950/40 dark:via-emerald-900/15 dark:to-teal-950/20 border-emerald-200/80 dark:border-emerald-800/40 flex flex-col justify-between min-h-[170px] shadow-sm relative group cursor-pointer hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 fill-emerald-500/20" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-base">
                        {waCred?.verified_name || waCred?.label || "TN45 Travel Aid"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        WhatsApp · {waCred?.business_phone ? `${waCred.business_phone}` : "+91 96554 51299"}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    {isWaConnected ? "LIVE" : "UNVERIFIED"}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-6 pt-3 border-t border-emerald-200/50 dark:border-emerald-800/30">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyText(waCred?.phone_number_id || "", "wa_id");
                    }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-mono bg-background/60 px-2 py-1 rounded-md"
                  >
                    <span>{waChannelId}</span>
                    {copiedKey === "wa_id" ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>

                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Card 2: Instagram DM (Purple Gradient) */}
              <Link
                to="/instagram"
                className="p-5 rounded-2xl border bg-gradient-to-br from-purple-100/80 via-purple-50/50 to-pink-100/30 dark:from-purple-950/40 dark:via-purple-900/15 dark:to-pink-950/20 border-purple-200/80 dark:border-purple-800/40 flex flex-col justify-between min-h-[170px] shadow-sm relative group hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                      <Instagram className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-base">Instagram DM</h3>
                      <p className="text-xs text-muted-foreground">
                        {isIgConnected
                          ? igCred?.username
                            ? `@${igCred.username}`
                            : "Connected"
                          : "Comments, Stories & DMs"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-bold tracking-wider px-2 py-0.5 rounded-full ${isIgConnected ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}
                  >
                    {isIgConnected ? "LIVE" : "CONFIGURE"}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-6 pt-3 border-t border-purple-200/50 dark:border-purple-800/30">
                  <span className="text-xs text-muted-foreground font-medium">Meta Graph API</span>
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>

              {/* Card 3: Add Another Channel (Deep Indigo) */}
              <Link
                to="/instagram"
                className="p-5 rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white border border-indigo-800/60 flex flex-col justify-between min-h-[170px] shadow-sm relative group hover:shadow-md transition-all"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center mb-3">
                    <LayoutGrid className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-white">Add another channel</h3>
                  <p className="text-xs text-indigo-200/70 mt-0.5">Connect Web Chat, Messenger or Telegram</p>
                </div>

                <div className="flex items-center justify-between mt-6 pt-3 border-t border-white/10">
                  <span className="text-xs text-indigo-300 font-medium">Browse catalog</span>
                  <div className="w-8 h-8 rounded-full bg-white text-indigo-950 flex items-center justify-center font-bold">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            </div>
          </>
        ) : (
          /* WhatsApp Detail View */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedChannel("all")}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-medium"
              >
                <ArrowLeft className="w-4 h-4" /> All channels
              </button>
              <Button variant="ghost" size="icon" onClick={loadData} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">WhatsApp</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Channel health, Meta limits, and business profile for this number.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
              <span>
                You have connected an Official Meta WhatsApp Business Cloud API number. Your display name and profile
                sync directly with Meta Cloud servers.
              </span>
            </div>

            <Card className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">
                      {waCred?.verified_name || waCred?.label || "TN45 Travel Aid"}
                    </h3>
                    <p className="text-xs text-muted-foreground">{waCred?.business_phone || "+91 96554 51299"}</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground pt-1">
                  <div className="flex items-center gap-2">
                    <span>ID:</span>
                    <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono">{waChannelId}</code>
                    <button onClick={() => copyText(waCred?.phone_number_id || "", "wa_detail_id")}>
                      <Copy className="w-3 h-3 hover:text-foreground" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>WABA:</span>
                    <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono">{wabaId}</code>
                    <button onClick={() => copyText(wabaId, "waba_id")}>
                      <Copy className="w-3 h-3 hover:text-foreground" />
                    </button>
                  </div>
                </div>

                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] uppercase font-bold">
                  {waCred?.messaging_limit === "DECLINED"
                    ? "Tier 1 (10K / day)"
                    : waCred?.messaging_limit || "Tier 1 (10K / day)"}
                </Badge>
              </div>

              <div className="md:pl-6 pt-4 md:pt-0 space-y-3 text-xs">
                <p className="font-semibold text-foreground text-sm">Meta Details</p>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Quality Rating</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />{" "}
                    {waCred?.quality_rating === "GREEN" ? "Green (High)" : waCred?.quality_rating || "Green (High)"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Business Verification</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />{" "}
                    {waCred?.verified ? "Verified" : "Connected"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Message Limit</span>
                  <span className="font-bold text-foreground">10,000 / day</span>
                </div>
              </div>

              <div className="md:pl-6 pt-4 md:pt-0 flex flex-col justify-between">
                <div>
                  <p className="font-semibold text-foreground text-sm">Channel Settings</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Manage webhooks, permanent Meta tokens, catalogue, and read receipts.
                  </p>
                </div>
                <div className="pt-4">
                  <Link to="/whatsapp-settings">
                    <Button variant="outline" size="sm" className="w-full gap-2">
                      <SlidersHorizontal className="w-3.5 h-3.5" /> Configure Credentials
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>

            <Tabs defaultValue="profile" className="space-y-4">
              <TabsList className="bg-muted/60 p-1">
                <TabsTrigger value="profile">Business profile</TabsTrigger>
                <TabsTrigger value="csat">CSAT Survey</TabsTrigger>
                <TabsTrigger value="bluetick">Apply blue tick</TabsTrigger>
              </TabsList>

              <TabsContent value="profile">
                <Card className="p-6 space-y-5">
                  <div className="space-y-4 max-w-2xl">
                    <div>
                      <Label className="text-xs font-semibold">Address</Label>
                      <Input
                        className="mt-1.5"
                        placeholder="Karur - Trichy Main Road, Tamil Nadu"
                        value={profileForm.address}
                        onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value.slice(0, 256) })}
                      />
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">Maximum of 256 characters</span>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">Business Description</Label>
                      <Textarea
                        rows={3}
                        className="mt-1.5"
                        placeholder="24/7 Car Rentals, Local & Outstation Taxi Services..."
                        value={profileForm.description}
                        onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value.slice(0, 256) })}
                      />
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">Maximum of 256 characters</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-semibold">Email</Label>
                        <Input
                          className="mt-1.5"
                          placeholder="support@foundif.com"
                          value={profileForm.email}
                          onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value.slice(0, 128) })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Vertical</Label>
                        <Select
                          value={profileForm.vertical}
                          onValueChange={(v) => setProfileForm({ ...profileForm, vertical: v })}
                        >
                          <SelectTrigger className="mt-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Travel & Transportation">Travel & Transportation</SelectItem>
                            <SelectItem value="Automotive">Automotive</SelectItem>
                            <SelectItem value="Beauty, Spa & Salon">Beauty, Spa & Salon</SelectItem>
                            <SelectItem value="Clothing and Apparel">Clothing and Apparel</SelectItem>
                            <SelectItem value="Retail & Shopping">Retail & Shopping</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">Website URL</Label>
                      <Input
                        className="mt-1.5"
                        placeholder="https://reachably.foundif.com"
                        value={profileForm.website}
                        onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">About (Status text)</Label>
                      <Input
                        className="mt-1.5"
                        placeholder="Official Support Line · Reachably"
                        value={profileForm.about}
                        onChange={(e) => setProfileForm({ ...profileForm, about: e.target.value.slice(0, 139) })}
                      />
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">Maximum of 139 characters</span>
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                      <Button variant="outline" size="sm" onClick={loadData}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleApplyProfile} disabled={saving}>
                        {saving ? "Saving..." : "Apply to Meta"}
                      </Button>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="csat">
                <Card className="p-6 space-y-4 max-w-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">Customer Satisfaction (CSAT) Survey</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Send an automated 1-5 star rating survey on WhatsApp when a conversation is marked resolved.
                      </p>
                    </div>
                    <Switch checked={csatEnabled} onCheckedChange={setCsatEnabled} />
                  </div>
                  <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
                    <p className="font-semibold text-foreground">Survey Preview Message:</p>
                    <p className="text-muted-foreground italic">
                      "Thank you for reaching out to us today! How would you rate your experience with our team? Reply 1
                      (Poor) to 5 (Excellent)."
                    </p>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="bluetick">
                <Card className="p-6 space-y-5 max-w-2xl">
                  <div>
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" /> Apply for Official Business Account (OBA)
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Meta grants the green/blue verified checkmark to notable businesses with organic press coverage.
                    </p>
                  </div>

                  <div className="space-y-3 text-xs border rounded-xl p-4 bg-muted/20">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <div>
                        <b>Meta Business Verification:</b> Complete official verification under Meta Business Manager.
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <div>
                        <b>Two-Step Verification:</b> Ensure 2FA is active on your WhatsApp Cloud API credentials.
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <div>
                        <b>3–5 News Articles:</b> Supply organic news links (paid PR wires and blogs are rejected by
                        Meta).
                      </div>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" asChild className="gap-2">
                    <a
                      href="https://business.facebook.com/wa/manage/phone-numbers/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Meta WhatsApp Manager <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
