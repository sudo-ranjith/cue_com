import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, MapPin, Phone, Mail, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { ordersApi } from '../../../api/orders';
import { OrderStatus } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { OrderStatusBadge, PaymentStatusBadge } from '../../../components/ui/Badge';
import { Select } from '../../../components/ui/Input';
import { PageSpinner } from '../../../components/ui/Spinner';

const ORDER_STATUSES = [
  { value: OrderStatus.PENDING, label: 'Pending' },
  { value: OrderStatus.PAID, label: 'Paid' },
  { value: OrderStatus.PROCESSING, label: 'Processing' },
  { value: OrderStatus.PACKED, label: 'Packed' },
  { value: OrderStatus.SHIPPED, label: 'Shipped' },
  { value: OrderStatus.DELIVERED, label: 'Delivered' },
  { value: OrderStatus.CANCELLED, label: 'Cancelled' },
  { value: OrderStatus.REFUNDED, label: 'Refunded' },
];

const statusIcons: Record<string, string> = {
  pending: '🕐',
  paid: '💳',
  processing: '⚙️',
  packed: '📦',
  shipped: '🚚',
  delivered: '✅',
  cancelled: '❌',
  refunded: '↩️',
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newStatus, setNewStatus] = useState<OrderStatus | ''>('');
  const [downloading, setDownloading] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.get(Number(id)),
    enabled: Boolean(id),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ status }: { status: OrderStatus }) =>
      ordersApi.updateStatus(Number(id), status),
    onSuccess: (updated) => {
      toast.success(`Order status updated to ${updated.status}`);
      queryClient.setQueryData(['order', id], updated);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setNewStatus('');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const handleDownloadInvoice = async () => {
    setDownloading(true);
    try {
      const blob = await ordersApi.downloadInvoice(Number(id));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${order?.order_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download invoice');
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return <PageSpinner />;
  if (!order) return <div className="text-center py-16 text-gray-500">Order not found.</div>;

  const { delivery_address: addr } = order;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          onClick={() => navigate('/admin/orders')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Orders
        </button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            leftIcon={<Download size={15} />}
            size="sm"
            loading={downloading}
            onClick={handleDownloadInvoice}
          >
            Invoice
          </Button>
        </div>
      </div>

      {/* Order Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Order {order.order_number}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Placed on {format(new Date(order.created_at), 'dd MMM yyyy, HH:mm')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.payment_status} />
          </div>
        </div>

        {/* Update Status */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
          <div className="flex-1 max-w-xs">
            <Select
              options={[{ value: '', label: 'Update Status…' }, ...ORDER_STATUSES]}
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            disabled={!newStatus}
            loading={updateStatusMutation.isPending}
            onClick={() => newStatus && updateStatusMutation.mutate({ status: newStatus as OrderStatus })}
          >
            Update
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Items */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Items</h2>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-4">
                  {item.product_image ? (
                    <img
                      src={item.product_image}
                      alt={item.product_name}
                      className="w-14 h-14 rounded-lg object-cover shrink-0 bg-gray-100"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-100 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{item.product_name}</p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(item.unit_price)} × {item.quantity}
                    </p>
                  </div>
                  <p className="font-semibold text-gray-900">{formatCurrency(item.total_price)}</p>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-gray-100 mt-4 pt-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Shipping</span>
                <span>{formatCurrency(order.shipping_charge)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount {order.coupon_code && `(${order.coupon_code})`}</span>
                  <span>−{formatCurrency(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-100 pt-2 mt-2">
                <span>Total</span>
                <span>{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          {(order.razorpay_order_id || order.razorpay_payment_id) && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard size={18} className="text-gray-400" />
                Payment Info
              </h2>
              <dl className="space-y-2 text-sm">
                {order.razorpay_order_id && (
                  <div className="flex gap-4">
                    <dt className="text-gray-500 shrink-0 w-40">Razorpay Order ID</dt>
                    <dd className="font-mono text-gray-700 truncate">{order.razorpay_order_id}</dd>
                  </div>
                )}
                {order.razorpay_payment_id && (
                  <div className="flex gap-4">
                    <dt className="text-gray-500 shrink-0 w-40">Payment ID</dt>
                    <dd className="font-mono text-gray-700 truncate">{order.razorpay_payment_id}</dd>
                  </div>
                )}
                {order.razorpay_signature && (
                  <div className="flex gap-4">
                    <dt className="text-gray-500 shrink-0 w-40">Signature</dt>
                    <dd className="font-mono text-gray-700 truncate text-xs">{order.razorpay_signature}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Status Timeline */}
          {order.status_history && order.status_history.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Status Timeline</h2>
              <div className="space-y-3">
                {order.status_history.map((entry, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="text-xl shrink-0 mt-0.5">
                      {statusIcons[entry.status] || '•'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">{entry.status}</p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(entry.timestamp), 'dd MMM yyyy, HH:mm')}
                      </p>
                      {entry.note && (
                        <p className="text-xs text-gray-600 mt-0.5">{entry.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: customer & address */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Customer</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 text-sm">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold shrink-0">
                  {order.customer_name.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium text-gray-900">{order.customer_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail size={14} className="text-gray-400 shrink-0" />
                {order.customer_email}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone size={14} className="text-gray-400 shrink-0" />
                {order.customer_phone}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin size={16} className="text-gray-400" />
              Delivery Address
            </h2>
            <address className="not-italic text-sm text-gray-600 space-y-1 leading-relaxed">
              <p className="font-medium text-gray-900">{addr.full_name}</p>
              <p>{addr.address_line1}</p>
              {addr.address_line2 && <p>{addr.address_line2}</p>}
              <p>
                {addr.city}, {addr.state} — {addr.pincode}
              </p>
              <p className="text-gray-500">{addr.mobile}</p>
            </address>
          </div>

          {order.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-2">Notes</h2>
              <p className="text-sm text-gray-600">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
