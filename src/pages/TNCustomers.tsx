import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle } from 'lucide-react';

const formatWhatsAppPhone = (waId: string) => {
  const digits = String(waId || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return waId?.startsWith('+') ? waId : `+${waId}`;
};

const TNCustomers = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from('tn_customers').select('*').eq('user_id', user.id).order('last_seen_at', { ascending: false });
      setRows(data || []);
    };
    load();

    const channel = supabase
      .channel(`customers-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tn_customers', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);
  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold">Customers</h1>
        {rows.length === 0 ? <Card className="p-10 text-center text-muted-foreground">No customers yet.</Card> :
          rows.map(c => (
            <Card key={c.id} className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt={c.name || c.wa_id} className="w-10 h-10 rounded-full object-cover bg-muted border border-border" loading="lazy" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"><MessageCircle className="w-5 h-5" /></div>
                )}
                <div className="min-w-0"><p className="font-semibold truncate">{c.name || 'Unnamed'}</p><p className="text-sm text-muted-foreground truncate">{formatWhatsAppPhone(c.wa_id)}</p></div>
              </div>
              <p className="text-xs text-muted-foreground">{new Date(c.last_seen_at).toLocaleString()}</p>
            </Card>
          ))}
      </div>
    </AppLayout>
  );
};
export default TNCustomers;
