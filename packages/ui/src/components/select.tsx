import { type SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, label, error, id, options, placeholder, ...props }, ref) => (
  <div className="space-y-1">
    {label && <label htmlFor={id} className="block text-sm text-gray-400">{label}</label>}
    <select
      ref={ref}
      id={id}
      className={cn(
        'w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50',
        error && 'border-red-500',
        className,
      )}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>
));
Select.displayName = 'Select';
