import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  useLocation,
} from 'react-router';
import type { ReactNode } from 'react';

import AddProduct from '@/pages/AddProduct';
import AddUser from '@/pages/AddUser';
import Login from '@/pages/Login';
import Index from '@/pages/Index';
import Checkout from '@/pages/Checkout';
import AdminDashboard from '@/pages/AdminDashboard';
import ProductDetail from '@/pages/ProductDetail';
import SellerProfile from '@/pages/SellerProfile';
import SellerOrders from '@/pages/SellerOrders';
import { BrandProvider } from '@/brands/BrandProvider';
import { routePatterns } from '@/routes';

type AuthenticatedRouteProps = {
  children: ReactNode;
  prompt: string;
};

function AuthenticatedRoute({ children, prompt }: AuthenticatedRouteProps) {
  const location = useLocation();

  if (!localStorage.getItem('token')) {
    return (
      <Navigate
        replace
        state={{ from: location.pathname, prompt }}
        to={routePatterns.login}
      />
    );
  }

  return children;
}

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
    element: (
      <AuthenticatedRoute prompt="Entre para criar um anúncio.">
        <AddProduct />
      </AuthenticatedRoute>
    ),
  },
  {
    path: routePatterns.productDetail,
    element: <ProductDetail />,
  },
  {
    path: routePatterns.checkout,
    element: (
      <AuthenticatedRoute prompt="Entre para acessar o checkout.">
        <Checkout />
      </AuthenticatedRoute>
    ),
  },
  {
    path: routePatterns.admin,
    element: (
      <AuthenticatedRoute prompt="Entre para acessar o painel administrativo.">
        <AdminDashboard />
      </AuthenticatedRoute>
    ),
  },
  {
    path: routePatterns.sellerOrders,
    element: (
      <AuthenticatedRoute prompt="Entre para acessar os pedidos de vendedor.">
        <SellerOrders />
      </AuthenticatedRoute>
    ),
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
