import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Package, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('order');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Animated checkmark */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center animate-bounce">
              <CheckCircle size={52} className="text-green-500" strokeWidth={1.5} />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-500 text-sm mb-2">
            Thank you for your order. We've received your payment and will process it shortly.
          </p>

          {orderNumber && (
            <div className="bg-gray-50 rounded-xl px-5 py-3 my-6 inline-block w-full">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
                Order Number
              </p>
              <p className="text-xl font-bold text-gray-900 font-mono">{orderNumber}</p>
            </div>
          )}

          <p className="text-sm text-gray-500 mb-8">
            A confirmation has been sent to your email. You can track your order status anytime.
          </p>

          <div className="flex flex-col gap-3">
            <Link to={`/track${orderNumber ? `?order=${orderNumber}` : ''}`}>
              <Button variant="primary" size="lg" className="w-full" leftIcon={<Package size={18} />}>
                Track My Order
              </Button>
            </Link>
            <Link to="/">
              <Button variant="ghost" size="md" className="w-full" leftIcon={<ArrowLeft size={16} />}>
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by <span className="font-semibold text-primary-600">CueCom</span>
        </p>
      </div>
    </div>
  );
}
