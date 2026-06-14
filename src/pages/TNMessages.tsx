import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const TNMessages = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { (async () => {
    if (!user) return;
    const { data } = await supabase.from('tn_messages').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200);
    setRows(data || []);
  })(); }, [user]);
  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold">Messages</h1>
        {rows.map(m => (
          <Card key={m.id} className="p-3">
            <div className="flex items-center gap-2 text-xs">
              <Badge variant={m.direction === 'in' ? 'default' : 'secondary'}>{m.direction}</Badge>
              <span className="text-muted-foreground">{m.wa_id}</span>
              <span className="text-muted-foreground ml-auto">{new Date(m.created_at).toLocaleString()}</span>
            </div>
            <pre className="text-xs mt-2 bg-muted p-2 rounded overflow-auto max-h-32">{JSON.stringify(m.payload, null, 2)}</pre>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
};
export default TNMessages;
