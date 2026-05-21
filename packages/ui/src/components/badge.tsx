import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils';

const badgeVariants = cva('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-gray-700 text-gray-300',
      success: 'bg-green-900 text-green-300',
      warning: 'bg-yellow-900 text-yellow-300',
      danger: 'bg-red-900 text-red-300',
      info: 'bg-blue-900 text-blue-300',
      purple: 'bg-purple-900 text-purple-300',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
