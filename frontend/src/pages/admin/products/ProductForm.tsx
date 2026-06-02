import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi } from '../../../api/products';
import { ProductStatus } from '../../../types';
import type { ProductFormData } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Input, Textarea, Select } from '../../../components/ui/Input';
import { PageSpinner } from '../../../components/ui/Spinner';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers and hyphens'),
  description: z.string().min(1, 'Description is required'),
  price: z.coerce.number().positive('Price must be greater than 0'),
  discount_price: z.coerce.number().min(0).nullable(),
  sku: z.string().min(1, 'SKU is required'),
  category: z.string().min(1, 'Category is required'),
  stock_quantity: z.coerce.number().int().min(0, 'Stock cannot be negative'),
  weight: z.coerce.number().min(0).nullable(),
  shipping_charge: z.coerce.number().min(0),
  status: z.nativeEnum(ProductStatus),
  images: z.array(z.object({ url: z.string().url('Enter a valid image URL').or(z.literal('')) })),
  video_url: z.string(),
  seo_title: z.string(),
  seo_description: z.string(),
});

type FormData = z.infer<typeof schema>;

const statusOptions = [
  { value: ProductStatus.DRAFT, label: 'Draft' },
  { value: ProductStatus.ACTIVE, label: 'Active' },
  { value: ProductStatus.OUT_OF_STOCK, label: 'Out of Stock' },
  { value: ProductStatus.ARCHIVED, label: 'Archived' },
];

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.get(Number(id)),
    enabled: isEdit,
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      price: 0,
      discount_price: null,
      sku: '',
      category: '',
      stock_quantity: 0,
      weight: null,
      shipping_charge: 0,
      status: ProductStatus.DRAFT,
      images: [{ url: '' }],
      video_url: '',
      seo_title: '',
      seo_description: '',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'images' });

  const nameValue = watch('name');

  // Auto-generate slug from name (only when creating)
  useEffect(() => {
    if (!isEdit) {
      setValue('slug', slugify(nameValue || ''));
    }
  }, [nameValue, isEdit, setValue]);

  // Populate form when editing
  useEffect(() => {
    if (product) {
      setValue('name', product.name);
      setValue('slug', product.slug);
      setValue('description', product.description);
      setValue('price', product.price);
      setValue('discount_price', product.discount_price);
      setValue('sku', product.sku);
      setValue('category', product.category);
      setValue('stock_quantity', product.stock_quantity);
      setValue('weight', product.weight);
      setValue('shipping_charge', product.shipping_charge);
      setValue('status', product.status);
      setValue('images', product.images.length > 0 ? product.images.map((u) => ({ url: u })) : [{ url: '' }]);
      setValue('video_url', product.video_url || '');
      setValue('seo_title', product.seo_title || '');
      setValue('seo_description', product.seo_description || '');
    }
  }, [product, setValue]);

  const createMutation = useMutation({
    mutationFn: (payload: ProductFormData) => productsApi.create(payload),
    onSuccess: () => {
      toast.success('Product created!');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/admin/products');
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to create product'),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: ProductFormData) => productsApi.update(Number(id), payload),
    onSuccess: () => {
      toast.success('Product updated!');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      navigate('/admin/products');
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to update product'),
  });

  const onSubmit = (data: FormData) => {
    const payload: ProductFormData = {
      ...data,
      images: data.images.map((i) => i.url).filter(Boolean),
      discount_price: data.discount_price || null,
      weight: data.weight || null,
    };
    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isEdit && isLoading) return <PageSpinner />;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/admin/products')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Products
      </button>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Basic Information</h2>
          <div className="space-y-4">
            <Input
              label="Product Name *"
              placeholder="e.g. Organic Honey 500g"
              error={errors.name?.message}
              {...register('name')}
            />

            <Input
              label="Slug *"
              placeholder="e.g. organic-honey-500g"
              helperText="URL-friendly identifier. Auto-generated from name."
              error={errors.slug?.message}
              {...register('slug')}
            />

            <Textarea
              label="Description *"
              placeholder="Describe your product..."
              rows={4}
              error={errors.description?.message}
              {...register('description')}
            />
          </div>
        </div>

        {/* Pricing & Inventory */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Pricing & Inventory</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Price (₹) *"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              error={errors.price?.message}
              {...register('price')}
            />
            <Input
              label="Discount Price (₹)"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              helperText="Original price shown as strikethrough"
              error={errors.discount_price?.message}
              {...register('discount_price')}
            />
            <Input
              label="SKU *"
              placeholder="e.g. HON-001"
              error={errors.sku?.message}
              {...register('sku')}
            />
            <Input
              label="Category *"
              placeholder="e.g. Food & Beverages"
              error={errors.category?.message}
              {...register('category')}
            />
            <Input
              label="Stock Quantity *"
              type="number"
              min="0"
              placeholder="0"
              error={errors.stock_quantity?.message}
              {...register('stock_quantity')}
            />
            <Input
              label="Weight (grams)"
              type="number"
              min="0"
              placeholder="e.g. 500"
              error={errors.weight?.message}
              {...register('weight')}
            />
            <Input
              label="Shipping Charge (₹)"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              error={errors.shipping_charge?.message}
              {...register('shipping_charge')}
            />
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  label="Status *"
                  options={statusOptions}
                  error={errors.status?.message}
                  {...field}
                />
              )}
            />
          </div>
        </div>

        {/* Media */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Media</h2>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Image URLs (up to 5)
              </label>
              {fields.length < 5 && (
                <button
                  type="button"
                  onClick={() => append({ url: '' })}
                  className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium"
                >
                  <Plus size={13} /> Add Image
                </button>
              )}
            </div>
            <div className="space-y-2">
              {fields.map((field, idx) => (
                <div key={field.id} className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder={`Image URL ${idx + 1}`}
                      error={errors.images?.[idx]?.url?.message}
                      {...register(`images.${idx}.url`)}
                    />
                  </div>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Input
            label="Video URL"
            placeholder="https://youtube.com/..."
            error={errors.video_url?.message}
            {...register('video_url')}
          />
        </div>

        {/* SEO */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">SEO</h2>
          <div className="space-y-4">
            <Input
              label="SEO Title"
              placeholder="Page title for search engines"
              error={errors.seo_title?.message}
              {...register('seo_title')}
            />
            <Textarea
              label="SEO Description"
              placeholder="Brief description for search engines..."
              rows={3}
              error={errors.seo_description?.message}
              {...register('seo_description')}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/admin/products')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting || createMutation.isPending || updateMutation.isPending}
          >
            {isEdit ? 'Save Changes' : 'Create Product'}
          </Button>
        </div>
      </form>
    </div>
  );
}
