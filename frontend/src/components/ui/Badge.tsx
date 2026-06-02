import React from 'react';
import { clsx } from 'clsx';
import { ProductStatus, OrderStatus, PaymentStatus } from '../../types';

type BadgeColor = 'gray' | 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'orange' | 'teal' | 'indigo';

interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
  className?: string;
}

const colorClasses: Record<BadgeColor, string> = {
  gray: 'bg-gray-100 text-gray-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700',
  teal: 'bg-teal-100 text-teal-700',
  indigo: 'bg-indigo-100 text-indigo-700',
};

export function Badge({ children, color = 'gray', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        colorClasses[color],
        className
      )}
    >
      {children}
    </span>
  );
}

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const config: Record<ProductStatus, { label: string; color: BadgeColor }> = {
    [ProductStatus.DRAFT]: { label: 'Draft', color: 'gray' },
    [ProductStatus.ACTIVE]: { label: 'Active', color: 'green' },
    [ProductStatus.OUT_OF_STOCK]: { label: 'Out of Stock', color: 'red' },
    [ProductStatus.ARCHIVED]: { label: 'Archived', color: 'yellow' },
  };

  const { label, color } = config[status] || { label: status, color: 'gray' };
  return <Badge color={color}>{label}</Badge>;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config: Record<OrderStatus, { label: string; color: BadgeColor }> = {
    [OrderStatus.PENDING]: { label: 'Pending', color: 'yellow' },
    [OrderStatus.PAID]: { label: 'Paid', color: 'blue' },
    [OrderStatus.PROCESSING]: { label: 'Processing', color: 'purple' },
    [OrderStatus.PACKED]: { label: 'Packed', color: 'orange' },
    [OrderStatus.SHIPPED]: { label: 'Shipped', color: 'teal' },
    [OrderStatus.DELIVERED]: { label: 'Delivered', color: 'green' },
    [OrderStatus.CANCELLED]: { label: 'Cancelled', color: 'red' },
    [OrderStatus.REFUNDED]: { label: 'Refunded', color: 'gray' },
  };

  const { label, color } = config[status] || { label: status, color: 'gray' };
  return <Badge color={color}>{label}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const config: Record<PaymentStatus, { label: string; color: BadgeColor }> = {
    [PaymentStatus.PENDING]: { label: 'Pending', color: 'yellow' },
    [PaymentStatus.COMPLETED]: { label: 'Completed', color: 'green' },
    [PaymentStatus.FAILED]: { label: 'Failed', color: 'red' },
    [PaymentStatus.REFUNDED]: { label: 'Refunded', color: 'gray' },
  };

  const { label, color } = config[status] || { label: status, color: 'gray' };
  return <Badge color={color}>{label}</Badge>;
}
