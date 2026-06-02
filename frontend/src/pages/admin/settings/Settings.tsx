import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Building2, CreditCard, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsApi } from '../../../api/settings';
import type { CompanySettings, PaymentSettings, NotificationSettings } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Input, Textarea } from '../../../components/ui/Input';
import { PageSpinner } from '../../../components/ui/Spinner';
import { clsx } from 'clsx';

type Tab = 'company' | 'payment' | 'notifications';

const companySchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  gst_number: z.string(),
  address: z.string(),
  phone: z.string(),
  logo_url: z.string(),
  website: z.string(),
});

const paymentSchema = z.object({
  razorpay_key_id: z.string().min(1, 'Key ID is required'),
  razorpay_key_secret: z.string().min(1, 'Key Secret is required'),
});

const notifSchema = z.object({
  smtp_host: z.string(),
  smtp_port: z.coerce.number().int().min(1).max(65535),
  smtp_user: z.string(),
  smtp_password: z.string(),
  from_email: z.string().email().or(z.literal('')),
  from_name: z.string(),
});

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'company', label: 'Company Info', icon: <Building2 size={16} /> },
  { id: 'payment', label: 'Payment', icon: <CreditCard size={16} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('company');
  const [showSecret, setShowSecret] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });

  // Company Form
  const companyForm = useForm<CompanySettings>({
    resolver: zodResolver(companySchema),
    defaultValues: { company_name: '', gst_number: '', address: '', phone: '', logo_url: '', website: '' },
  });

  const paymentForm = useForm<PaymentSettings>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { razorpay_key_id: '', razorpay_key_secret: '' },
  });

  const notifForm = useForm<NotificationSettings>({
    resolver: zodResolver(notifSchema),
    defaultValues: { smtp_host: '', smtp_port: 587, smtp_user: '', smtp_password: '', from_email: '', from_name: '' },
  });

  useEffect(() => {
    if (data) {
      companyForm.reset(data.company);
      paymentForm.reset(data.payment);
      notifForm.reset(data.notification);
    }
  }, [data]); // eslint-disable-line

  const companyMutation = useMutation({
    mutationFn: (payload: CompanySettings) => settingsApi.updateCompany(payload),
    onSuccess: () => { toast.success('Company settings saved'); queryClient.invalidateQueries({ queryKey: ['settings'] }); },
    onError: () => toast.error('Failed to save company settings'),
  });

  const paymentMutation = useMutation({
    mutationFn: (payload: PaymentSettings) => settingsApi.updatePayment(payload),
    onSuccess: () => { toast.success('Payment settings saved'); queryClient.invalidateQueries({ queryKey: ['settings'] }); },
    onError: () => toast.error('Failed to save payment settings'),
  });

  const notifMutation = useMutation({
    mutationFn: (payload: NotificationSettings) => settingsApi.updateNotification(payload),
    onSuccess: () => { toast.success('Notification settings saved'); queryClient.invalidateQueries({ queryKey: ['settings'] }); },
    onError: () => toast.error('Failed to save notification settings'),
  });

  if (isLoading) return <PageSpinner />;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Company Info */}
          {activeTab === 'company' && (
            <form
              onSubmit={companyForm.handleSubmit((d) => companyMutation.mutate(d))}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Company Name *"
                  error={companyForm.formState.errors.company_name?.message}
                  {...companyForm.register('company_name')}
                />
                <Input
                  label="GST Number"
                  placeholder="22AAAAA0000A1Z5"
                  {...companyForm.register('gst_number')}
                />
              </div>
              <Textarea
                label="Address"
                rows={3}
                {...companyForm.register('address')}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  {...companyForm.register('phone')}
                />
                <Input
                  label="Website"
                  type="url"
                  placeholder="https://yourstore.com"
                  {...companyForm.register('website')}
                />
              </div>
              <Input
                label="Logo URL"
                placeholder="https://..."
                {...companyForm.register('logo_url')}
              />
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  loading={companyMutation.isPending}
                >
                  Save Company Info
                </Button>
              </div>
            </form>
          )}

          {/* Payment Settings */}
          {activeTab === 'payment' && (
            <form
              onSubmit={paymentForm.handleSubmit((d) => paymentMutation.mutate(d))}
              className="space-y-4"
            >
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 mb-2">
                Your Razorpay credentials are stored securely. The secret key is never exposed to the frontend during transactions.
              </div>
              <Input
                label="Razorpay Key ID *"
                placeholder="rzp_live_..."
                error={paymentForm.formState.errors.razorpay_key_id?.message}
                {...paymentForm.register('razorpay_key_id')}
              />
              <div className="relative">
                <Input
                  label="Razorpay Key Secret *"
                  type={showSecret ? 'text' : 'password'}
                  placeholder="••••••••••••••••"
                  error={paymentForm.formState.errors.razorpay_key_secret?.message}
                  rightAddon={
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                  {...paymentForm.register('razorpay_key_secret')}
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  loading={paymentMutation.isPending}
                >
                  Save Payment Settings
                </Button>
              </div>
            </form>
          )}

          {/* Notification Settings */}
          {activeTab === 'notifications' && (
            <form
              onSubmit={notifForm.handleSubmit((d) => notifMutation.mutate(d))}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <Input
                    label="SMTP Host"
                    placeholder="smtp.gmail.com"
                    {...notifForm.register('smtp_host')}
                  />
                </div>
                <Input
                  label="SMTP Port"
                  type="number"
                  placeholder="587"
                  error={notifForm.formState.errors.smtp_port?.message}
                  {...notifForm.register('smtp_port')}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="SMTP Username"
                  placeholder="your@email.com"
                  {...notifForm.register('smtp_user')}
                />
                <Input
                  label="SMTP Password"
                  type="password"
                  placeholder="••••••••"
                  {...notifForm.register('smtp_password')}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="From Email"
                  type="email"
                  placeholder="orders@yourstore.com"
                  error={notifForm.formState.errors.from_email?.message}
                  {...notifForm.register('from_email')}
                />
                <Input
                  label="From Name"
                  placeholder="YourStore"
                  {...notifForm.register('from_name')}
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  loading={notifMutation.isPending}
                >
                  Save Notification Settings
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
