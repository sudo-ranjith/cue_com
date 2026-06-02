import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const pageTitles: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/products': 'Products',
  '/admin/products/new': 'Create Product',
  '/admin/orders': 'Orders',
  '/admin/coupons': 'Coupons',
  '/admin/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.match(/\/admin\/products\/\d+\/edit/)) return 'Edit Product';
  if (pathname.match(/\/admin\/products\/\d+/)) return 'Product Details';
  if (pathname.match(/\/admin\/orders\/\d+/)) return 'Order Details';
  return 'CueCom';
}

export function AdminLayout() {
  const { pathname } = useLocation();
  const title = getPageTitle(pathname);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden lg:flex shrink-0">
        <Sidebar />
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
