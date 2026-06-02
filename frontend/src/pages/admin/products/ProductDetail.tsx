import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Edit2, ArrowLeft, ExternalLink, Package } from 'lucide-react';
import { format } from 'date-fns';
import { productsApi } from '../../../api/products';
import { Button } from '../../../components/ui/Button';
import { ProductStatusBadge } from '../../../components/ui/Badge';
import { PageSpinner } from '../../../components/ui/Spinner';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.get(Number(id)),
    enabled: Boolean(id),
  });

  if (isLoading) return <PageSpinner />;
  if (!product) return <div className="text-center py-16 text-gray-500">Product not found.</div>;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/products')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Products
        </button>
        <div className="flex gap-2">
          <a href={`/p/${product.token}`} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" leftIcon={<ExternalLink size={15} />} size="sm">
              View Page
            </Button>
          </a>
          <Link to={`/admin/products/${product.id}/edit`}>
            <Button variant="primary" leftIcon={<Edit2 size={15} />} size="sm">
              Edit
            </Button>
          </Link>
        </div>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-6">
          {product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-28 h-28 rounded-xl object-cover shrink-0 bg-gray-100"
            />
          ) : (
            <div className="w-28 h-28 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
              <Package size={32} className="text-gray-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>
                <p className="text-sm text-gray-500 mt-0.5">SKU: {product.sku}</p>
              </div>
              <ProductStatusBadge status={product.status} />
            </div>
            <p className="text-gray-600 text-sm mt-3 leading-relaxed">{product.description}</p>
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Pricing</h2>
          <dl className="space-y-3">
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Price</dt>
              <dd className="font-medium text-gray-900">{formatCurrency(product.price)}</dd>
            </div>
            {product.discount_price && (
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Discount Price</dt>
                <dd className="font-medium text-gray-400 line-through">{formatCurrency(product.discount_price)}</dd>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Shipping Charge</dt>
              <dd className="font-medium text-gray-900">{formatCurrency(product.shipping_charge)}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Inventory</h2>
          <dl className="space-y-3">
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Stock Quantity</dt>
              <dd className="font-medium text-gray-900">{product.stock_quantity}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Category</dt>
              <dd className="font-medium text-gray-900">{product.category}</dd>
            </div>
            {product.weight && (
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Weight</dt>
                <dd className="font-medium text-gray-900">{product.weight}g</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Product link */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Product Link</h2>
        <div className="flex items-center gap-3">
          <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 font-mono truncate">
            {window.location.origin}/p/{product.token}
          </code>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/p/${product.token}`).then(() => {})}
          >
            Copy
          </Button>
        </div>
      </div>

      {/* Timestamps */}
      <div className="text-xs text-gray-400 text-right pb-4">
        Created {format(new Date(product.created_at), 'dd MMM yyyy HH:mm')} &bull; Updated{' '}
        {format(new Date(product.updated_at), 'dd MMM yyyy HH:mm')}
      </div>
    </div>
  );
}
