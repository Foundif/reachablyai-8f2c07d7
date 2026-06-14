import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ShoppingBag, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

type Product = { id: string; name: string; price: number; sku: string; desc: string; image?: string };
const STORAGE = 'foundif_catalog';

const Catalog = () => {
  const [items, setItems] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', price: '', sku: '', desc: '', image: '' });

  useEffect(() => { setItems(JSON.parse(localStorage.getItem(STORAGE) || '[]')); }, []);
  useEffect(() => { localStorage.setItem(STORAGE, JSON.stringify(items)); }, [items]);

  const save = () => {
    if (!f.name || !f.price) return toast.error('Name and price required');
    setItems((p) => [...p, { id: crypto.randomUUID(), name: f.name, price: Number(f.price), sku: f.sku, desc: f.desc, image: f.image }]);
    toast.success('Product added to catalog'); setOpen(false); setF({ name: '', price: '', sku: '', desc: '', image: '' });
  };
  const remove = (id: string) => { setItems((p) => p.filter((x) => x.id !== id)); toast.success('Removed'); };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-primary" /> WhatsApp Catalog
            </h1>
            <p className="text-sm text-muted-foreground">Products you can share in conversations and broadcasts.</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> Add product</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.length === 0 && <div className="sm:col-span-2 lg:col-span-4 text-center text-sm text-muted-foreground py-12">No products yet.</div>}
          {items.map((p) => (
            <div key={p.id} className="glass-panel overflow-hidden flex flex-col">
              <div className="aspect-square bg-muted/40 flex items-center justify-center">
                {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <ImageIcon className="w-10 h-10 text-muted-foreground" />}
              </div>
              <div className="p-3 flex-1 flex flex-col">
                <p className="font-semibold text-sm truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">{p.sku || 'No SKU'}</p>
                <p className="font-bold mt-1">₹{p.price}</p>
                <Button variant="ghost" size="sm" onClick={() => remove(p.id)} className="mt-2 text-destructive"><Trash2 className="w-3.5 h-3.5" /> Remove</Button>
              </div>
            </div>
          ))}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>New product</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Product name" />
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="Price (₹)" />
                <Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} placeholder="SKU" />
              </div>
              <Input value={f.image} onChange={(e) => setF({ ...f, image: e.target.value })} placeholder="Image URL (optional)" />
              <Textarea value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} placeholder="Description" rows={3} />
            </div>
            <DialogFooter><Button onClick={save}>Add product</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};
export default Catalog;
