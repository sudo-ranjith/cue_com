import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, Package, Truck, CheckCircle, Clock, XCircle, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { ordersApi } from '../../api/orders';
import type { Order } from '../../types';
import { OrderStatus } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { OrderStatusBadge } from '../../components/ui/Badge';

const schema = z.object({
  order_number: z.string().min(1, 'Order number is required'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
});

type FormData = z.infer<typeof schema>;

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const STATUS_STEPS = [
  { status: OrderStatus.PENDING, label: 'Order Placed', icon: Clock },
  { status: OrderStatus.PAID, label: 'Payment Confirmed', icon: CheckCircle },
  { status: OrderStatus.PROCESSING, label: 'Processing', icon: Package },
  { status: OrderStatus.PACKED, label: 'Packed', icon: Package },
  { status: OrderStatus.SHIPPED, label: 'Shipped', icon: Truck },
  { status: OrderStatus.DELIVERED, label: 'Delivered', icon: CheckCircle },
];

const STATUS_ORDER = [
  OrderStatus.PENDING,
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

function getStepIndex(status: OrderStatus): number {
  return STATUS_ORDER.indexOf(status);
}

export default function OrderTracking() {
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      order_number: searchParams.get('order') || '',
      phone: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setNotFound(false);
    setOrder(null);
    try {
      const result = await ordersApi.track(data.order_number, data.phone);
      setOrder(result);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setNotFound(true);
      }
    }
  };

  const isCancelled =
    order?.status === OrderStatus.CANCELLED || order?.status === OrderStatus.REFUNDED;
  const currentStep = order ? getStepIndex(order.status) : -1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">Track Order</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {/* Search form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Track Your Order</h1>
          <p className="text-sm text-gray-500 mb-5">
            Enter your order number and registered mobile number to track your order.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Order Number *"
              placeholder="e.g. ORD-20241201-0001"
              error={errors.order_number?.message}
              {...register('order_number')}
            />
            <Input
              label="Mobile Number *"
              type="tel"
              placeholder="9876543210"
              maxLength={10}
              error={errors.phone?.message}
              {...register('phone')}
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isSubmitting}
              leftIcon={<Search size={16} />}
              className="w-full sm:w-auto"
            >
              Track Order
            </Button>
          </form>
        </div>

        {/* Not found */}
        {notFound && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
            <XCircle size={36} className="text-red-400 mx-auto mb-2" />
            <p className="font-semibold text-red-800">Order Not Found</p>
            <p className="text-sm text-red-600 mt-1">
              No order found with that number and mobile combination. Please check and try again.
            </p>
          </div>
        )}

        {/* Order details */}
        {order && (
          <div className="space-y-5">
            {/* Summary card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{order.order_number}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {format(new Date(order.created_at), 'dd MMMM yyyy, h:mm a')}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>

              <div className="space-y-2 text-sm text-gray-600 border-t border-gray-100 pt-4">
                <div className="flex justify-between">
                  <span>Customer</span>
                  <span className="font-medium text-gray-900">{order.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Product</span>
                  <span className="font-medium text-gray-900 text-right max-w-[60%] truncate">
                    {order.items[0]?.product_name || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total Amount</span>
                  <span className="font-bold text-gray-900">{formatCurrency(order.total_amount)}</span>
                </div>
              </div>
            </div>

            {/* Status timeline */}
            {!isCancelled ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-6">Shipment Status</h3>

                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                  <div className="space-y-6">
                    {STATUS_STEPS.map(({ status, label, icon: Icon }, idx) => {
                      const isCompleted = idx <= currentStep;
                      const isCurrent = idx === currentStep;
                      const historyEntry = order.status_history?.find(
                        (h) => h.status === status
                      );

                      return (
                        <div key={status} className="relative flex items-start gap-4 pl-10">
                          {/* Circle */}
                          <div
                            className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 z-10 ${
                              isCompleted
                                ? 'bg-primary-600 border-primary-600 text-white'
                                : 'bg-white border-gray-300 text-gray-400'
                            } ${isCurrent ? 'ring-4 ring-primary-100' : ''}`}
                          >
                            <Icon size={14} />
                          </div>

                          <div className="flex-1 pb-1">
                            <p
                              className={`text-sm font-semibold ${
                                isCompleted ? 'text-gray-900' : 'text-gray-400'
                              }`}
                            >
                              {label}
                              {isCurrent && (
                                <span className="ml-2 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
                                  Current
                                </span>
                              )}
                            </p>
                            {historyEntry && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {format(new Date(historyEntry.timestamp), 'dd MMM yyyy, h:mm a')}
                              </p>
                            )}
                            {historyEntry?.note && (
                              <p className="text-xs text-gray-500 mt-0.5">{historyEntry.note}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
                <XCircle size={36} className="text-red-400 mx-auto mb-2" />
                <p className="font-semibold text-red-800 capitalize">{order.status}</p>
                <p className="text-sm text-red-600 mt-1">
                  This order has been {order.status}. Please contact support for assistance.
                </p>
              </div>
            )}

            {/* Delivery address */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Delivery Address</h3>
              <address className="not-italic text-sm text-gray-600 space-y-1">
                <p className="font-medium text-gray-900">{order.delivery_address.full_name}</p>
                <p>{order.delivery_address.address_line1}</p>
                {order.delivery_address.address_line2 && (
                  <p>{order.delivery_address.address_line2}</p>
                )}
                <p>
                  {order.delivery_address.city}, {order.delivery_address.state} —{' '}
                  {order.delivery_address.pincode}
                </p>
              </address>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 border-t border-gray-200 bg-white py-6">
        <p className="text-center text-sm text-gray-400">
          Powered by <span className="font-semibold text-primary-600">CueCom</span>
        </p>
      </div>
    </div>
  );
}
