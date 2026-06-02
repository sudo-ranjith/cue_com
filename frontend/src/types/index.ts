// ─── Enums ───────────────────────────────────────────────────────────────────

export enum ProductStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  OUT_OF_STOCK = 'out_of_stock',
  ARCHIVED = 'archived',
}

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  PROCESSING = 'processing',
  PACKED = 'packed',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FLAT = 'flat',
}

// ─── Core Models ─────────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  discount_price: number | null;
  sku: string;
  category: string;
  stock_quantity: number;
  weight: number | null;
  shipping_charge: number;
  status: ProductStatus;
  images: string[];
  video_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
  token: string;
  qr_code_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  product_id: number;
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface DeliveryAddress {
  full_name: string;
  mobile: string;
  email: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
}

export interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: DeliveryAddress;
  notes: string | null;
  items: OrderItem[];
  subtotal: number;
  shipping_charge: number;
  discount_amount: number;
  total_amount: number;
  coupon_code: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  status_history: StatusHistoryEntry[];
  product?: Product;
  created_at: string;
  updated_at: string;
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  timestamp: string;
  note: string | null;
}

export interface Payment {
  id: number;
  order_id: number;
  order_number: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  created_at: string;
}

export interface Coupon {
  id: number;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  min_order_amount: number | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_products: number;
  total_orders: number;
  revenue_today: number;
  pending_orders: number;
  revenue_change_pct: number;
  orders_change_pct: number;
}

export interface DailySale {
  date: string;
  revenue: number;
  orders: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
}

export interface DashboardData {
  stats: DashboardStats;
  daily_sales: DailySale[];
  monthly_revenue: MonthlyRevenue[];
  recent_orders: Order[];
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface CompanySettings {
  company_name: string;
  gst_number: string;
  address: string;
  phone: string;
  logo_url: string;
  website: string;
}

export interface PaymentSettings {
  razorpay_key_id: string;
  razorpay_key_secret: string;
}

export interface NotificationSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  from_email: string;
  from_name: string;
}

export interface AppSettings {
  company: CompanySettings;
  payment: PaymentSettings;
  notification: NotificationSettings;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ApiError {
  detail: string;
  status_code?: number;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

// ─── Form Types ───────────────────────────────────────────────────────────────

export interface LoginFormData {
  email: string;
  password: string;
}

export interface ForgotPasswordFormData {
  email: string;
}

export interface ResetPasswordFormData {
  token: string;
  new_password: string;
  confirm_password: string;
}

export interface ProductFormData {
  name: string;
  slug: string;
  description: string;
  price: number;
  discount_price: number | null;
  sku: string;
  category: string;
  stock_quantity: number;
  weight: number | null;
  shipping_charge: number;
  status: ProductStatus;
  images: string[];
  video_url: string;
  seo_title: string;
  seo_description: string;
}

export interface CheckoutFormData {
  full_name: string;
  mobile: string;
  email: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  notes: string;
  coupon_code: string;
  quantity: number;
}

export interface CouponFormData {
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  min_order_amount: number | null;
  max_uses: number | null;
  is_active: boolean;
  expires_at: string | null;
}

export interface TrackOrderFormData {
  order_number: string;
  phone: string;
}

// ─── Public API Types ─────────────────────────────────────────────────────────

export interface PublicProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  discount_price: number | null;
  images: string[];
  video_url: string | null;
  stock_quantity: number;
  shipping_charge: number;
  seo_title: string | null;
  seo_description: string | null;
  token: string;
}

export interface CreateOrderRequest {
  product_id: number;
  quantity: number;
  full_name: string;
  mobile: string;
  email: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  notes: string;
  coupon_code: string;
}

export interface CreateOrderResponse {
  order_id: number;
  order_number: string;
  total_amount: number;
  subtotal: number;
  shipping_charge: number;
  discount_amount: number;
}

export interface RazorpayOrderResponse {
  razorpay_order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  company_name: string;
}

export interface VerifyPaymentRequest {
  order_id: number;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface CouponValidateResponse {
  is_valid: boolean;
  discount_amount: number;
  message: string;
}
