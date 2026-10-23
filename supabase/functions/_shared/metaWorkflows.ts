import { buildTemplatePayload } from './templatePayload.ts';
import { checkMessageQuota } from './plans.ts';
import { reportPeriod, nextReport, summariseInsights } from './metaWorkflowRules.ts';
export const META_GRAPH='https://graph.facebook.com/v21.0';
export async function graph(path:string,token:string,params:Record<string,string>={},method='GET') {
  if(!token) throw new Error('Meta authorization is missing. Connect Meta or renew authorization.');
  const url=new URL(`${META_GRAPH}/${path}`); Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  const response=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});
  const body=await response.json(); if(!response.ok || body.error) throw new Error(body.error?.message||`Meta request failed (${response.status})`); return body;
}
export async function graphPages(path:string,token:string,params:Record<string,string>={},maxPages=10) {
  const rows:any[]=[];let after='';
  for(let i=0;i<maxPages;i++) { const body=await graph(path,token,{...params,limit:'100',...(after?{after}:{})}); rows.push(...(body.data||[]));
    if(!body.paging?.next) return rows; after=body.paging.cursors?.after||''; if(!after) throw new Error('Meta pagination incomplete; retry a smaller period.');
  }
  throw new Error('Meta response exceeds the bounded page limit; narrow the period before retrying.');
}
export async function clientTokens(admin:any,c:any) {
  const {data:privateRow,error}=await admin.from('meta_client_credentials').select('*').eq('client_id',c.id).maybeSingle(); if(error) throw error;
  if(privateRow?.expires_at && Date.parse(privateRow.expires_at)<Date.now()) throw new Error('Meta authorization expired. Reconnect Meta.');
  // Compatibility: use existing workspace connection on the server only, never expose its token.
  const {data:integration}=await admin.from('integrations').select('settings').eq('workspace_id',c.workspace_id).eq('provider','meta_lead_ads').maybeSingle();
  const settings=integration?.settings||{};
  return {user:privateRow?.user_token||settings.ads_access_token||settings.page_access_token||'',page:privateRow?.page_token||(String(settings.page_id)===c.page_id?settings.page_access_token:'')||'',settings};
}
export async function sendClientTemplate(admin:any,c:any,templateId:string,variables:Record<string,string>,leadName='') {
  if(!/^\+[1-9]\d{7,14}$/.test(c.destination)) throw new Error('Add a valid international WhatsApp destination.');
  const {data:tpl,error:tplError}=await admin.from('templates').select('*').eq('workspace_id',c.workspace_id).eq('id',templateId).maybeSingle();
  if(tplError || !tpl || String(tpl.status).toLowerCase()!=='approved') throw new Error('Select an approved WhatsApp template in this workspace.');
  const {data:connections,error}=await admin.from('whatsapp_credentials').select('*').eq('workspace_id',c.workspace_id).order('is_primary',{ascending:false}).limit(1);
  if(error) throw error; const creds=connections?.[0]; if(!creds?.access_token || !creds.phone_number_id) throw new Error('Connect a WhatsApp Business number before sending.');
  const quota=await checkMessageQuota(admin,c.workspace_id,1); if(!quota.ok) throw new Error(quota.reason);
  const template=buildTemplatePayload(tpl,{name:leadName||c.name,phone:c.destination.slice(1),variables});
  // The actual send is POST JSON (no probe result is treated as send success).
  const response=await fetch(`${META_GRAPH}/${creds.phone_number_id}/messages`,{method:'POST',headers:{Authorization:`Bearer ${creds.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:c.destination.slice(1),type:'template',template}),signal:AbortSignal.timeout(20000)});
  const body=await response.json(); if(!response.ok || !body.messages?.[0]?.id) throw new Error(body.error?.message||'WhatsApp did not return a message ID');
  const messageId=body.messages[0].id;
  const {data:existing,error:readError}=await admin.from('wa_conversations').select('id').eq('workspace_id',c.workspace_id).eq('contact_phone',c.destination.slice(1)).maybeSingle(); if(readError) throw readError;
  let conv=existing;
  if(!conv) {const result=await admin.from('wa_conversations').insert({workspace_id:c.workspace_id,contact_phone:c.destination.slice(1),contact_name:c.name}).select('id').single();if(result.error) throw new Error('WhatsApp accepted the message but conversation logging failed; do not resend automatically.');conv=result.data;}
  const {error:logError}=await admin.from('wa_messages').insert({workspace_id:c.workspace_id,conversation_id:conv.id,direction:'outbound',wa_message_id:messageId,from_phone:creds.business_phone,to_phone:c.destination.slice(1),body:`${tpl.name}: ${Object.values(variables).join(' · ')}`,message_type:'template',template_name:tpl.name,status:'sent'});
  if(logError) throw new Error('WhatsApp accepted the message but quota logging failed; do not resend automatically.');
  return messageId;
}
export async function completeRun(admin:any,id:string,changes:any) {const {error}=await admin.from('meta_workflow_runs').update({...changes,completed_at:new Date().toISOString()}).eq('id',id);if(error) throw error;}
export async function runReport(admin:any,c:any,scheduled=false) {
  if(c.archived_at) throw new Error('Client is archived');
  const period=reportPeriod(c);const key=scheduled?`${c.cadence}:${period.since}:${period.until}`:`manual:${crypto.randomUUID()}`;
  const {data:id,error}=await admin.rpc('claim_meta_workflow',{_client:c.id,_kind:'report',_key:key});if(error) throw error;if(!id) return {status:'already_processed'};
  try {
    if(!c.ad_account_id) throw new Error('Select an ad account');
    const tokens=await clientTokens(admin,c);
    const rows=await graphPages(`act_${c.ad_account_id}/insights`,tokens.user,{level:'campaign',time_range:JSON.stringify(period),fields:'spend,impressions,clicks,actions,account_currency'});
    const totals=summariseInsights(rows);const currency=rows[0]?.account_currency||'INR';
    const summary=c.kpis.map((k:string)=>`${k.toUpperCase()}: ${k==='cpl' && !totals.leads?'—':(totals as any)[k]}${['spend','cpl'].includes(k)?` ${currency}`:''}`).join(' | ');
    const messageId=await sendClientTemplate(admin,c,c.report_template_id,{'1':c.name,'2':`${period.since} to ${period.until}`,'3':summary});
    await completeRun(admin,id,{status:'accepted',message_id:messageId,metrics:{...totals,currency,period}});
    const update=await admin.from('meta_reporting_clients').update({last_error:null,...(scheduled?{next_report_at:nextReport(c)}:{})}).eq('id',c.id);if(update.error) throw update.error;
    return {status:'accepted',message_id:messageId};
  } catch(e) {const error=(e as Error).message;await completeRun(admin,id,{status:'failed',error});await admin.from('meta_reporting_clients').update({last_error:error,...(scheduled?{next_report_at:nextReport(c)}:{})}).eq('id',c.id);return {status:'failed',error};}
}
export async function processClientLead(admin:any,c:any,metaId:string,provided?:any) {
  if(c.archived_at || !c.lead_enabled) return {status:'paused'};
  const tokens=await clientTokens(admin,c);
  const lead=provided||await graph(metaId,tokens.page,{fields:'field_data,created_time,ad_name,adset_name,campaign_name,form_id'});
  if(c.form_ids.length && !c.form_ids.includes(String(lead.form_id))) return {status:'form_not_selected'};
  const {data:id,error}=await admin.rpc('claim_meta_workflow',{_client:c.id,_kind:'lead',_key:metaId});if(error) throw error;if(!id) return {status:'already_processed'};
  try {
    const answers:Record<string,string>={};for(const f of lead.field_data||[]) answers[f.name]=(f.values||[]).join(', ');
    const mapped:Record<string,string>={};const tags=['meta_ads',`client:${c.name}`];const norm=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]/g,'');
    for(const m of tokens.settings.field_map||[]) {const key=Object.keys(answers).find(k=>norm(k)===norm(m.question||''));if(key && answers[key]) {if(m.target==='tag') tags.push(...answers[key].split(',').map(t=>t.trim()).filter(Boolean));else mapped[m.target]=answers[key];}}
    const name=mapped.name||answers.full_name||answers.first_name||'Meta lead';let phone=(mapped.phone||answers.phone_number||'').replace(/[^\d]/g,'');if(phone.length===10) phone=(tokens.settings.country_code||'91')+phone;
    const email=mapped.email||answers.email||null;const city=mapped.city||answers.city;if(city) tags.push(`city:${city}`);
    const notes=Object.entries(answers).map(([k,v])=>`${k}: ${v}`).join('\n')+`\nMeta lead: ${metaId} | Client: ${c.name} | Campaign: ${lead.campaign_name||'-'}`;
    const lookup=phone||`meta-${metaId}`;
    const {data:old,error:readError}=await admin.from('leads').select('id,notes,tags').eq('workspace_id',c.workspace_id).eq('phone',lookup).maybeSingle();if(readError) throw readError;
    const payload={name,email,source:'meta_ads',notes:old?.notes?`${old.notes}\n\n${notes}`:notes,tags:[...new Set([...(old?.tags||[]),...tags])]};
    const saved=old?await admin.from('leads').update(payload).eq('id',old.id).select('id').single():await admin.from('leads').insert({...payload,workspace_id:c.workspace_id,phone:lookup,status:'new'}).select('id').single();if(saved.error) throw saved.error;
    await admin.from('meta_workflow_runs').update({lead_id:saved.data.id,metrics:{form_id:lead.form_id,origin:provided?'backup_reconciliation':'webhook'}}).eq('id',id);
    const messageId=await sendClientTemplate(admin,c,c.lead_template_id,{'1':name,'2':phone?`+${phone}`:'No phone supplied','3':lead.campaign_name||'Meta lead form'},name);
    await completeRun(admin,id,{status:'accepted',message_id:messageId,lead_id:saved.data.id});return {status:'accepted'};
  } catch(e) {await completeRun(admin,id,{status:'failed',error:(e as Error).message});return {status:'failed',error:(e as Error).message};}
}
