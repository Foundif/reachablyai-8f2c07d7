import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Instagram } from 'lucide-react';
export default function InstagramMetrics({wsId}:{wsId:string|null}) {
 const [stats,setStats] = useState<number[]|null>(null), [error,setError] = useState(''), [retry,setRetry] = useState(0);
 useEffect(()=>{
  if(!wsId) return;
  const controller = new AbortController(); const timeout = setTimeout(()=>controller.abort(),10000);
  setError('');setStats(null);
  const since = new Date(Date.now()-30*86400000).toISOString();
  const count = async (query: any) => { const result = await query.abortSignal(controller.signal); if(result.error) throw result.error; return result.count || 0; };
  Promise.all([
   count(supabase.from('wa_conversations').select('id',{count:'exact',head:true}).eq('workspace_id',wsId).eq('channel','instagram').is('deleted_at',null)),
   count(supabase.from('leads').select('id',{count:'exact',head:true}).eq('workspace_id',wsId).eq('source','instagram').gte('created_at',since)),
   count(supabase.from('auto_reply_log').select('id',{count:'exact',head:true}).eq('workspace_id',wsId).like('rule_kind','ig_%').gte('sent_at',since)),
   count(supabase.from('wa_conversations').select('id',{count:'exact',head:true}).eq('workspace_id',wsId).eq('channel','instagram').is('deleted_at',null).gt('window_expires_at',new Date().toISOString())),
  ]).then(values=>{if(!controller.signal.aborted)setStats(values);}).catch(()=>{if(!controller.signal.aborted)setError('Instagram numbers could not be loaded.');});
  controller.signal.addEventListener('abort',()=>setError('Instagram request timed out.'));
  return ()=>{clearTimeout(timeout);controller.abort();};
 },[wsId,retry]);
 return <section className="space-y-3"><h2 className="font-semibold flex items-center gap-2"><Instagram className="w-4 h-4"/>Instagram <span className="text-xs font-normal text-muted-foreground">Last 30 days</span></h2>{error?<div role="alert" className="text-sm text-destructive">{error} <Button size="sm" variant="outline" onClick={()=>setRetry(n=>n+1)}>Retry</Button></div>:<div className="grid grid-cols-2 md:grid-cols-4 gap-3">{['Total chats','New contacts','Rule replies','Open reply windows'].map((label,i)=><Card key={label} className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-semibold mt-1">{stats?stats[i]:'—'}</p></Card>)}</div>}</section>;
}
