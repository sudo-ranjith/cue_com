import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { ordersApi } from '../../../api/orders';
import { OrderStatus } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { OrderStatusBadge } from '../../../components/ui/Badge';
import { Pagination } from '../../../components/ui/Pagination';
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../../../components/ui/Table';
import { PageSpinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useDebounce } from '../../../hooks/useDebounce';

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: OrderStatus.PENDING },
  { label: 'Paid', value: OrderStatus.PAID },
  { label: 'Processing', value: OrderStatus.PROCESSING },
  { label: 'Shipped', value: OrderStatus.SHIPPED },
  { label: 'Delivered', value: OrderStatus.DELIVERED },
  { label: 'Cancelled', value: OrderStatus.CANCELLED },
];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function OrderList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [exporting, setExporting] = useState(false);

  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, debouncedSearch, statusFilter],
    queryFn: () =>
      ordersApi.list({ page, per_page: 20, search: debouncedSearch, status: statusFilter }),
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await ordersApi.exportCsv({ search: debouncedSearch, status: statusFilter });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Orders exported');
    } catch {
      toast.error('Failed to export orders');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-end">
        <Button
          variant="secondary"
          leftIcon={<Download size={16} />}
          loading={exporting}
          onClick={handleExport}
        >
          Export CSV
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <Input
            placeholder="Search by order # or customer name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            leftAddon={<Search size={16} />}
          />
        </div>

        {/* Status tabs */}
        <div className="px-4 flex gap-1 border-b border-gray-100 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value as OrderStatus | ''); setPage(1); }}
              className={`px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                statusFilter === tab.value
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {isLoading ? (
          <PageSpinner />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="No orders found"
            description="Orders will appear here once customers start placing them."
            icon={<ShoppingBag size={28} />}
          />
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableTh>Order #</TableTh>
                  <TableTh>Customer</TableTh>
                  <TableTh>Product</TableTh>
                  <TableTh>Amount</TableTh>
                  <TableTh>Status</TableTh>
                  <TableTh>Date</TableTh>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.items.map((order) => (
                  <TableRow
                    key={order.id}
                    onClick={() => navigate(`/admin/orders/${order.id}`)}
                  >
                    <TableTd>
                      <span className="font-medium text-primary-600">{order.order_number}</span>
                    </TableTd>
                    <TableTd>
                      <div>
                        <p className="font-medium text-gray-900">{order.customer_name}</p>
                        <p className="text-xs text-gray-500">{order.customer_phone}</p>
                      </div>
                    </TableTd>
                    <TableTd>
                      <span className="text-gray-700">
                        {order.items[0]?.product_name || '—'}
                        {order.items.length > 1 && (
                          <span className="text-xs text-gray-400 ml-1">+{order.items.length - 1} more</span>
                        )}
                      </span>
                    </TableTd>
                    <TableTd className="font-medium">{formatCurrency(order.total_amount)}</TableTd>
                    <TableTd>
                      <OrderStatusBadge status={order.status} />
                    </TableTd>
                    <TableTd className="text-gray-500">
                      {format(new Date(order.created_at), 'dd MMM yyyy')}
                    </TableTd>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="px-4">
              <Pagination
                page={page}
                totalPages={data.total_pages}
                onPageChange={setPage}
                total={data.total}
                perPage={data.per_page}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
