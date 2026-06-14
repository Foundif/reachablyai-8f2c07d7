import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/hooks/useCurrency';
import { useSuppliers } from '@/hooks/useSuppliers';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/data/mockData';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Plus, Search, Package, ChevronRight, Tag, Ruler,
  Loader2, Check, Download,
} from 'lucide-react';
import { exportToCSV, exportToExcel, ExportColumn } from '@/lib/exportUtils';
import { Product } from '@/types/store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const CATEGORIES = ['casual', 'formal', 'sports', 'sandals', 'boots', 'sneakers', 'other'];
const GENDERS = ['men', 'women', 'kids', 'unisex'];

const Products = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { products, loading } = useProducts();
  const { suppliers } = useSuppliers();
  const currency = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Add product form state
  const [formData, setFormData] = useState({
    brand: '', model_name: '', category: 'casual', gender: 'men',
    color: '', purchase_price: '', selling_price: '', rack_location: '',
    barcode: '', supplier_id: '',
  });
  const [sizes, setSizes] = useState([{ size: '', quantity: '' }]);
  const [saving, setSaving] = useState(false);

  const filteredProducts = useMemo(() => {
    let filtered = [...products];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.brand.toLowerCase().includes(q) || 
        p.model_name.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'all') filtered = filtered.filter(p => p.category === categoryFilter);
    if (genderFilter !== 'all') filtered = filtered.filter(p => p.gender === genderFilter);
    return filtered;
  }, [products, searchQuery, categoryFilter, genderFilter]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.brand || !formData.model_name) {
      toast.error('Please fill required fields'); return;
    }
    setSaving(true);
    try {
      const { data: product, error } = await supabase.from('products').insert({
        user_id: user.id,
        brand: formData.brand, model_name: formData.model_name,
        category: formData.category, gender: formData.gender,
        color: formData.color || null,
        purchase_price: parseFloat(formData.purchase_price) || 0,
        selling_price: parseFloat(formData.selling_price) || 0,
        rack_location: formData.rack_location || null,
        barcode: formData.barcode || null,
        supplier_id: formData.supplier_id || null,
      }).select().single();
      if (error) throw error;

      // Add sizes
      const validSizes = sizes.filter(s => s.size.trim());
      if (validSizes.length > 0) {
        const { error: sizeError } = await supabase.from('product_sizes').insert(
          validSizes.map(s => ({
            product_id: product.id,
            size: s.size.trim(),
            quantity: parseInt(s.quantity) || 0,
          }))
        );
        if (sizeError) throw sizeError;
      }

      toast.success('Product added!');
      setAddModalOpen(false);
      setFormData({ brand: '', model_name: '', category: 'casual', gender: 'men', color: '', purchase_price: '', selling_price: '', rack_location: '', barcode: '', supplier_id: '' });
      setSizes([{ size: '', quantity: '' }]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add product');
    } finally { setSaving(false); }
  };

  if (loading) return <AppLayout><DashboardSkeleton /></AppLayout>;

  return (
    <AppLayout>
      <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-5 lg:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-0.5 sm:mb-1">Products</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {products.length} products • {products.reduce((s, p) => s + (p.total_stock || 0), 0)} total pairs
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {products.length > 0 && (
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => {
                  const cols: ExportColumn<Product>[] = [
                    { header: 'Brand', accessor: 'brand' },
                    { header: 'Model', accessor: 'model_name' },
                    { header: 'Category', accessor: 'category' },
                    { header: 'Gender', accessor: 'gender' },
                    { header: 'Color', accessor: (p) => p.color || '' },
                    { header: 'Purchase Price', accessor: 'purchase_price' },
                    { header: 'Selling Price', accessor: 'selling_price' },
                    { header: 'Total Stock', accessor: (p) => p.total_stock || 0 },
                    { header: 'Rack', accessor: (p) => p.rack_location || '' },
                    { header: 'Barcode', accessor: (p) => p.barcode || '' },
                  ];
                  exportToCSV(filteredProducts, cols, 'inventory-report');
                }}><Download className="w-4 h-4" />CSV</Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const cols: ExportColumn<Product>[] = [
                    { header: 'Brand', accessor: 'brand' },
                    { header: 'Model', accessor: 'model_name' },
                    { header: 'Category', accessor: 'category' },
                    { header: 'Gender', accessor: 'gender' },
                    { header: 'Color', accessor: (p) => p.color || '' },
                    { header: 'Purchase Price', accessor: 'purchase_price' },
                    { header: 'Selling Price', accessor: 'selling_price' },
                    { header: 'Total Stock', accessor: (p) => p.total_stock || 0 },
                  ];
                  exportToExcel(filteredProducts, cols, 'inventory-report');
                }}><Download className="w-4 h-4" />Excel</Button>
              </div>
            )}
            <Button variant="trust" size="default" className="flex-1 sm:flex-none" onClick={() => setAddModalOpen(true)}>
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              Add Product
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="glass-card p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-background border-border w-full" />
            </div>
            <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full xs:w-[140px] bg-background text-sm"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger className="w-full xs:w-[140px] bg-background text-sm"><SelectValue placeholder="Gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  {GENDERS.map(g => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {!loading && products.length === 0 && (
          <div className="glass-card p-8 sm:p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No products yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Add your first footwear product to start managing inventory.</p>
            <Button variant="trust" onClick={() => setAddModalOpen(true)}><Plus className="w-4 h-4" />Add Your First Product</Button>
          </div>
        )}

        {/* Product List */}
        {filteredProducts.length > 0 && (
          <div className="space-y-2 sm:space-y-3">
            {filteredProducts.map((product, index) => (
              <div
                key={product.id}
                onClick={() => navigate(`/products/${product.id}`)}
                className="glass-card p-3 sm:p-4 md:p-5 flex flex-col gap-3 sm:gap-4 hover-lift cursor-pointer animate-fade-up"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Package className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 sm:mb-1 flex-wrap">
                      <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">{product.brand} {product.model_name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{product.category}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{product.gender}</span>
                      {product.color && <span>{product.color}</span>}
                      <span className="flex items-center gap-1"><Ruler className="w-3 h-3" />{product.sizes?.length || 0} sizes</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
                </div>
                <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-border/50">
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Stock</p>
                    <p className={cn('font-semibold text-sm sm:text-base', (product.total_stock || 0) < 3 ? 'text-risk-high' : 'text-foreground')}>{product.total_stock || 0} pairs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Purchase</p>
                    <p className="font-semibold text-sm sm:text-base text-foreground">{formatCurrency(product.purchase_price, currency)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Selling</p>
                    <p className="font-semibold text-sm sm:text-base text-primary">{formatCurrency(product.selling_price, currency)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredProducts.length === 0 && products.length > 0 && (
          <div className="glass-card p-8 sm:p-12 text-center">
            <p className="text-muted-foreground text-sm sm:text-base">No products found matching your filters.</p>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Add New Product
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddProduct} className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Brand *</Label>
                <Input placeholder="Nike" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label>Model Name *</Label>
                <Input placeholder="Air Max 90" value={formData.model_name} onChange={(e) => setFormData({ ...formData, model_name: e.target.value })} className="mt-1.5" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Color</Label>
                <Input placeholder="Black" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label>Purchase Price</Label>
                <Input type="number" placeholder="0" value={formData.purchase_price} onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label>Selling Price</Label>
                <Input type="number" placeholder="0" value={formData.selling_price} onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })} className="mt-1.5" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Rack Location</Label>
                <Input placeholder="A1" value={formData.rack_location} onChange={(e) => setFormData({ ...formData, rack_location: e.target.value })} className="mt-1.5" />
              </div>
              <div>
                <Label>Barcode</Label>
                <Input placeholder="1234567890" value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} className="mt-1.5" />
              </div>
            </div>
            {suppliers.length > 0 && (
              <div>
                <Label>Supplier</Label>
                <Select value={formData.supplier_id} onValueChange={(v) => setFormData({ ...formData, supplier_id: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {/* Sizes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Size Variants</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setSizes([...sizes, { size: '', quantity: '' }])}>+ Add Size</Button>
              </div>
              <div className="space-y-2">
                {sizes.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="Size (e.g. 8)" value={s.size} onChange={(e) => { const n = [...sizes]; n[i].size = e.target.value; setSizes(n); }} className="flex-1" />
                    <Input type="number" placeholder="Qty" value={s.quantity} onChange={(e) => { const n = [...sizes]; n[i].quantity = e.target.value; setSizes(n); }} className="w-20" />
                    {sizes.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => setSizes(sizes.filter((_, idx) => idx !== i))} className="text-muted-foreground">×</Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setAddModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="trust" className="flex-1" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Add Product</>}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Products;
