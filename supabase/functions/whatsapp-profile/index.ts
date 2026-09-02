import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GRAPH_VERSION = 'v20.0';
const PROFILE_FIELDS = 'about,address,description,email,profile_picture_url,vertical,websites';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) return json({ error: 'Backend is not configured' }, 500);

    const client = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(url, serviceKey);
    const { data: userResult } = await client.auth.getUser();
    if (!userResult?.user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const workspaceId = typeof body?.workspace_id === 'string' ? body.workspace_id : '';
    const action = typeof body?.action === 'string' ? body.action : 'get';
    if (!workspaceId) return json({ error: 'workspace_id required' }, 400);

    const { data: membership } = await client
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userResult.user.id)
      .maybeSingle();
    const { data: owned } = membership ? { data: null } : await client
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('owner_id', userResult.user.id)
      .maybeSingle();
    if (!membership && !owned) return json({ error: 'Workspace access denied' }, 403);

    const { data: creds } = await admin
      .from('whatsapp_credentials')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (!creds?.access_token || !creds?.phone_number_id) {
      return json({ error: 'Connect WhatsApp before editing the business profile' }, 400);
    }

    const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${creds.phone_number_id}/whatsapp_business_profile`;
    const graphHeaders = { Authorization: `Bearer ${creds.access_token}` };

    if (action === 'get') {
      const response = await fetch(`${endpoint}?fields=${PROFILE_FIELDS}`, { headers: graphHeaders });
      const result = await response.json();
      if (!response.ok) return json({ error: result?.error?.message || 'Could not load WhatsApp profile' }, response.status);
      const profile = result?.data?.[0] || {};
      await cacheProfile(admin, workspaceId, profile);
      return json({ profile });
    }

    if (action === 'update') {
      const incoming = body?.profile || {};
      const websites = Array.isArray(incoming.websites)
        ? incoming.websites.filter((value: unknown) => typeof value === 'string' && value.trim()).slice(0, 2)
        : [];
      const profile = {
        messaging_product: 'whatsapp',
        about: clean(incoming.about, 139),
        address: clean(incoming.address, 256),
        description: clean(incoming.description, 512),
        email: clean(incoming.email, 128),
        vertical: clean(incoming.vertical, 64) || 'OTHER',
        websites,
      };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { ...graphHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const result = await response.json();
      if (!response.ok || result?.success === false) return json({ error: result?.error?.message || 'Could not update WhatsApp profile' }, response.status || 400);
      await cacheProfile(admin, workspaceId, profile);
      return json({ success: true, profile });
    }

    if (action === 'upload_picture') {
      const fileBase64 = typeof body?.file_base64 === 'string' ? body.file_base64 : '';
      const fileType = body?.file_type === 'image/png' ? 'image/png' : 'image/jpeg';
      const raw = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
      if (!raw) return json({ error: 'Image file required' }, 400);
      const bytes = Uint8Array.from(atob(raw), (char) => char.charCodeAt(0));
      if (bytes.byteLength > 5 * 1024 * 1024) return json({ error: 'Image must be under 5 MB' }, 400);

      const appId = Deno.env.get('META_APP_ID');
      if (!appId) return json({ error: 'Meta app is not configured' }, 500);
      const createUpload = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${appId}/uploads?file_length=${bytes.byteLength}&file_type=${encodeURIComponent(fileType)}`,
        { method: 'POST', headers: graphHeaders },
      );
      const uploadSession = await createUpload.json();
      if (!createUpload.ok || !uploadSession?.id) return json({ error: uploadSession?.error?.message || 'Could not start image upload' }, createUpload.status);

      const upload = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${uploadSession.id}`, {
        method: 'POST',
        headers: { ...graphHeaders, file_offset: '0', 'Content-Type': 'application/octet-stream' },
        body: bytes,
      });
      const uploaded = await upload.json();
      if (!upload.ok || !uploaded?.h) return json({ error: uploaded?.error?.message || 'Could not upload image' }, upload.status);

      const update = await fetch(endpoint, {
        method: 'POST',
        headers: { ...graphHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', profile_picture_handle: uploaded.h }),
      });
      const updateResult = await update.json();
      if (!update.ok || updateResult?.success === false) return json({ error: updateResult?.error?.message || 'Could not set profile picture' }, update.status);

      const refreshed = await fetch(`${endpoint}?fields=${PROFILE_FIELDS}`, { headers: graphHeaders });
      const refreshedBody = await refreshed.json();
      const profile = refreshedBody?.data?.[0] || {};
      await cacheProfile(admin, workspaceId, profile);
      return json({ success: true, profile });
    }

    return json({ error: 'Unsupported action' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

async function cacheProfile(admin: ReturnType<typeof createClient>, workspaceId: string, profile: Record<string, unknown>) {
  await admin.from('whatsapp_credentials').update({
    profile_picture_url: profile.profile_picture_url || null,
    profile_address: profile.address || null,
    profile_description: profile.description || null,
    profile_email: profile.email || null,
    profile_vertical: profile.vertical || null,
    profile_websites: Array.isArray(profile.websites) ? profile.websites : [],
    profile_about: profile.about || null,
    profile_synced_at: new Date().toISOString(),
  }).eq('workspace_id', workspaceId);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}