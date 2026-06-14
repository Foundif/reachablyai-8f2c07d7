import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const TNCustomers = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { (async () => {
    if (!user) return;
    const { data } = await supabase.from('tn_customers').select('*').eq('user_id', user.id).order('last_seen_at', { ascending: false });
    setRows(data || []);
  })(); }, [user]);
  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-4">
        <h1 className="text-2xl md:text-3xl font-bold">Customers</h1>
        {rows.length === 0 ? <Card className="p-10 text-center text-muted-foreground">No customers yet.</Card> :
          rows.map(c => (
            <Card key={c.id} className="p-4 flex justify-between">
              <div><p className="font-semibold">{c.name || 'Unnamed'}</p><p className="text-sm text-muted-foreground">{c.wa_id}</p></div>
              <p className="text-xs text-muted-foreground">{new Date(c.last_seen_at).toLocaleString()}</p>
            </Card>
          ))}
      </div>
    </AppLayout>
  );
};
export default TNCustomers;
