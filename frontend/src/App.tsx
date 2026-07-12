import { createBrowserRouter, RouterProvider } from 'react-router';

import AddProduct from '@/pages/AddProduct';
import AddUser from '@/pages/AddUser';
import Login from '@/pages/Login';
import Index from '@/pages/Index';
import Checkout from '@/pages/Checkout';
import AdminDashboard from '@/pages/AdminDashboard';
import ProductDetail from '@/pages/ProductDetail';
import SellerProfile from '@/pages/SellerProfile';
import { BrandProvider } from '@/brands/BrandProvider';
import { routePatterns } from '@/routes';

const router = createBrowserRouter([
  {
    path: routePatterns.home,
    element: <Index />,
  },
  {
    path: routePatterns.sellerProducts,
    element: <Index />,
  },
  {
    path: routePatterns.sellerProfile,
    element: <SellerProfile />,
  },
  {
    path: routePatterns.login,
    element: <Login />,
  },
  {
    path: routePatterns.register,
    element: <AddUser />,
  },
  {
    path: routePatterns.newProduct,
    element: <AddProduct />,
  },
  {
    path: routePatterns.productDetail,
    element: <ProductDetail />,
  },
  {
    path: routePatterns.checkout,
    element: <Checkout />,
  },
  {
    path: routePatterns.admin,
    element: <AdminDashboard />,
  },
]);

export default function App() {
  return (
    <BrandProvider>
      <RouterProvider router={router} />
    </BrandProvider>
  );
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => router.dispose());
}
