import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { Product, ProductSize } from '@/types/store';

export const useProducts = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!user) {
      setProducts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: productsData, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const { data: sizesData } = await supabase
        .from('product_sizes')
        .select('*');

      const mapped: Product[] = (productsData || []).map((p: any) => {
        const sizes = (sizesData || []).filter((s: any) => s.product_id === p.id).map((s: any) => ({
          id: s.id,
          product_id: s.product_id,
          size: s.size,
          quantity: s.quantity,
          created_at: s.created_at,
          updated_at: s.updated_at,
        }));
        const total_stock = sizes.reduce((sum: number, s: ProductSize) => sum + s.quantity, 0);
        
        return {
          id: p.id,
          user_id: p.user_id,
          brand: p.brand,
          model_name: p.model_name,
          category: p.category,
          gender: p.gender,
          color: p.color,
          purchase_price: Number(p.purchase_price),
          selling_price: Number(p.selling_price),
          supplier_id: p.supplier_id,
          rack_location: p.rack_location,
          barcode: p.barcode,
          image_url: p.image_url,
          created_at: p.created_at,
          updated_at: p.updated_at,
          sizes,
          total_stock,
        };
      });

      setProducts(mapped);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchProducts();

    const channel = supabase
      .channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchProducts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_sizes' }, () => fetchProducts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
};
