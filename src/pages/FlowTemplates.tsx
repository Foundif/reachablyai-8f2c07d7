import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { can } from '@/lib/permissions';
import { toast } from 'sonner';
import { Library, Share2, Plus, Copy, Loader2, Globe, Lock, Sparkles, Tag, ArrowRight } from 'lucide-react';

type Template = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  nodes: any[];
  edges: any[];
  is_public: boolean;
  share_token: string | null;
  uses_count: number;
  updated_at: string;
};

const SEED: Pick<Template, 'name' | 'description' | 'category' | 'tags' | 'nodes' | 'edges'>[] = [
  { name: 'Welcome Series', description: 'Greet new contacts and qualify intent.', category: 'onboarding', tags: ['welcome','3-step'],
    nodes: [
      { id: 't1', type: 'trigger', position: { x: 80, y: 80 }, data: { label: 'New contact', triggerType: 'new_contact' } },
      { id: 'm1', type: 'message', position: { x: 280, y: 80 }, data: { label: 'Hello', body: 'Hi {{name}} — welcome! How can we help?' } },
      { id: 'w1', type: 'wait', position: { x: 480, y: 80 }, data: { label: '1 day', amount: 1, unit: 'days' } },
      { id: 'm2', type: 'message', position: { x: 680, y: 80 }, data: { label: 'Follow up', body: 'Quick check-in {{name}} — anything we can help with?' } },
    ],
    edges: [
      { id: 'e1', source: 't1', target: 'm1' },
      { id: 'e2', source: 'm1', target: 'w1' },
      { id: 'e3', source: 'w1', target: 'm2' },
    ],
  },
  { name: 'Abandoned Cart Recovery', description: 'Recover incomplete checkouts.', category: 'commerce', tags: ['cart','recovery'],
    nodes: [
      { id: 't1', type: 'trigger', position: { x: 80, y: 80 }, data: { label: 'Cart abandoned', triggerType: 'tag_added' } },
      { id: 'm1', type: 'message', position: { x: 280, y: 80 }, data: { label: 'Nudge', body: '{{name}}, forgot something? Your cart is waiting.' } },
      { id: 'b1', type: 'branch', position: { x: 480, y: 80 }, data: { label: 'Replied?', condition: "reply contains 'yes'" } },
      { id: 'a1', type: 'action', position: { x: 680, y: 40 }, data: { label: 'Tag warm', action: 'add_tag' } },
      { id: 'end', type: 'end', position: { x: 680, y: 160 }, data: { label: 'End' } },
    ],
    edges: [
      { id: 'e1', source: 't1', target: 'm1' },
      { id: 'e2', source: 'm1', target: 'b1' },
      { id: 'e3', source: 'b1', target: 'a1' },
    ],
  },
];

