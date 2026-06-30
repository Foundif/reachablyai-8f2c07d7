import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TN45_FLOW_JSON } from '@/lib/tn45FlowJson';
import { Loader2, RefreshCw, Save, Rocket, CheckCircle2, AlertTriangle, Copy, ExternalLink } from 'lucide-react';

const FlowEditorPage = () => {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'save' | 'publish' | 'validate' | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [text, setText] = useState<string>(JSON.stringify(TN45_FLOW_JSON, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('meta-flow-manage', { body: { action: 'fetch' } });
    setLoading(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Failed to load flow');
      return;
    }
    setMeta(data.meta);
    if (data.flow_json) setText(JSON.stringify(data.flow_json, null, 2));
    toast.success('Loaded latest from Meta');
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const parsed = (() => {
    try { const v = JSON.parse(text); setParseError(null); return v; }
    catch (e: any) { setParseError(e.message); return null; }
  })();

  const save = async () => {
    if (!parsed) return toast.error('Fix JSON syntax first');
    setBusy('save');
    const { data, error } = await supabase.functions.invoke('meta-flow-manage', { body: { action: 'save', flow_json: parsed } });
    setBusy(null);
    if (error || data?.error) return toast.error(data?.error || error?.message || 'Save failed');
    toast.success('Saved as DRAFT on Meta');
    refresh();
  };

  const publish = async () => {
    setBusy('publish');
    const { data, error } = await supabase.functions.invoke('meta-flow-manage', { body: { action: 'publish' } });
    setBusy(null);
    if (error || data?.error) return toast.error(data?.error || error?.message || 'Publish failed');
    toast.success('Flow published live on WhatsApp');
    refresh();
  };

  const validate = async () => {
    setBusy('validate');
    const { data, error } = await supabase.functions.invoke('meta-flow-manage', { body: { action: 'validate' } });
    setBusy(null);
    if (error) return toast.error(error.message);
    const errs = data?.result?.validation_errors || [];
    if (errs.length === 0) toast.success('No validation errors');
    else toast.error(`${errs.length} validation error(s) — see panel`);
    setMeta((m: any) => ({ ...m, validation_errors: errs }));
  };

  const copyJson = () => { navigator.clipboard.writeText(text); toast.success('JSON copied'); };

  const status = String(meta?.status || '—').toUpperCase();
  const errs: any[] = meta?.validation_errors || [];

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">WhatsApp Flow Editor</h1>
            <p className="text-sm text-muted-foreground">Edit the live flow JSON. Save draft → Publish to push live on WhatsApp instantly.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status === 'PUBLISHED' ? 'default' : 'outline'}>{status}</Badge>
            {meta?.name && <span className="text-xs text-muted-foreground">{meta.name}</span>}
            <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Reload
            </Button>
            <a href="https://business.facebook.com/wa/manage/flows" target="_blank" rel="noopener noreferrer"
               className="text-xs text-primary inline-flex items-center gap-1">Meta <ExternalLink className="w-3 h-3" /></a>
          </div>
        </div>

        {parseError && (
          <Card className="p-3 bg-destructive/10 border-destructive/30 flex items-start gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div><b>JSON error:</b> {parseError}</div>
          </Card>
        )}

        {errs.length > 0 && (
          <Card className="p-3 bg-orange-500/10 border-orange-500/30 text-sm space-y-1">
            <div className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-500" />Meta validation errors</div>
            <ul className="list-disc list-inside text-xs text-muted-foreground">
              {errs.map((e, i) => <li key={i}>{e.message || JSON.stringify(e)}</li>)}
            </ul>
          </Card>
        )}

        {errs.length === 0 && meta && (
          <Card className="p-3 bg-green-500/10 border-green-500/30 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> No validation errors. Ready to publish.
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={busy !== null || !parsed}>
            {busy === 'save' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}Save Draft to Meta
          </Button>
          <Button onClick={publish} disabled={busy !== null} variant="default" className="bg-gradient-to-r from-primary to-secondary text-white border-0">
            {busy === 'publish' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Rocket className="w-4 h-4 mr-1" />}Publish Live
          </Button>
          <Button onClick={validate} disabled={busy !== null} variant="outline">
            {busy === 'validate' ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}Validate
          </Button>
          <Button onClick={copyJson} variant="outline"><Copy className="w-4 h-4 mr-1" />Copy</Button>
          <Button onClick={() => setText(JSON.stringify(TN45_FLOW_JSON, null, 2))} variant="ghost" className="text-xs">Reset to template</Button>
        </div>

        <Card className="p-0 overflow-hidden">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="font-mono text-xs leading-relaxed min-h-[600px] border-0 rounded-none resize-y"
          />
        </Card>

        <p className="text-xs text-muted-foreground">
          ⚡ Save Draft uploads <code>flow.json</code> as an asset to Meta. Publish promotes the draft live. Every edit is persisted on Meta — no manual copy-paste needed.
        </p>
      </div>
    </AppLayout>
  );
};

export default FlowEditorPage;
