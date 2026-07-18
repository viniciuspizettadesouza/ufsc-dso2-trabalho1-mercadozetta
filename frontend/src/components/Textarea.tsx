import type { TextareaHTMLAttributes } from 'react';

import { classes, fieldClasses } from '@/components/controlStyles';

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={classes(fieldClasses, 'min-h-24', className)}
      {...props}
    />
  );
}
