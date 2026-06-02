import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheck, Tag, Minus, Plus, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi } from '../../api/products';
import { ordersApi } from '../../api/orders';
import { paymentsApi } from '../../api/payments';
import { couponsApi } from '../../api/coupons';
import type { CheckoutFormData } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { PageSpinner } from '../../components/ui/Spinner';

const schema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  email: z.string().email('Enter a valid email address'),
  address_line1: z.string().min(5, 'Address is required'),
  address_line2: z.string(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
  notes: z.string(),
  coupon_code: z.string(),
  quantity: z.coerce.number().int().min(1).max(100),
});

type FormData = z.infer<typeof schema>;

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export default function Checkout() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [quantity, setQuantity] = useState(1);
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number } | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [processing, setProcessing] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ['public-product', token],
    queryFn: () => productsApi.getByToken(token!),
    enabled: Boolean(token),
  });

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: '',
      mobile: '',
      email: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      pincode: '',
      notes: '',
      coupon_code: '',
      quantity: 1,
    },
  });

  const subtotal = product ? product.price * quantity : 0;
  const shipping = product ? product.shipping_charge : 0;
  const discount = couponApplied?.discount || 0;
  const total = subtotal + shipping - discount;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !product) return;
    setApplyingCoupon(true);
    try {
      const res = await couponsApi.validate(couponCode.trim().toUpperCase(), product.id, quantity);
      if (res.is_valid) {
        setCouponApplied({ code: couponCode.trim().toUpperCase(), discount: res.discount_amount });
        toast.success(res.message || 'Coupon applied!');
      } else {
        toast.error(res.message || 'Invalid coupon');
        setCouponApplied(null);
      }
    } catch {
      toast.error('Failed to validate coupon');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const onSubmit = async (data: CheckoutFormData) => {
    if (!product) return;
    setProcessing(true);

    try {
      // Step 1: Create order
      const orderResp = await ordersApi.createPublic({
        product_id: product.id,
        quantity,
        full_name: data.full_name,
        mobile: data.mobile,
        email: data.email,
        address_line1: data.address_line1,
        address_line2: data.address_line2,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        notes: data.notes,
        coupon_code: couponApplied?.code || '',
      });

      // Step 2: Create Razorpay order
      const razorpayOrder = await paymentsApi.createRazorpayOrder(orderResp.order_id);

      // Step 3: Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error('Failed to load payment gateway. Please try again.');
        setProcessing(false);
        return;
      }

      // Step 4: Open Razorpay
      const options = {
        key: razorpayOrder.key_id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        name: razorpayOrder.company_name,
        description: product.name,
        order_id: razorpayOrder.razorpay_order_id,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await paymentsApi.verifyPayment({
              order_id: orderResp.order_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            navigate(`/payment/success?order=${orderResp.order_number}`);
          } catch {
            toast.error('Payment verification failed. Please contact support.');
            setProcessing(false);
          }
        },
        prefill: {
          name: data.full_name,
          email: data.email,
          contact: data.mobile,
        },
        theme: { color: '#6366f1' },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            toast('Payment cancelled');
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      const message = err?.response?.data?.detail || 'Something went wrong. Please try again.';
      toast.error(message);
      setProcessing(false);
    }
  };

  if (isLoading) return <PageSpinner />;

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-gray-500">Product not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">Secure Checkout</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit(onSubmit as any)} className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: Form */}
          <div className="lg:col-span-3 space-y-6">
            {/* Contact */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Contact Information</h2>
              <div className="space-y-4">
                <Input
                  label="Full Name *"
                  placeholder="Your full name"
                  error={errors.full_name?.message}
                  {...register('full_name')}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Mobile Number *"
                    type="tel"
                    placeholder="9876543210"
                    maxLength={10}
                    error={errors.mobile?.message}
                    {...register('mobile')}
                  />
                  <Input
                    label="Email Address *"
                    type="email"
                    placeholder="you@example.com"
                    error={errors.email?.message}
                    {...register('email')}
                  />
                </div>
              </div>
            </div>

            {/* Delivery */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Delivery Address</h2>
              <div className="space-y-4">
                <Input
                  label="Address Line 1 *"
                  placeholder="House/Flat No, Street"
                  error={errors.address_line1?.message}
                  {...register('address_line1')}
                />
                <Input
                  label="Address Line 2"
                  placeholder="Area, Landmark (optional)"
                  {...register('address_line2')}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="City *"
                    placeholder="Mumbai"
                    error={errors.city?.message}
                    {...register('city')}
                  />
                  <Input
                    label="State *"
                    placeholder="Maharashtra"
                    error={errors.state?.message}
                    {...register('state')}
                  />
                  <Input
                    label="Pincode *"
                    placeholder="400001"
                    maxLength={6}
                    error={errors.pincode?.message}
                    {...register('pincode')}
                  />
                </div>
                <Textarea
                  label="Order Notes (optional)"
                  placeholder="Any special instructions..."
                  rows={2}
                  {...register('notes')}
                />
              </div>
            </div>
          </div>

          {/* Right: Order Summary */}
          <div className="lg:col-span-2">
            <div className="sticky top-6 space-y-4">
              {/* Product summary */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Order Summary</h2>

                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                  {product.images[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-16 h-16 rounded-lg object-cover bg-gray-100 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-100 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm leading-tight">{product.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{formatCurrency(product.price)} each</p>
                  </div>
                </div>

                {/* Quantity */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-600">Quantity</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center font-semibold text-gray-900">{quantity}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((q) => Math.min(product.stock_quantity, q + 1))
                      }
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Coupon */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                    <Tag size={13} />
                    Coupon Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        if (couponApplied) setCouponApplied(null);
                      }}
                      placeholder="e.g. SAVE20"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 font-mono"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={applyingCoupon}
                      onClick={handleApplyCoupon}
                      className="shrink-0"
                    >
                      Apply
                    </Button>
                  </div>
                  {couponApplied && (
                    <p className="text-xs text-green-600 mt-1 font-medium">
                      ✓ {couponApplied.code} — Saving {formatCurrency(couponApplied.discount)}
                    </p>
                  )}
                </div>

                {/* Price breakdown */}
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal ({quantity}×)</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Shipping</span>
                    <span className={shipping === 0 ? 'text-green-600 font-medium' : ''}>
                      {shipping === 0 ? 'FREE' : formatCurrency(shipping)}
                    </span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>−{formatCurrency(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-100 pt-2 mt-1">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>

              {/* Pay button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={processing}
                className="w-full text-base"
                leftIcon={<ShieldCheck size={20} />}
              >
                {processing ? 'Processing…' : `Pay ${formatCurrency(total)}`}
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <ShieldCheck size={13} />
                <span>Secured by Razorpay. 100% safe & encrypted.</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
