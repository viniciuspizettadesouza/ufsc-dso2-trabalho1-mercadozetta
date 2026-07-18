import type { SelectHTMLAttributes } from 'react';

import { classes, fieldClasses } from '@/components/controlStyles';

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={classes(fieldClasses, className)} {...props} />;
}
