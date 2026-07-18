import type { ButtonHTMLAttributes } from 'react';

import { classes } from '@/components/controlStyles';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

export function Button({
  className,
  variant = 'secondary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={classes(
        'min-h-10 cursor-pointer rounded-control border px-3 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'primary'
          ? 'border-action bg-action text-on-action'
          : 'border-theme-border bg-surface text-content',
        className,
      )}
      {...props}
    />
  );
}
