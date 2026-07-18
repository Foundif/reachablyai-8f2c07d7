import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, Megaphone, Send, ArrowLeft, Trash2 } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: string;
  template_id: string | null;
  total_count: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  replied_count: number;
  failed_count: number;
  created_at: string;
  scheduled_at: string | null;
}

interface Template {
  id: string; name: string; status: string; body: string; variables: string[];
}
interface Lead {
  id: string; name: string; phone: string | null; tags: string[]; status: string;
}
interface Recipient {
  id: string; phone: string; name: string | null; status: string; error: string | null; sent_at: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-500/15 text-slate-600',
  scheduled: 'bg-blue-500/15 text-blue-600',
  sending: 'bg-amber-500/15 text-amber-600',
  sent: 'bg-emerald-500/15 text-emerald-600',
  failed: 'bg-red-500/15 text-red-600',
  pending: 'bg-slate-500/15 text-slate-600',
  delivered: 'bg-blue-500/15 text-blue-600',
  read: 'bg-emerald-500/15 text-emerald-600',
  replied: 'bg-emerald-500/15 text-emerald-600',
};

async function getWorkspaceId(userId: string): Promise<string | null> {
  const { data } = await supabase.from('workspaces' as any)
    .select('id').eq('owner_id', userId).order('created_at').limit(1).maybeSingle();
  return (data as any)?.id || null;
}

