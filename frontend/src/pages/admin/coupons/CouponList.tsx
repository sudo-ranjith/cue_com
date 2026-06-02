import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ToggleLeft, ToggleRight, Tag } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { couponsApi } from '../../../api/coupons';
import { DiscountType } from '../../../types';
import type { CouponFormData } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Input, Select } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Pagination } from '../../../components/ui/Pagination';
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../../../components/ui/Table';
import { PageSpinner } from '../../../components/ui/Spinner';
import { EmptyState } from '../../../components/ui/EmptyState';

const schema = z.object({
  code: z.string().min(3, 'Code must be at least 3 characters').toUpperCase(),
  discount_type: z.nativeEnum(DiscountType),
  discount_value: z.coerce.number().positive('Must be greater than 0'),
  min_order_amount: z.coerce.number().min(0).nullable(),
  max_uses: z.coerce.number().int().min(1).nullable(),
  is_active: z.boolean(),
  expires_at: z.string().nullable(),
});

type FormData = z.infer<typeof schema>;

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function CouponList() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['coupons', page],
    queryFn: () => couponsApi.list({ page, per_page: 20 }),
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      discount_type: DiscountType.PERCENTAGE,
      discount_value: 10,
      min_order_amount: null,
      max_uses: null,
      is_active: true,
      expires_at: null,
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: CouponFormData) => couponsApi.create(payload),
    onSuccess: () => {
      toast.success('Coupon created!');
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      setShowCreate(false);
      reset();
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to create coupon'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      couponsApi.toggle(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
    onError: () => toast.error('Failed to toggle coupon'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => couponsApi.delete(id),
    onSuccess: () => {
      toast.success('Coupon deleted');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
    onError: () => toast.error('Failed to delete coupon'),
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate({
      ...data,
      min_order_amount: data.min_order_amount || null,
      max_uses: data.max_uses || null,
      expires_at: data.expires_at || null,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
          Create Coupon
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <PageSpinner />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="No coupons yet"
            description="Create your first coupon to offer discounts to customers."
            icon={<Tag size={28} />}
            action={
              <Button variant="primary" leftIcon={<Plus size={16} />} size="sm" onClick={() => setShowCreate(true)}>
                Create Coupon
              </Button>
            }
          />
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableTh>Code</TableTh>
                  <TableTh>Type</TableTh>
                  <TableTh>Value</TableTh>
                  <TableTh>Min Order</TableTh>
                  <TableTh>Uses</TableTh>
                  <TableTh>Expiry</TableTh>
                  <TableTh>Status</TableTh>
                  <TableTh className="text-right">Actions</TableTh>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.items.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableTd>
                      <code className="bg-gray-100 px-2 py-0.5 rounded text-gray-800 font-mono text-xs font-semibold">
                        {coupon.code}
                      </code>
                    </TableTd>
                    <TableTd className="capitalize">{coupon.discount_type}</TableTd>
                    <TableTd>
                      {coupon.discount_type === DiscountType.PERCENTAGE
                        ? `${coupon.discount_value}%`
                        : formatCurrency(coupon.discount_value)}
                    </TableTd>
                    <TableTd>
                      {coupon.min_order_amount ? formatCurrency(coupon.min_order_amount) : '—'}
                    </TableTd>
                    <TableTd>
                      {coupon.used_count}
                      {coupon.max_uses ? ` / ${coupon.max_uses}` : ''}
                    </TableTd>
                    <TableTd>
                      {coupon.expires_at
                        ? format(new Date(coupon.expires_at), 'dd MMM yyyy')
                        : '—'}
                    </TableTd>
                    <TableTd>
                      <Badge color={coupon.is_active ? 'green' : 'gray'}>
                        {coupon.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableTd>
                    <TableTd>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() =>
                            toggleMutation.mutate({ id: coupon.id, isActive: !coupon.is_active })
                          }
                          title={coupon.is_active ? 'Deactivate' : 'Activate'}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          {coupon.is_active ? (
                            <ToggleRight size={18} className="text-green-500" />
                          ) : (
                            <ToggleLeft size={18} />
                          )}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(coupon.id)}
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

      {/* Create Coupon Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); reset(); }}
        title="Create Coupon"
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Coupon Code *"
            placeholder="e.g. SAVE20"
            error={errors.code?.message}
            style={{ textTransform: 'uppercase' }}
            {...register('code')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Controller
              control={control}
              name="discount_type"
              render={({ field }) => (
                <Select
                  label="Discount Type"
                  options={[
                    { value: DiscountType.PERCENTAGE, label: 'Percentage (%)' },
                    { value: DiscountType.FLAT, label: 'Flat Amount (₹)' },
                  ]}
                  error={errors.discount_type?.message}
                  {...field}
                />
              )}
            />
            <Input
              label="Discount Value *"
              type="number"
              step="0.01"
              min="0"
              placeholder="10"
              error={errors.discount_value?.message}
              {...register('discount_value')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Min Order Amount (₹)"
              type="number"
              min="0"
              placeholder="Optional"
              error={errors.min_order_amount?.message}
              {...register('min_order_amount')}
            />
            <Input
              label="Max Uses"
              type="number"
              min="1"
              placeholder="Unlimited"
              error={errors.max_uses?.message}
              {...register('max_uses')}
            />
          </div>

          <Input
            label="Expiry Date"
            type="date"
            error={errors.expires_at?.message}
            {...register('expires_at')}
          />

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              {...register('is_active')}
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              Active (coupon can be used immediately)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowCreate(false); reset(); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={isSubmitting || createMutation.isPending}>
              Create Coupon
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete Coupon"
        size="sm"
      >
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete this coupon? This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => deleteTarget !== null && deleteMutation.mutate(deleteTarget)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
