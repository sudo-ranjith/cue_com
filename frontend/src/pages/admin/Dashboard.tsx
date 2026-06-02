import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Package,
  ShoppingBag,
  IndianRupee,
  Clock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { analyticsApi } from '../../api/analytics';
import { PageSpinner } from '../../components/ui/Spinner';
import { OrderStatusBadge } from '../../components/ui/Badge';
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../../components/ui/Table';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: number;
  color: string;
}

function StatCard({ title, value, icon, change, color }: StatCardProps) {
  const isPositive = (change ?? 0) >= 0;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
        {change !== undefined && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              isPositive
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: analyticsApi.getDashboard,
    refetchInterval: 60_000,
  });

  if (isLoading) return <PageSpinner />;

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Failed to load dashboard data.</p>
      </div>
    );
  }

  const { stats, daily_sales, monthly_revenue, recent_orders } = data;

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Products"
          value={stats.total_products}
          icon={<Package size={22} className="text-indigo-600" />}
          color="bg-indigo-50"
        />
        <StatCard
          title="Total Orders"
          value={stats.total_orders}
          icon={<ShoppingBag size={22} className="text-blue-600" />}
          change={stats.orders_change_pct}
          color="bg-blue-50"
        />
        <StatCard
          title="Revenue Today"
          value={formatCurrency(stats.revenue_today)}
          icon={<IndianRupee size={22} className="text-green-600" />}
          change={stats.revenue_change_pct}
          color="bg-green-50"
        />
        <StatCard
          title="Pending Orders"
          value={stats.pending_orders}
          icon={<Clock size={22} className="text-orange-600" />}
          color="bg-orange-50"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Daily Sales Line Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Daily Sales (Last 30 Days)</h2>
          {daily_sales.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={daily_sales} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => format(new Date(v), 'dd MMM')}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                  labelFormatter={(l) => format(new Date(l), 'dd MMM yyyy')}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Monthly Revenue Bar Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Monthly Revenue</h2>
          {monthly_revenue.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={monthly_revenue}
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Recent Orders</h2>
          <Link
            to="/admin/orders"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            View all
          </Link>
        </div>
        {recent_orders.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No recent orders</div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableTh>Order #</TableTh>
                <TableTh>Customer</TableTh>
                <TableTh>Amount</TableTh>
                <TableTh>Status</TableTh>
                <TableTh>Date</TableTh>
              </TableRow>
            </TableHead>
            <TableBody>
              {recent_orders.map((order) => (
                <TableRow key={order.id}>
                  <TableTd>
                    <Link
                      to={`/admin/orders/${order.id}`}
                      className="font-medium text-primary-600 hover:text-primary-700"
                    >
                      {order.order_number}
                    </Link>
                  </TableTd>
                  <TableTd>
                    <div>
                      <p className="font-medium text-gray-900">{order.customer_name}</p>
                      <p className="text-xs text-gray-500">{order.customer_email}</p>
                    </div>
                  </TableTd>
                  <TableTd>{formatCurrency(order.total_amount)}</TableTd>
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
        )}
      </div>
    </div>
  );
}