const CampaignsList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [wsId, setWsId] = useState<string | null>(null);
  const [items, setItems] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', template_id: '' });
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const id = await getWorkspaceId(user.id);
    setWsId(id);
    if (!id) { setLoading(false); return; }
    const [{ data: cs }, { data: ts }, { data: ls }] = await Promise.all([
      supabase.from('campaigns' as any).select('*').eq('workspace_id', id).order('created_at', { ascending: false }),
      supabase.from('templates' as any).select('id,name,status,body,variables').eq('workspace_id', id).eq('status', 'approved'),
      supabase.from('leads' as any).select('id,name,phone,tags,status').eq('workspace_id', id).not('phone', 'is', null),
    ]);
    setItems((cs as any) || []);
    setTemplates((ts as any) || []);
    setLeads((ls as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user]);

  const create = async () => {
    if (!wsId) return;
    if (!form.name.trim()) return toast.error('Name required');
    if (!form.template_id) return toast.error('Pick an approved template');
    if (selectedLeadIds.length === 0) return toast.error('Select at least one lead');

    const { data: campaign, error } = await supabase.from('campaigns' as any)
      .insert({
        workspace_id: wsId,
        name: form.name.trim(),
        template_id: form.template_id,
        status: 'draft',
        total_count: selectedLeadIds.length,
        created_by: user!.id,
      })
      .select().single();
    if (error || !campaign) return toast.error(error?.message || 'Failed');

    const selectedLeads = leads.filter(l => selectedLeadIds.includes(l.id));
    const recipients = selectedLeads.map(l => ({
      campaign_id: (campaign as any).id,
      workspace_id: wsId,
      lead_id: l.id,
      phone: l.phone,
      name: l.name,
      variables: { name: l.name },
      status: 'pending',
    }));
    const { error: rErr } = await supabase.from('campaign_recipients' as any).insert(recipients);
    if (rErr) return toast.error(rErr.message);

    toast.success('Campaign created');
    setOpen(false);
    setForm({ name: '', template_id: '' });
    setSelectedLeadIds([]);
    navigate(`/campaigns/${(campaign as any).id}`);
  };

  const remove = async (id: string) => {
    if (!confirm('Delete campaign?')) return;
    const { error } = await supabase.from('campaigns' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Megaphone className="w-6 h-6" /> Campaigns
            </h1>
            <p className="text-muted-foreground text-sm">Send approved WhatsApp templates to segments of your leads.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" /> New Campaign</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Create campaign</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="August offer" /></div>
                <div>
                  <Label>Approved template</Label>
                  <Select value={form.template_id} onValueChange={v => setForm({ ...form, template_id: v })}>
                    <SelectTrigger><SelectValue placeholder={templates.length ? 'Select template' : 'No approved templates yet'} /></SelectTrigger>
                    <SelectContent>
                      {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {templates.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <Link className="underline" to="/templates">Create & approve a template</Link> first.
                    </p>
                  )}
                </div>
                <div>
                  <Label>Recipients ({selectedLeadIds.length} selected of {leads.length})</Label>
                  <div className="border rounded-md max-h-64 overflow-auto mt-1">
                    <div className="p-2 flex gap-2 border-b sticky top-0 bg-background">
                      <Button size="sm" variant="outline" onClick={() => setSelectedLeadIds(leads.map(l => l.id))}>Select all</Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedLeadIds([])}>Clear</Button>
                    </div>
                    {leads.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">No leads with phone numbers. Add leads first.</div>}
                    {leads.map(l => (
                      <label key={l.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer text-sm">
                        <Checkbox
                          checked={selectedLeadIds.includes(l.id)}
                          onCheckedChange={(c) => setSelectedLeadIds(prev => c ? [...prev, l.id] : prev.filter(x => x !== l.id))}
                        />
                        <span className="flex-1">{l.name}</span>
                        <span className="text-muted-foreground">{l.phone}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={create}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="overflow-hidden">
          {loading ? <div className="p-8 text-center text-muted-foreground">Loading…</div>
          : items.length === 0 ? (
            <div className="p-12 text-center">
              <Megaphone className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">No campaigns yet</p>
              <p className="text-sm text-muted-foreground">Create a campaign to reach many leads at once.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Status</TableHead>
                  <TableHead>Recipients</TableHead><TableHead>Sent</TableHead>
                  <TableHead>Delivered</TableHead><TableHead>Read</TableHead>
                  <TableHead>Failed</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(c => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/campaigns/${c.id}`)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell><Badge variant="outline" className={STATUS_STYLES[c.status]}>{c.status}</Badge></TableCell>
                    <TableCell>{c.total_count}</TableCell>
                    <TableCell>{c.sent_count}</TableCell>
                    <TableCell>{c.delivered_count}</TableCell>
                    <TableCell>{c.read_count}</TableCell>
                    <TableCell>{c.failed_count}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

export const CampaignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: c }, { data: r }] = await Promise.all([
      supabase.from('campaigns' as any).select('*').eq('id', id).maybeSingle(),
      supabase.from('campaign_recipients' as any).select('id,phone,name,status,error,sent_at').eq('campaign_id', id).order('created_at'),
    ]);
    setCampaign(c as any);
    setRecipients((r as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const dispatch = async () => {
    if (!campaign) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('campaign-dispatch', { body: { campaign_id: campaign.id } });
    setSending(false);
    if (error) return toast.error(error.message || 'Dispatch failed');
    const summary = data as any;
    if (summary?.error) return toast.error(summary.error);
    toast.success(`Dispatched: ${summary?.sent || 0} sent, ${summary?.failed || 0} failed`);
    load();
  };

  const stats = useMemo(() => {
    if (!campaign) return null;
    return [
      { l: 'Total', v: campaign.total_count },
      { l: 'Sent', v: campaign.sent_count },
      { l: 'Delivered', v: campaign.delivered_count },
      { l: 'Read', v: campaign.read_count },
      { l: 'Replied', v: campaign.replied_count },
      { l: 'Failed', v: campaign.failed_count },
    ];
  }, [campaign]);

  if (loading) return <AppLayout><div className="p-8">Loading…</div></AppLayout>;
  if (!campaign) return <AppLayout><div className="p-8">Campaign not found.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate('/campaigns')}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <Badge variant="outline" className={STATUS_STYLES[campaign.status]}>{campaign.status}</Badge>
          <div className="ml-auto">
            {['draft', 'failed'].includes(campaign.status) && (
              <Button onClick={dispatch} disabled={sending} className="gap-2">
                <Send className="w-4 h-4" /> {sending ? 'Sending…' : 'Send now'}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {stats!.map(s => (
            <Card key={s.l} className="p-4">
              <div className="text-xs text-muted-foreground">{s.l}</div>
              <div className="text-2xl font-bold">{s.v}</div>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Phone</TableHead>
                <TableHead>Status</TableHead><TableHead>Sent at</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipients.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.name || '—'}</TableCell>
                  <TableCell>{r.phone}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_STYLES[r.status]}>{r.status}</Badge></TableCell>
                  <TableCell className="text-xs">{r.sent_at ? new Date(r.sent_at).toLocaleString() : '—'}</TableCell>
                  <TableCell className="text-xs text-red-600 max-w-xs truncate">{r.error || ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppLayout>
  );
};

export default CampaignsList;
