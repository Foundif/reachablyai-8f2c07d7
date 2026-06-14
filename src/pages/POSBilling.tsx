import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/hooks/useCurrency';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  ShoppingCart, ArrowLeft, Plus, Trash2, Search, Loader2, Package, Camera, Download, Percent,
} from 'lucide-react';
import BarcodeScanner from '@/components/pos/BarcodeScanner';
import { downloadReceipt } from '@/lib/receiptPdf';
import { cn } from '@/lib/utils';
import { Product, ProductSize } from '@/types/store';

interface CartItem {
  product: Product;
  size: ProductSize;
  quantity: number;
}

const POSBilling = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { products, refetch } = useProducts();
  const currency = useCurrency();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(null);
  const [qty, setQty] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  // Discount
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [discountValue, setDiscountValue] = useState('');

  const handleBarcodeScan = (barcode: string) => {
    const found = products.find(p => p.barcode?.toLowerCase() === barcode.toLowerCase());
    if (found) {
      setSelectedProduct(found);
      setSelectedSize(null);
      setSearchQuery('');
      toast.success(`Found: ${found.brand} ${found.model_name}`);
    } else {
      toast.error(`No product found for barcode: ${barcode}`);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products.slice(0, 10);
    const q = searchQuery.toLowerCase();
    return products.filter(p =>
      p.brand.toLowerCase().includes(q) ||
      p.model_name.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [products, searchQuery]);

  const subtotal = cart.reduce((sum, item) => sum + item.product.selling_price * item.quantity, 0);
  const discountAmount = discountType === 'percent'
    ? subtotal * (parseFloat(discountValue) || 0) / 100
    : parseFloat(discountValue) || 0;
  const totalAmount = Math.max(0, subtotal - discountAmount);

  const addToCart = () => {
    if (!selectedProduct || !selectedSize) { toast.error('Select a product and size'); return; }
    if (qty <= 0 || qty > selectedSize.quantity) { toast.error(`Available: ${selectedSize.quantity}`); return; }

    const existing = cart.findIndex(c => c.size.id === selectedSize.id);
    if (existing >= 0) {
      const newCart = [...cart];
      newCart[existing].quantity += qty;
      if (newCart[existing].quantity > selectedSize.quantity) {
        toast.error(`Only ${selectedSize.quantity} available`); return;
      }
      setCart(newCart);
    } else {
      setCart([...cart, { product: selectedProduct, size: selectedSize, quantity: qty }]);
    }
    setSelectedProduct(null); setSelectedSize(null); setQty(1); setSearchQuery('');
    toast.success('Added to cart');
  };

  const removeFromCart = (index: number) => setCart(cart.filter((_, i) => i !== index));

  const completeSale = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    if (!user) { toast.error('Not authenticated'); return; }

    setLoading(true);
    try {
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

      const { data: sale, error: saleError } = await supabase.from('sales').insert({
        user_id: user.id,
        invoice_number: invoiceNumber,
        customer_phone: customerPhone || null,
        total_amount: totalAmount,
        discount_amount: discountAmount,
        discount_type: discountAmount > 0 ? discountType : null,
        payment_method: paymentMethod,
      }).select().single();
      if (saleError) throw saleError;

      const { error: itemsError } = await supabase.from('sale_items').insert(
        cart.map(item => ({
          sale_id: sale.id,
          product_id: item.product.id,
          product_size_id: item.size.id,
          product_name: `${item.product.brand} ${item.product.model_name}`,
          size: item.size.size,
          quantity: item.quantity,
          selling_price: item.product.selling_price,
        }))
      );
      if (itemsError) throw itemsError;

      for (const item of cart) {
        const { error: stockError } = await supabase.from('product_sizes')
          .update({ quantity: item.size.quantity - item.quantity })
          .eq('id', item.size.id);
        if (stockError) throw stockError;
      }

      if (customerPhone) {
        const { data: existingCustomer } = await supabase.from('customers')
          .select('*').eq('phone', customerPhone).eq('user_id', user.id).maybeSingle();

        if (existingCustomer) {
          await supabase.from('customers').update({
            total_purchases: Number(existingCustomer.total_purchases) + totalAmount,
            last_purchase_date: new Date().toISOString(),
          }).eq('id', existingCustomer.id);
        } else {
          await supabase.from('customers').insert({
            user_id: user.id, name: 'Walk-in Customer', phone: customerPhone,
            total_purchases: totalAmount, last_purchase_date: new Date().toISOString(),
          });
        }
      }

      toast.success(`Sale completed! Invoice: ${invoiceNumber}`);
      
      const storeName = (profile as any)?.store_name || 'Glamsup Salon';
      const completedSale = {
        id: sale.id, user_id: user.id, invoice_number: invoiceNumber,
        customer_id: null, customer_phone: customerPhone || null,
        total_amount: totalAmount, discount_amount: discountAmount,
        payment_method: paymentMethod, created_at: sale.created_at,
        items: cart.map(item => ({
          id: '', sale_id: sale.id, product_id: item.product.id,
          product_size_id: item.size.id, product_name: `${item.product.brand} ${item.product.model_name}`,
          size: item.size.size, quantity: item.quantity, selling_price: item.product.selling_price, created_at: sale.created_at,
        })),
      };
      downloadReceipt(completedSale, currency, storeName);
      
      setCart([]); setCustomerPhone(''); setDiscountValue('');
      refetch();
      navigate('/sales');
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete sale');
    } finally { setLoading(false); }
  };

  return (
    <AppLayout>
      <div className="p-3 sm:p-4 md:p-6 lg:p-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">POS Billing</h1>
            <p className="text-sm text-muted-foreground">Create a new sale</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Product Search & Selection */}
          <div className="space-y-6 order-2 lg:order-1">
            <div className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Search className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">Search Product</h2>
              </div>
              <div className="flex gap-2 mb-4">
                <Input placeholder="Search by name, brand, or barcode..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1" />
                <Button variant="outline" size="icon" onClick={() => setScannerOpen(true)} title="Scan Barcode">
                  <Camera className="w-4 h-4" />
                </Button>
              </div>
              
              {searchQuery && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredProducts.map(p => (
                    <div key={p.id} onClick={() => { setSelectedProduct(p); setSelectedSize(null); setSearchQuery(''); }}
                      className={cn('p-3 rounded-lg border cursor-pointer transition-all', selectedProduct?.id === p.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50')}>
                      <p className="text-sm font-medium text-foreground">{p.brand} {p.model_name}</p>
                      <p className="text-xs text-muted-foreground">{p.total_stock} pairs • {formatCurrency(p.selling_price, currency)}</p>
                    </div>
                  ))}
                  {filteredProducts.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No products found</p>}
                </div>
              )}
            </div>

            {selectedProduct && (
              <div className="glass-card p-4 sm:p-6 animate-fade-up">
                <h2 className="font-semibold text-foreground mb-2">{selectedProduct.brand} {selectedProduct.model_name}</h2>
                <p className="text-sm text-muted-foreground mb-4">{formatCurrency(selectedProduct.selling_price, currency)} per pair</p>
                
                <div className="mb-4">
                  <Label className="mb-2 block">Select Size</Label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {(selectedProduct.sizes || []).map(s => (
                      <button key={s.id} onClick={() => setSelectedSize(s)} disabled={s.quantity === 0}
                        className={cn('p-2 rounded-lg border text-center text-sm transition-all',
                          selectedSize?.id === s.id ? 'border-primary bg-primary/10 text-primary' :
                          s.quantity === 0 ? 'border-border bg-muted text-muted-foreground opacity-50 cursor-not-allowed' :
                          'border-border hover:border-primary/50')}>
                        <div className="font-bold">{s.size}</div>
                        <div className="text-[10px] text-muted-foreground">{s.quantity} left</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label>Quantity</Label>
                    <Input type="number" min={1} max={selectedSize?.quantity || 1} value={qty} onChange={(e) => setQty(parseInt(e.target.value) || 1)} className="mt-1.5" />
                  </div>
                  <Button variant="trust" onClick={addToCart} disabled={!selectedSize}>
                    <Plus className="w-4 h-4" />Add to Cart
                  </Button>
                </div>
              </div>
            )}

            {/* Payment + Discount */}
            <div className="glass-card p-4 sm:p-6">
              <h2 className="font-semibold text-foreground mb-4">Payment Details</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Customer Phone (optional)</Label>
                  <Input placeholder="9876543210" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4">
                <Label className="flex items-center gap-1.5"><Percent className="w-3.5 h-3.5" />Discount</Label>
                <div className="flex gap-2 mt-1.5">
                  <Select value={discountType} onValueChange={(v: 'flat' | 'percent') => setDiscountType(v)}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat (₹)</SelectItem>
                      <SelectItem value="percent">Percent (%)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="flex-1" />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Cart */}
          <div className="order-1 lg:order-2">
            <div className="glass-card p-4 sm:p-6 lg:sticky lg:top-4">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingCart className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">Cart ({cart.length} items)</h2>
              </div>

              {cart.length === 0 ? (
                <div className="py-8 text-center">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No items in cart</p>
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  {cart.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-accent/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.product.brand} {item.product.model_name}</p>
                        <p className="text-xs text-muted-foreground">Size {item.size.size} × {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-bold text-foreground">{formatCurrency(item.product.selling_price * item.quantity, currency)}</p>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-risk-high" onClick={() => removeFromCart(i)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">{formatCurrency(subtotal, currency)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-risk-safe">Discount</span>
                    <span className="text-risk-safe">-{formatCurrency(discountAmount, currency)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-lg font-semibold text-foreground">Total</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(totalAmount, currency)}</span>
                </div>
                <Button variant="trust" size="lg" className="w-full mt-3" onClick={completeSale} disabled={cart.length === 0 || loading}>
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Complete Sale</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <BarcodeScanner open={scannerOpen} onOpenChange={setScannerOpen} onScan={handleBarcodeScan} />
    </AppLayout>
  );
};

export default POSBilling;
