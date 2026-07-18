import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) return json({ error: 'campaign_id required' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', campaign_id).maybeSingle();
    if (!campaign) return json({ error: 'Campaign not found' }, 404);

    const { data: template } = await supabase.from('templates').select('*').eq('id', campaign.template_id).maybeSingle();
    if (!template) return json({ error: 'Template not found' }, 404);
    if (template.status !== 'approved') return json({ error: 'Template not approved. Meta will reject the send.' }, 400);

    const { data: creds } = await supabase.from('whatsapp_credentials').select('*').eq('workspace_id', campaign.workspace_id).maybeSingle();
    if (!creds?.access_token || !creds?.phone_number_id) {
      return json({ error: 'WhatsApp Cloud API not configured. Set credentials in Settings first.' }, 400);
    }

    const { data: recipients } = await supabase.from('campaign_recipients').select('*').eq('campaign_id', campaign_id).in('status', ['pending', 'failed']);
    if (!recipients?.length) return json({ error: 'No pending recipients' }, 400);

    await supabase.from('campaigns').update({ status: 'sending', started_at: new Date().toISOString() }).eq('id', campaign_id);

    let sent = 0, failed = 0;
    for (const r of recipients) {
      // Build template components from variables
      const varNames: string[] = template.variables || [];
      const components = varNames.length > 0 ? [{
        type: 'body',
        parameters: varNames.map(v => ({ type: 'text', text: String((r.variables || {})[v] ?? '') })),
      }] : [];

      try {
        const resp = await fetch(`https://graph.facebook.com/v20.0/${creds.phone_number_id}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${creds.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: r.phone,
            type: 'template',
            template: {
              name: template.name,
              language: { code: template.language || 'en' },
              ...(components.length ? { components } : {}),
            },
          }),
        });
        const body = await resp.json();
        if (!resp.ok) {
          const err = body?.error?.message || `HTTP ${resp.status}`;
          await supabase.from('campaign_recipients').update({ status: 'failed', error: err }).eq('id', r.id);
          failed++;
        } else {
          const msgId = body?.messages?.[0]?.id || null;
          await supabase.from('campaign_recipients').update({ status: 'sent', meta_message_id: msgId, sent_at: new Date().toISOString(), error: null }).eq('id', r.id);
          sent++;
        }
      } catch (e) {
        await supabase.from('campaign_recipients').update({ status: 'failed', error: String(e) }).eq('id', r.id);
        failed++;
      }
    }

    const finalStatus = failed === recipients.length ? 'failed' : 'sent';
    await supabase.from('campaigns').update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
      sent_count: (campaign.sent_count || 0) + sent,
      failed_count: (campaign.failed_count || 0) + failed,
    }).eq('id', campaign_id);

    return json({ sent, failed });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
