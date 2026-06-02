import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart,
  Shield,
  Truck,
  Star,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { productsApi } from '../../api/products';
import { Button } from '../../components/ui/Button';
import { PageSpinner } from '../../components/ui/Spinner';

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function ProductPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState(0);

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['public-product', token],
    queryFn: () => productsApi.getByToken(token!),
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (product) {
      document.title = product.seo_title || product.name;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', product.seo_description || product.description.slice(0, 160));
      }
    }
    return () => {
      document.title = 'CueCom';
    };
  }, [product]);

  if (isLoading) return <PageSpinner />;

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h1>
          <p className="text-gray-500">This product link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  const isOutOfStock = product.stock_quantity === 0;
  const discount = product.discount_price
    ? Math.round(((product.discount_price - product.price) / product.discount_price) * 100)
    : null;

  const images = product.images.length > 0 ? product.images : [];
  const currentImage = images[selectedImage];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">CueCom</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Images section */}
          <div className="space-y-3">
            {/* Main image */}
            <div className="relative bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 aspect-square">
              {currentImage ? (
                <img
                  src={currentImage}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <ShoppingCart size={64} />
                </div>
              )}
              {discount && (
                <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
                  {discount}% OFF
                </div>
              )}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedImage((i) => (i - 1 + images.length) % images.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow hover:bg-white transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setSelectedImage((i) => (i + 1) % images.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow hover:bg-white transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      idx === selectedImage ? 'border-primary-500' : 'border-gray-200'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="flex flex-col">
            {/* Stock badge */}
            <div className="mb-3">
              {isOutOfStock ? (
                <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                  Out of Stock
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  In Stock ({product.stock_quantity} available)
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 leading-tight">
              {product.name}
            </h1>

            {/* Rating placeholder */}
            <div className="flex items-center gap-1.5 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={14} className="fill-yellow-400 text-yellow-400" />
              ))}
              <span className="text-sm text-gray-500 ml-1">(4.8)</span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-5">
              <span className="text-3xl font-bold text-gray-900">{formatCurrency(product.price)}</span>
              {product.discount_price && (
                <span className="text-xl text-gray-400 line-through">
                  {formatCurrency(product.discount_price)}
                </span>
              )}
              {discount && (
                <span className="text-sm font-semibold text-green-600">Save {discount}%</span>
              )}
            </div>

            {/* Description */}
            <div className="prose prose-sm text-gray-600 mb-6 leading-relaxed">
              <p>{product.description}</p>
            </div>

            {/* Shipping info */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Truck size={16} className="text-primary-500 shrink-0" />
                <span>
                  Shipping charge:{' '}
                  {product.shipping_charge === 0
                    ? <strong className="text-green-600">FREE</strong>
                    : <strong>{formatCurrency(product.shipping_charge)}</strong>}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Shield size={16} className="text-primary-500 shrink-0" />
                <span>Secure & safe payment</span>
              </div>
            </div>

            {/* CTA Button */}
            <Button
              variant="primary"
              size="lg"
              disabled={isOutOfStock}
              onClick={() => navigate(`/checkout/${token}`)}
              className="w-full text-base"
              leftIcon={<ShoppingCart size={20} />}
            >
              {isOutOfStock ? 'Out of Stock' : 'Buy Now'}
            </Button>

            {!isOutOfStock && (
              <p className="text-xs text-gray-400 text-center mt-3">
                Secure checkout powered by Razorpay
              </p>
            )}
          </div>
        </div>

        {/* Video section */}
        {product.video_url && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Product Video</h2>
            <div className="aspect-video rounded-2xl overflow-hidden bg-black">
              <iframe
                src={product.video_url}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Product video"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-16 border-t border-gray-200 bg-white py-6">
        <p className="text-center text-sm text-gray-400">
          Powered by{' '}
          <span className="font-semibold text-primary-600">CueCom</span> — Product Link Commerce
        </p>
      </div>
    </div>
  );
}
