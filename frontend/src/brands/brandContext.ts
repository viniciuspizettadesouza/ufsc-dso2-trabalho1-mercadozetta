import { createContext, useContext } from 'react';

import { defaultBrand } from '.';
import type { BrandConfig } from './schema';

export const BrandContext = createContext<BrandConfig>(defaultBrand);

export function useBrand() {
  return useContext(BrandContext);
}
