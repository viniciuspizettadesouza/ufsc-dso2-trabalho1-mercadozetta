import type { InputHTMLAttributes } from 'react';

import { classes, fieldClasses } from '@/components/controlStyles';

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={classes(fieldClasses, 'placeholder:text-muted', className)}
      {...props}
    />
  );
}
