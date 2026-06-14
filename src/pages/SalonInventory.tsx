import { useState, useMemo, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/hooks/useCurrency';
import { useSuppliers } from '@/hooks/useSuppliers';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/data/mockData';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus, Search, Package, Loader2, Check, Trash2,
  AlertTriangle, Edit, ShoppingBag, TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useProducts } from '@/hooks/useProducts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SALON_CATEGORIES = ['hair_care', 'skin_care', 'makeup', 'nails', 'tools', 'accessories', 'consumables', 'other'];
const CATEGORY_LABELS: Record<string, string> = {
  hair_care: 'Hair Care', skin_care: 'Skin Care', makeup: 'Makeup',
  nails: 'Nails', tools: 'Tools', accessories: 'Accessories',
  consumables: 'Consumables', other: 'Other',
};

interface ProductForm {
  brand: string; model_name: string; category: string;
  color: string; purchase_price: string; selling_price: string;
  rack_location: string; barcode: string; supplier_id: string;
}

const emptyForm: ProductForm = {
  brand: '', model_name: '', category: 'hair_care',
  color: '', purchase_price: '', selling_price: '',
  rack_location: '', barcode: '', supplier_id: '',
};

const SalonInventory = () => {
  const { user } = useAuth();
  const { products, loading } = useProducts();
  const { suppliers } = useSuppliers();
  const currency = useCurrency();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [sizes, setSizes] = useState([{ size: 'default', quantity: '' }]);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('all');

  const filtered = useMemo(() => {
    let list = [...products];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.brand.toLowerCase().includes(q) ||
        p.model_name.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
      );
    }
    if (catFilter !== 'all') list = list.filter(p => p.category === catFilter);
    if (tab === 'low_stock') list = list.filter(p => (p.total_stock || 0) <= 5 && (p.total_stock || 0) > 0);
    if (tab === 'dead_stock') list = list.filter(p => (p.total_stock || 0) === 0);
    if (tab === 'out_of_stock') list = list.filter(p => (p.total_stock || 0) === 0);
    return list;
  }, [products, search, catFilter, tab]);

  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalStock = products.reduce((s, p) => s + (p.total_stock || 0), 0);
    const totalValue = products.reduce((s, p) => s + (p.total_stock || 0) * p.selling_price, 0);
    const lowStock = products.filter(p => (p.total_stock || 0) > 0 && (p.total_stock || 0) <= 5).length;
    const outOfStock = products.filter(p => (p.total_stock || 0) === 0).length;
    return { totalProducts, totalStock, totalValue, lowStock, outOfStock };
  }, [products]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.brand || !form.model_name) {
      toast.error('Please fill required fields'); return;
    }
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        brand: form.brand, model_name: form.model_name,
        category: form.category, gender: 'unisex',
        color: form.color || null,
        purchase_price: parseFloat(form.purchase_price) || 0,
        selling_price: parseFloat(form.selling_price) || 0,
        rack_location: form.rack_location || null,
        barcode: form.barcode || null,
        supplier_id: form.supplier_id || null,
      };

      if (editId) {
        const { error } = await supabase.from('products').update(payload).eq('id', editId);
        if (error) throw error;
        // Update sizes
        await supabase.from('product_sizes').delete().eq('product_id', editId);
        const validSizes = sizes.filter(s => s.size.trim());
        if (validSizes.length > 0) {
          await supabase.from('product_sizes').insert(
            validSizes.map(s => ({ product_id: editId, size: s.size.trim(), quantity: parseInt(s.quantity) || 0 }))
          );
        }
        toast.success('Product updated!');
        setEditOpen(false);
      } else {
        const { data: product, error } = await supabase.from('products').insert(payload).select().single();
        if (error) throw error;
        const validSizes = sizes.filter(s => s.size.trim());
        if (validSizes.length > 0) {
          await supabase.from('product_sizes').insert(
            validSizes.map(s => ({ product_id: product.id, size: s.size.trim(), quantity: parseInt(s.quantity) || 0 }))
          );
        }
        toast.success('Product added!');
        setAddOpen(false);
      }
      setForm(emptyForm);
      setSizes([{ size: 'default', quantity: '' }]);
      setEditId(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleEdit = (p: any) => {
    setForm({
      brand: p.brand, model_name: p.model_name, category: p.category,
      color: p.color || '', purchase_price: p.purchase_price.toString(),
      selling_price: p.selling_price.toString(), rack_location: p.rack_location || '',
      barcode: p.barcode || '', supplier_id: p.supplier_id || '',
    });
    setSizes(p.sizes?.length > 0 ? p.sizes.map((s: any) => ({ size: s.size, quantity: s.quantity.toString() })) : [{ size: 'default', quantity: '0' }]);
    setEditId(p.id);
    setEditOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      await supabase.from('product_sizes').delete().eq('product_id', id);
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      toast.success('Product deleted');
    } catch (err: any) { toast.error(err.message); }
  };

  const handleStockUpdate = async (productId: string, sizeId: string, newQty: number) => {
    try {
      const { error } = await supabase.from('product_sizes').update({ quantity: Math.max(0, newQty) }).eq('id', sizeId);
      if (error) throw error;
      toast.success('Stock updated');
    } catch (err: any) { toast.error(err.message); }
  };

  if (loading) return <AppLayout><DashboardSkeleton /></AppLayout>;

  const renderForm = () => (
    <form onSubmit={handleSave} className="space-y-4 mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Brand / Manufacturer *</Label>
          <Input placeholder="L'Oréal" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} className="mt-1.5" />
        </div>
        <div>
          <Label>Product Name *</Label>
          <Input placeholder="Hair Serum 100ml" value={form.model_name} onChange={e => setForm({ ...form, model_name: e.target.value })} className="mt-1.5" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Category</Label>
          <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>{SALON_CATEGORIES.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Variant / Shade</Label>
          <Input placeholder="Brown, 100ml" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="mt-1.5" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label>Cost Price</Label>
          <Input type="number" placeholder="0" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} className="mt-1.5" />
        </div>
        <div>
          <Label>Selling Price</Label>
          <Input type="number" placeholder="0" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} className="mt-1.5" />
        </div>
        <div>
          <Label>Shelf / Location</Label>
          <Input placeholder="Shelf A" value={form.rack_location} onChange={e => setForm({ ...form, rack_location: e.target.value })} className="mt-1.5" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Barcode</Label>
          <Input placeholder="123456789" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} className="mt-1.5" />
        </div>
        {suppliers.length > 0 && (
          <div>
            <Label>Supplier</Label>
            <Select value={form.supplier_id} onValueChange={v => setForm({ ...form, supplier_id: v })}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
      </div>
      {/* Stock quantity */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Stock Quantities</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => setSizes([...sizes, { size: '', quantity: '' }])}>+ Add Variant</Button>
        </div>
        <div className="space-y-2">
          {sizes.map((s, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="Variant (e.g. 100ml)" value={s.size} onChange={e => { const n = [...sizes]; n[i].size = e.target.value; setSizes(n); }} className="flex-1" />
              <Input type="number" placeholder="Qty" value={s.quantity} onChange={e => { const n = [...sizes]; n[i].quantity = e.target.value; setSizes(n); }} className="w-20" />
              {sizes.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => setSizes(sizes.filter((_, idx) => idx !== i))} className="text-muted-foreground">×</Button>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
        <Button type="button" variant="outline" className="flex-1" onClick={() => { setAddOpen(false); setEditOpen(false); }}>Cancel</Button>
        <Button type="submit" variant="trust" className="flex-1" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />{editId ? 'Update' : 'Add'} Product</>}
        </Button>
      </div>
    </form>
  );

  return (
    <AppLayout>
      <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Inventory</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {stats.totalProducts} products • {stats.totalStock} units in stock
            </p>
          </div>
          <Button variant="trust" onClick={() => { setForm(emptyForm); setSizes([{ size: 'default', quantity: '' }]); setEditId(null); setAddOpen(true); }}>
            <Plus className="w-4 h-4" />Add Product
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="glass-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag className="w-4 h-4 text-primary" />
              <span className="text-[10px] sm:text-xs text-muted-foreground">Total Products</span>
            </div>
            <p className="text-lg font-bold text-foreground">{stats.totalProducts}</p>
          </div>
          <div className="glass-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-primary" />
              <span className="text-[10px] sm:text-xs text-muted-foreground">Stock Value</span>
            </div>
            <p className="text-lg font-bold text-foreground">{formatCurrency(stats.totalValue, currency)}</p>
          </div>
          <div className="glass-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span className="text-[10px] sm:text-xs text-muted-foreground">Low Stock</span>
            </div>
            <p className="text-lg font-bold text-yellow-500">{stats.lowStock}</p>
          </div>
          <div className="glass-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-[10px] sm:text-xs text-muted-foreground">Out of Stock</span>
            </div>
            <p className="text-lg font-bold text-red-500">{stats.outOfStock}</p>
          </div>
        </div>

        {/* Tabs + Filters */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="low_stock" className="text-xs">Low Stock</TabsTrigger>
            <TabsTrigger value="dead_stock" className="text-xs">Dead Stock</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="glass-card p-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {SALON_CATEGORIES.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Product List */}
        {filtered.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-1">{products.length === 0 ? 'No products yet' : 'No matching products'}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {products.length === 0 ? 'Add your first beauty product to start tracking inventory.' : 'Try different filters.'}
            </p>
            {products.length === 0 && (
              <Button variant="trust" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4" />Add Product</Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(product => (
              <div key={product.id} className="glass-card p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <div className={cn('w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0',
                    (product.total_stock || 0) === 0 ? 'bg-red-500/10' : (product.total_stock || 0) <= 5 ? 'bg-yellow-500/10' : 'bg-primary/10')}>
                    <Package className={cn('w-5 h-5 sm:w-6 sm:h-6',
                      (product.total_stock || 0) === 0 ? 'text-red-500' : (product.total_stock || 0) <= 5 ? 'text-yellow-500' : 'text-primary')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h3 className="font-semibold text-foreground text-sm truncate">{product.brand} {product.model_name}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{CATEGORY_LABELS[product.category] || product.category}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {product.color && <span>{product.color}</span>}
                      {product.rack_location && <span>📍 {product.rack_location}</span>}
                    </div>
                    {/* Sizes/variants inline */}
                    {product.sizes && product.sizes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {product.sizes.map(s => (
                          <div key={s.id} className="flex items-center gap-1 text-[10px] bg-muted rounded px-2 py-1">
                            <span className="text-muted-foreground">{s.size}:</span>
                            <span className={cn('font-bold', s.quantity === 0 ? 'text-red-500' : s.quantity <= 3 ? 'text-yellow-500' : 'text-foreground')}>{s.quantity}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <p className="text-sm font-bold text-primary">{formatCurrency(product.selling_price, currency)}</p>
                    <p className="text-[10px] text-muted-foreground">Cost: {formatCurrency(product.purchase_price, currency)}</p>
                    <div className={cn('text-xs font-bold px-2 py-0.5 rounded-full',
                      (product.total_stock || 0) === 0 ? 'bg-red-500/10 text-red-500' :
                      (product.total_stock || 0) <= 5 ? 'bg-yellow-500/10 text-yellow-500' :
                      'bg-green-500/10 text-green-500')}>
                      {product.total_stock || 0} units
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-2 border-t border-border/50">
                  <Button variant="outline" size="sm" className="text-xs flex-1 sm:flex-none" onClick={() => handleEdit(product)}>
                    <Edit className="w-3 h-3" />Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs text-red-500 hover:text-red-600 flex-1 sm:flex-none" onClick={() => handleDelete(product.id)}>
                    <Trash2 className="w-3 h-3" />Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />Add Product
            </DialogTitle>
          </DialogHeader>
          {renderForm()}
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />Edit Product
            </DialogTitle>
          </DialogHeader>
          {renderForm()}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default SalonInventory;