const FlowTemplates = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canCreate = can(role, 'template.create');
  const canShare = can(role, 'template.share');
  const canCreateFlow = can(role, 'flow.create');

  const [mine, setMine] = useState<Template[]>([]);
  const [community, setCommunity] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareTarget, setShareTarget] = useState<Template | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [own, pub] = await Promise.all([
      supabase.from('tn_flow_templates').select('*').eq('owner_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('tn_flow_templates').select('*').eq('is_public', true).neq('owner_id', user.id).order('uses_count', { ascending: false }).limit(20),
    ]);
    setMine((own.data as any) || []);
    setCommunity((pub.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const seedStarters = async () => {
    if (!user || !canCreate) return;
    const rows = SEED.map(s => ({ ...s, owner_id: user.id }));
    const { error } = await supabase.from('tn_flow_templates').insert(rows as any);
    if (error) { toast.error(error.message); return; }
    toast.success('Starter templates added');
    load();
  };

  const useTemplate = async (t: Template) => {
    if (!user || !canCreateFlow) { toast.error('No permission to create flows'); return; }
    const { data, error } = await supabase.from('tn_flows').insert({
      user_id: user.id,
      name: `${t.name} (copy)`,
      description: t.description || '',
      nodes: t.nodes as any,
      edges: t.edges as any,
    }).select('id').single();
    if (error) { toast.error(error.message); return; }
    await supabase.from('tn_flow_templates').update({ uses_count: (t.uses_count || 0) + 1 }).eq('id', t.id);
    toast.success('Flow created from template');
    navigate(`/flows/${(data as any).id}`);
  };

  const togglePublic = async (t: Template) => {
    if (!canShare) return;
    const newVal = !t.is_public;
    const patch: any = { is_public: newVal };
    if (newVal && !t.share_token) patch.share_token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const { error } = await supabase.from('tn_flow_templates').update(patch).eq('id', t.id);
    if (error) { toast.error(error.message); return; }
    toast.success(newVal ? 'Template is now public' : 'Template is private');
    load();
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/flows/templates?share=${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Share link copied');
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="relative overflow-hidden glass-elevated glass-sheen p-6 md:p-8">
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-foreground/5 blur-3xl animate-aurora" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel text-xs mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-muted-foreground">Templates Library</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Save, share and reuse <span className="aurora-text">high-performing</span><br className="hidden md:block"/>
                campaign structures.
              </h1>
              <p className="text-muted-foreground mt-2 text-sm max-w-2xl">
                Turn any flow into a template, share a public link, and clone the best designs across teams.
              </p>
            </div>
            {canCreate && (
              <Button onClick={seedStarters} variant="outline" className="border-foreground/20">
                <Plus className="w-4 h-4" /> Add starter templates
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="mine">
          <TabsList className="glass-panel">
            <TabsTrigger value="mine"><Library className="w-3.5 h-3.5 mr-1.5" />My templates</TabsTrigger>
            <TabsTrigger value="community"><Globe className="w-3.5 h-3.5 mr-1.5" />Community</TabsTrigger>
          </TabsList>

          <TabsContent value="mine" className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : mine.length === 0 ? (
              <div className="glass-panel p-10 text-center">
                <Library className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No templates yet. Save any flow as a template, or add starter packs above.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mine.map(t => (
                  <div key={t.id} className="glass-panel p-5 rounded-2xl">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-semibold truncate">{t.name}</div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.description}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{t.is_public ? 'Public' : 'Private'}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {t.tags?.map(tag => <Badge key={tag} variant="secondary" className="text-[10px]"><Tag className="w-2.5 h-2.5 mr-1" />{tag}</Badge>)}
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                      <span className="text-[10px] text-muted-foreground">{(t.nodes || []).length} nodes · {t.uses_count} uses</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setShareTarget(t)} disabled={!canShare}><Share2 className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => useTemplate(t)} disabled={!canCreateFlow}>Use <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="community" className="mt-4">
            {community.length === 0 ? (
              <div className="glass-panel p-10 text-center">
                <Globe className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No public templates shared yet.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {community.map(t => (
                  <div key={t.id} className="glass-panel p-5 rounded-2xl">
                    <div className="text-base font-semibold truncate">{t.name}</div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.description}</p>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                      <span className="text-[10px] text-muted-foreground">{t.uses_count} uses</span>
                      <Button size="sm" variant="ghost" onClick={() => useTemplate(t)} disabled={!canCreateFlow}>Use <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={!!shareTarget} onOpenChange={(o) => !o && setShareTarget(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Share template</DialogTitle></DialogHeader>
            {shareTarget && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Make this template discoverable in the community library and copyable via a share link.</p>
                <Button onClick={() => togglePublic(shareTarget)} className="w-full">
                  {shareTarget.is_public ? <><Lock className="w-4 h-4" />Make private</> : <><Globe className="w-4 h-4" />Make public</>}
                </Button>
                {shareTarget.is_public && shareTarget.share_token && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input readOnly value={`${window.location.origin}/flows/templates?share=${shareTarget.share_token}`} />
                      <Button variant="outline" onClick={() => copyLink(shareTarget.share_token!)}><Copy className="w-4 h-4" /></Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter />
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default FlowTemplates;
