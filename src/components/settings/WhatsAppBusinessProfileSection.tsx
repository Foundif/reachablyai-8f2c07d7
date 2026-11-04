import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import WhatsAppBusinessProfile from './WhatsAppBusinessProfile';

/** Loads the active workspace's WhatsApp credentials and renders the business profile editor. */
const WhatsAppBusinessProfileSection = () => {
  const { user, profile } = useAuth();
  const [wsId, setWsId] = useState<string | null>(null);
  const [creds, setCreds] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      let id = (profile as any)?.active_workspace_id as string | undefined;
      if (!id) {
        const { data } = await supabase.from('workspace_members' as any).select('workspace_id').eq('user_id', user.id).limit(1);
        id = (data as any)?.[0]?.workspace_id;
      }
      if (!alive || !id) return;
      setWsId(id);
      const { data: c } = await supabase.from('whatsapp_credentials' as any).select('*').eq('workspace_id', id).maybeSingle();
      if (alive) setCreds(c);
    })();
    return () => { alive = false; };
  }, [user, profile]);

  if (!wsId) return null;
  return (
    <WhatsAppBusinessProfile
      key={wsId}
      workspaceId={wsId}
      credentialId={creds?.id}
      connected={creds?.status === 'connected' || Boolean(creds?.verified)}
      fallbackName={creds?.verified_name || profile?.store_name || 'Business'}
      cachedProfile={{
        profile_picture_url: creds?.profile_picture_url || '',
        address: creds?.profile_address || '',
        description: creds?.profile_description || '',
        email: creds?.profile_email || '',
        vertical: creds?.profile_vertical || 'OTHER',
        websites: creds?.profile_websites?.length ? creds.profile_websites : [''],
        about: creds?.profile_about || '',
      }}
    />
  );
};

export default WhatsAppBusinessProfileSection;
