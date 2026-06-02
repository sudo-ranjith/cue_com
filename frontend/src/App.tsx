import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { AdminLayout } from './components/layout/AdminLayout';
import { ProtectedRoute } from './components/shared/ProtectedRoute';
import { PageSpinner } from './components/ui/Spinner';

// Lazy-loaded pages
const Login = lazy(() => import('./pages/auth/Login'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));

const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const ProductList = lazy(() => import('./pages/admin/products/ProductList'));
const ProductForm = lazy(() => import('./pages/admin/products/ProductForm'));
const ProductDetail = lazy(() => import('./pages/admin/products/ProductDetail'));
const OrderList = lazy(() => import('./pages/admin/orders/OrderList'));
const OrderDetail = lazy(() => import('./pages/admin/orders/OrderDetail'));
const CouponList = lazy(() => import('./pages/admin/coupons/CouponList'));
const Settings = lazy(() => import('./pages/admin/settings/Settings'));

const ProductPage = lazy(() => import('./pages/public/ProductPage'));
const Checkout = lazy(() => import('./pages/public/Checkout'));
const PaymentSuccess = lazy(() => import('./pages/public/PaymentSuccess'));
const OrderTracking = lazy(() => import('./pages/public/OrderTracking'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            {/* Auth routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Public product & checkout routes */}
            <Route path="/p/:token" element={<ProductPage />} />
            <Route path="/checkout/:token" element={<Checkout />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/track" element={<OrderTracking />} />

            {/* Protected admin routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />

              {/* Products */}
              <Route path="products" element={<ProductList />} />
              <Route path="products/new" element={<ProductForm />} />
              <Route path="products/:id" element={<ProductDetail />} />
              <Route path="products/:id/edit" element={<ProductForm />} />

              {/* Orders */}
              <Route path="orders" element={<OrderList />} />
              <Route path="orders/:id" element={<OrderDetail />} />

              {/* Coupons */}
              <Route path="coupons" element={<CouponList />} />

              {/* Settings */}
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />

            {/* 404 fallback */}
            <Route
              path="*"
              element={
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <p className="text-6xl font-bold text-gray-300 mb-4">404</p>
                    <h1 className="text-xl font-semibold text-gray-700 mb-2">Page not found</h1>
                    <a href="/" className="text-primary-600 hover:underline text-sm">
                      Go home
                    </a>
                  </div>
                </div>
              }
            />
          </Routes>
        </Suspense>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '10px',
              fontSize: '14px',
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
