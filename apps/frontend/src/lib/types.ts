export type User = { id: number; name: string; email: string };
export type Meta = { page: number; per_page: number; total: number; total_pages: number };
export type Envelope<T> = { success: true; message: string; data: T; meta?: Meta };
export type Product = {
  id: number;
  product_code: string;
  product_name: string;
  stock: number;
  price: string;
  deleted_at: string | null;
};
export type Customer = {
  id: string;
  customer_name: string;
  customer_address: string;
  gender: "Pria" | "Wanita";
  birth_date: string;
  phone: string | null;
  deleted_at: string | null;
};
export type Order = {
  id: number;
  order_number: string;
  order_date: string;
  total_amount: string;
  customer: Customer;
  creator: User;
  _count?: { items: number };
  items: OrderItem[];
};
export type OrderItem = {
  id: number;
  quantity: number;
  unit_price: string;
  subtotal: string;
  product: Product;
};
export type Summary = {
  total_transactions: number;
  total_sales: string;
  top_products: { product: Product; quantity_sold: number }[];
  low_stock_products: Product[];
};
