export interface Product {
  id: string;
  user_id: string;
  brand: string;
  model_name: string;
  category: string;
  gender: string;
  color: string | null;
  purchase_price: number;
  selling_price: number;
  supplier_id: string | null;
  rack_location: string | null;
  barcode: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  sizes?: ProductSize[];
  total_stock?: number;
}

export interface ProductSize {
  id: string;
  product_id: string;
  size: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  avatar_url?: string | null;
  total_purchases: number;
  last_purchase_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  brands_supplied: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  user_id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_phone: string | null;
  total_amount: number;
  discount_amount?: number;
  discount_type?: string | null;
  payment_method: string;
  created_at: string;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_size_id: string;
  product_name: string;
  size: string;
  quantity: number;
  selling_price: number;
  created_at: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  supplier_id: string | null;
  purchase_date: string;
  total_amount: number;
  created_at: string;
  items?: PurchaseItem[];
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product_size_id: string | null;
  size: string;
  quantity: number;
  purchase_price: number;
  created_at: string;
}

export interface Return {
  id: string;
  user_id: string;
  sale_id: string;
  sale_item_id: string;
  product_id: string;
  product_size_id: string;
  quantity: number;
  reason: string | null;
  type: 'return' | 'exchange';
  created_at: string;
}

export type ProductCategory = 'casual' | 'formal' | 'sports' | 'sandals' | 'boots' | 'sneakers' | 'other';
export type Gender = 'men' | 'women' | 'kids' | 'unisex';
export type PaymentMethod = 'cash' | 'upi' | 'card';
