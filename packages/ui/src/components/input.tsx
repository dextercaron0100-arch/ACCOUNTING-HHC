import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, label, error, id, ...props }, ref) => (
  <div className="space-y-1">
    {label && <label htmlFor={id} className="block text-sm text-gray-400">{label}</label>}
    <input
      ref={ref}
      id={id}
      className={cn(
        'w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-white text-sm placeholder-gray-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50',
        error && 'border-red-500 focus:ring-red-500',
        className,
      )}
      {...props}
    />
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>
));
Input.displayName = 'Input';
