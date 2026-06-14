import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useProducts } from '@/hooks/useProducts';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCurrency } from '@/data/mockData';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  ArrowLeft, Package, Tag, Ruler, MapPin, Barcode, Truck,
  Plus, Minus, Edit3, Trash2, Loader2, ShoppingCart, Check, Upload, Image,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Product, ProductSize } from '@/types/store';

const CATEGORIES = ['casual', 'formal', 'sports', 'sandals', 'boots', 'sneakers', 'other'];
const GENDERS = ['men', 'women', 'kids', 'unisex'];

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, loading, refetch } = useProducts();
  const { suppliers } = useSuppliers();
  const currency = useCurrency();
  const [editSizeModalOpen, setEditSizeModalOpen] = useState(false);
  const [editProductModalOpen, setEditProductModalOpen] = useState(false);
  const [newSize, setNewSize] = useState('');
  const [newQty, setNewQty] = useState('0');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Edit product form
  const [editForm, setEditForm] = useState({
    brand: '', model_name: '', category: '', gender: '',
    color: '', purchase_price: '', selling_price: '',
    rack_location: '', barcode: '', supplier_id: '',
  });

  const product = products.find(p => p.id === id);
  const supplier = product?.supplier_id ? suppliers.find(s => s.id === product.supplier_id) : null;

  const openEditModal = () => {
    if (!product) return;
    setEditForm({
      brand: product.brand, model_name: product.model_name,
      category: product.category, gender: product.gender,
      color: product.color || '', purchase_price: String(product.purchase_price),
      selling_price: String(product.selling_price),
      rack_location: product.rack_location || '', barcode: product.barcode || '',
      supplier_id: product.supplier_id || '',
    });
    setEditProductModalOpen(true);
  };

  const handleEditProduct = async () => {
    if (!product) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('products').update({
        brand: editForm.brand, model_name: editForm.model_name,
        category: editForm.category, gender: editForm.gender,
        color: editForm.color || null,
        purchase_price: parseFloat(editForm.purchase_price) || 0,
        selling_price: parseFloat(editForm.selling_price) || 0,
        rack_location: editForm.rack_location || null,
        barcode: editForm.barcode || null,
        supplier_id: editForm.supplier_id || null,
      }).eq('id', product.id);
      if (error) throw error;
      toast.success('Product updated');
      setEditProductModalOpen(false);
      refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !product) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${product.user_id}/${product.id}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
      const { error: updateError } = await supabase.from('products').update({ image_url: publicUrl }).eq('id', product.id);
      if (updateError) throw updateError;
      toast.success('Image uploaded');
      refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const handleAddSize = async () => {
    if (!product || !newSize.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('product_sizes').insert({
        product_id: product.id, size: newSize.trim(), quantity: parseInt(newQty) || 0,
      });
      if (error) throw error;
      toast.success('Size added');
      setNewSize(''); setNewQty('0');
      setEditSizeModalOpen(false);
      refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleUpdateQty = async (sizeId: string, delta: number) => {
    const size = product?.sizes?.find(s => s.id === sizeId);
    if (!size) return;
    const newQuantity = Math.max(0, size.quantity + delta);
    try {
      const { error } = await supabase.from('product_sizes').update({ quantity: newQuantity }).eq('id', sizeId);
      if (error) throw error;
      refetch();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDeleteSize = async (sizeId: string) => {
    if (!confirm('Delete this size variant?')) return;
    try {
      const { error } = await supabase.from('product_sizes').delete().eq('id', sizeId);
      if (error) throw error;
      toast.success('Size deleted');
      refetch();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDeleteProduct = async () => {
    if (!product) return;
    if (!confirm('Delete this product and all its sizes?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', product.id);
      if (error) throw error;
      toast.success('Product deleted');
      navigate('/products');
    } catch (err: any) { toast.error(err.message); }
  };

  if (loading) {
    return <AppLayout><div className="p-4 md:p-6 lg:p-8 space-y-6"><Skeleton className="h-8 w-32" /><Skeleton className="h-64" /></div></AppLayout>;
  }

  if (!product) {
    return <AppLayout><div className="p-8 text-center"><p className="text-muted-foreground">Product not found</p><Link to="/products" className="text-primary hover:underline mt-2 inline-block">Back to products</Link></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6">
        <Link to="/products" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm sm:text-base">
          <ArrowLeft className="w-4 h-4" />Back to products
        </Link>

        {/* Header */}
        <div className="glass-card p-4 sm:p-6 md:p-8">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Product Image */}
            <div className="relative w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden group">
              {product.image_url ? (
                <img src={product.image_url} alt={product.model_name} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <Package className="w-12 h-12 text-primary" />
              )}
              <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl">
                {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Upload className="w-5 h-5 text-white" />}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2">
                  {product.brand} {product.model_name}
                </h1>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2"><Tag className="w-4 h-4" />{product.category}</span>
                  <span className="capitalize">{product.gender}</span>
                  {product.color && <span>{product.color}</span>}
                  {product.rack_location && <span className="flex items-center gap-2"><MapPin className="w-4 h-4" />{product.rack_location}</span>}
                  {product.barcode && <span className="flex items-center gap-2"><Barcode className="w-4 h-4" />{product.barcode}</span>}
                  {supplier && <span className="flex items-center gap-2"><Truck className="w-4 h-4" />{supplier.name}</span>}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-4 border-t border-border">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Stock</p>
                  <p className={cn('text-lg sm:text-xl font-bold', (product.total_stock || 0) < 3 ? 'text-risk-high' : 'text-foreground')}>{product.total_stock || 0} pairs</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Purchase Price</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground">{formatCurrency(product.purchase_price, currency)}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Selling Price</p>
                  <p className="text-lg sm:text-xl font-bold text-primary">{formatCurrency(product.selling_price, currency)}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Margin</p>
                  <p className="text-lg sm:text-xl font-bold text-risk-safe">{formatCurrency(product.selling_price - product.purchase_price, currency)}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 lg:w-48">
              <Button variant="outline" className="w-full" onClick={openEditModal}>
                <Edit3 className="w-4 h-4" />Edit Product
              </Button>
              <Button variant="trust" className="w-full" onClick={() => navigate(`/sales/new`)}>
                <ShoppingCart className="w-4 h-4" />New Sale
              </Button>
              <Button variant="destructive" className="w-full" onClick={handleDeleteProduct}>
                <Trash2 className="w-4 h-4" />Delete Product
              </Button>
            </div>
          </div>
        </div>

        {/* Size Variants */}
        <div className="glass-card overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground text-base sm:text-lg flex items-center gap-2"><Ruler className="w-5 h-5 text-primary" />Size Variants</h2>
            <Button variant="outline" size="sm" onClick={() => setEditSizeModalOpen(true)}><Plus className="w-4 h-4" />Add Size</Button>
          </div>
          {(!product.sizes || product.sizes.length === 0) ? (
            <div className="p-6 sm:p-8 text-center">
              <p className="text-muted-foreground text-sm sm:text-base">No sizes added yet</p>
              <Button variant="trust" size="sm" className="mt-3" onClick={() => setEditSizeModalOpen(true)}><Plus className="w-4 h-4" />Add First Size</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4">
              {product.sizes.sort((a, b) => parseFloat(a.size) - parseFloat(b.size)).map((size) => (
                <div key={size.id} className={cn('p-4 rounded-xl border text-center relative group', size.quantity === 0 ? 'bg-risk-high/10 border-risk-high/30' : size.quantity < 3 ? 'bg-risk-medium/10 border-risk-medium/30' : 'bg-card border-border')}>
                  <button onClick={() => handleDeleteSize(size.id)} className="absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-risk-high/20 transition-all" title="Delete size">
                    <Trash2 className="w-3 h-3 text-risk-high" />
                  </button>
                  <p className="text-lg font-bold text-foreground mb-1">Size {size.size}</p>
                  <p className={cn('text-2xl font-bold mb-3', size.quantity === 0 ? 'text-risk-high' : 'text-foreground')}>{size.quantity}</p>
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleUpdateQty(size.id, -1)} disabled={size.quantity === 0}><Minus className="w-3 h-3" /></Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleUpdateQty(size.id, 1)}><Plus className="w-3 h-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Size Modal */}
      <Dialog open={editSizeModalOpen} onOpenChange={setEditSizeModalOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>Add Size Variant</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label>Size</Label><Input placeholder="e.g. 8" value={newSize} onChange={(e) => setNewSize(e.target.value)} className="mt-1.5" /></div>
            <div><Label>Quantity</Label><Input type="number" value={newQty} onChange={(e) => setNewQty(e.target.value)} className="mt-1.5" /></div>
            <Button variant="trust" className="w-full" onClick={handleAddSize} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Size'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Product Modal */}
      <Dialog open={editProductModalOpen} onOpenChange={setEditProductModalOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit3 className="w-5 h-5 text-primary" />Edit Product</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Brand</Label><Input value={editForm.brand} onChange={(e) => setEditForm({...editForm, brand: e.target.value})} className="mt-1.5" /></div>
              <div><Label>Model Name</Label><Input value={editForm.model_name} onChange={(e) => setEditForm({...editForm, model_name: e.target.value})} className="mt-1.5" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={editForm.category} onValueChange={(v) => setEditForm({...editForm, category: v})}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={editForm.gender} onValueChange={(v) => setEditForm({...editForm, gender: v})}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Color</Label><Input value={editForm.color} onChange={(e) => setEditForm({...editForm, color: e.target.value})} className="mt-1.5" /></div>
              <div><Label>Purchase Price</Label><Input type="number" value={editForm.purchase_price} onChange={(e) => setEditForm({...editForm, purchase_price: e.target.value})} className="mt-1.5" /></div>
              <div><Label>Selling Price</Label><Input type="number" value={editForm.selling_price} onChange={(e) => setEditForm({...editForm, selling_price: e.target.value})} className="mt-1.5" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Rack Location</Label><Input value={editForm.rack_location} onChange={(e) => setEditForm({...editForm, rack_location: e.target.value})} className="mt-1.5" /></div>
              <div><Label>Barcode</Label><Input value={editForm.barcode} onChange={(e) => setEditForm({...editForm, barcode: e.target.value})} className="mt-1.5" /></div>
            </div>
            {suppliers.length > 0 && (
              <div>
                <Label>Supplier</Label>
                <Select value={editForm.supplier_id} onValueChange={(v) => setEditForm({...editForm, supplier_id: v})}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setEditProductModalOpen(false)}>Cancel</Button>
              <Button variant="trust" className="flex-1" onClick={handleEditProduct} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Save Changes</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default ProductDetail;
