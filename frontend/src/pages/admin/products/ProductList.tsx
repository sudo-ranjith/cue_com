import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Edit2,
  Copy,
  QrCode,
  Trash2,
  ExternalLink,
  CheckCircle,
  Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi } from '../../../api/products';
import { ProductStatus } from '../../../types';
import type { Product } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { ProductStatusBadge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Pagination } from '../../../components/ui/Pagination';
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../../../components/ui/Table';
import { PageSpinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useDebounce } from '../../../hooks/useDebounce';

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Active', value: ProductStatus.ACTIVE },
  { label: 'Draft', value: ProductStatus.DRAFT },
  { label: 'Out of Stock', value: ProductStatus.OUT_OF_STOCK },
  { label: 'Archived', value: ProductStatus.ARCHIVED },
];

const APP_DOMAIN = import.meta.env.VITE_APP_DOMAIN || window.location.origin;

export default function ProductList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | ''>('');
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, debouncedSearch, statusFilter],
    queryFn: () =>
      productsApi.list({ page, per_page: 15, search: debouncedSearch, status: statusFilter }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productsApi.delete(id),
    onSuccess: () => {
      toast.success('Product deleted');
      setDeleteProduct(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast.error('Failed to delete product'),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => productsApi.duplicate(id),
    onSuccess: () => {
      toast.success('Product duplicated');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast.error('Failed to duplicate product'),
  });

  const handleCopyLink = (token: string) => {
    const link = `${APP_DOMAIN}/p/${token}`;
    navigator.clipboard.writeText(link).then(() => toast.success('Link copied!'));
  };

  const handleShowQr = async (product: Product) => {
    setQrProduct(product);
    setQrUrl(null);
    try {
      const res = await productsApi.getQrCode(product.id);
      setQrUrl(res.qr_code_url);
    } catch {
      toast.error('Failed to load QR code');
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div />
        <Link to="/admin/products/new">
          <Button variant="primary" leftIcon={<Plus size={16} />}>
            Create Product
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              leftAddon={<Search size={16} />}
            />
          </div>
        </div>

        {/* Status tabs */}
        <div className="px-4 flex gap-1 border-b border-gray-100 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value as ProductStatus | ''); setPage(1); }}
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
            title="No products found"
            description="Create your first product to get started."
            icon={<Package size={28} />}
            action={
              <Link to="/admin/products/new">
                <Button variant="primary" leftIcon={<Plus size={16} />} size="sm">
                  Create Product
                </Button>
              </Link>
            }
          />
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableTh>Product</TableTh>
                  <TableTh>Status</TableTh>
                  <TableTh>Price</TableTh>
                  <TableTh>Stock</TableTh>
                  <TableTh className="text-right">Actions</TableTh>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.items.map((product) => (
                  <TableRow key={product.id}>
                    <TableTd>
                      <div className="flex items-center gap-3">
                        {product.images[0] ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-10 h-10 rounded-lg object-cover shrink-0 bg-gray-100"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                            <Package size={16} className="text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate max-w-[200px]">
                            {product.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{product.sku}</p>
                        </div>
                      </div>
                    </TableTd>
                    <TableTd>
                      <ProductStatusBadge status={product.status} />
                    </TableTd>
                    <TableTd>
                      <div>
                        <span className="font-medium">{formatCurrency(product.price)}</span>
                        {product.discount_price && (
                          <span className="ml-2 text-xs text-gray-400 line-through">
                            {formatCurrency(product.discount_price)}
                          </span>
                        )}
                      </div>
                    </TableTd>
                    <TableTd>
                      <span
                        className={product.stock_quantity === 0 ? 'text-red-600 font-medium' : ''}
                      >
                        {product.stock_quantity}
                      </span>
                    </TableTd>
                    <TableTd>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/admin/products/${product.id}/edit`)}
                          title="Edit"
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => duplicateMutation.mutate(product.id)}
                          title="Duplicate"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          onClick={() => handleCopyLink(product.token)}
                          title="Copy Link"
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <CheckCircle size={15} />
                        </button>
                        <a
                          href={`/p/${product.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open product page"
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <ExternalLink size={15} />
                        </a>
                        <button
                          onClick={() => handleShowQr(product)}
                          title="QR Code"
                          className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        >
                          <QrCode size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteProduct(product)}
                          title="Delete"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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

      {/* QR Code Modal */}
      <Modal
        isOpen={!!qrProduct}
        onClose={() => { setQrProduct(null); setQrUrl(null); }}
        title={`QR Code — ${qrProduct?.name}`}
        size="sm"
      >
        <div className="flex flex-col items-center gap-4">
          {qrUrl ? (
            <img src={qrUrl} alt="QR Code" className="w-56 h-56 object-contain" />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin" />
            </div>
          )}
          <p className="text-xs text-gray-500 text-center">
            Scan to open: {APP_DOMAIN}/p/{qrProduct?.token}
          </p>
          {qrUrl && (
            <a
              href={qrUrl}
              download={`qr-${qrProduct?.slug}.png`}
              className="text-sm text-primary-600 hover:underline"
            >
              Download QR Code
            </a>
          )}
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteProduct}
        onClose={() => setDeleteProduct(null)}
        title="Delete Product"
        size="sm"
      >
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-gray-900">{deleteProduct?.name}</span>? This action
          cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteProduct(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => deleteProduct && deleteMutation.mutate(deleteProduct.id)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
