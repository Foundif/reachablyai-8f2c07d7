import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const SEED = [
  { code: 'terminal_pickup', name_en: 'Terminal Pickup', name_ta: 'டெர்மினல் பிக்அப்', price: 200, category: 'terminal' },
  { code: 'terminal_drop', name_en: 'Terminal Drop', name_ta: 'டெர்மினல் டிராப்', price: 300, category: 'terminal' },
  { code: 'festivity_half', name_en: 'Festivity Half Day', name_ta: 'விழா அரை நாள்', price: 600, category: 'festivity', base_hours: 4 },
  { code: 'festivity_full', name_en: 'Festivity Full Day', name_ta: 'விழா முழு நாள்', price: 1200, category: 'festivity', base_hours: 8 },
  { code: 'hospital', name_en: 'Hospital Assist', name_ta: 'மருத்துவமனை உதவி', price: 500, category: 'medical' },
  { code: 'outstation', name_en: 'Outstation (per day)', name_ta: 'வெளியூர்', price: 1200, category: 'outstation' },
];

const TNServices = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from('tn_services').select('*').eq('user_id', user.id).order('category');
    setRows(data || []);
  };
  useEffect(() => { load(); }, [user]);

  const seed = async () => {
    if (!user) return;
    await supabase.from('tn_services').upsert(SEED.map(s => ({ ...s, user_id: user.id })), { onConflict: 'user_id,code' });
    toast.success('Seeded TN45 tariff');
    load();
  };

  const updatePrice = async (id: string, price: number) => {
    await supabase.from('tn_services').update({ price }).eq('id', id);
    load();
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-5">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <h1 className="text-2xl md:text-3xl font-bold">Services & Tariff</h1>
          <Button onClick={seed} variant="outline">Seed TN45 Tariff</Button>
        </div>
        {rows.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-muted-foreground mb-4">No services yet. Seed the TN45 default tariff to start.</p>
            <Button onClick={seed}>Seed Default Services</Button>
          </Card>
        ) : rows.map(s => (
          <Card key={s.id} className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-semibold">{s.name_en}</p>
              <p className="text-xs text-muted-foreground">{s.name_ta} • {s.category}</p>
            </div>
            <div className="flex items-center gap-2">
              <span>₹</span>
              <Input type="number" defaultValue={s.price} className="w-24" onBlur={(e) => updatePrice(s.id, Number(e.target.value))} />
            </div>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
};
export default TNServices;
