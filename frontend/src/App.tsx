import {
  createBrowserRouter,
  RouterProvider
} from "react-router-dom";
import "./index.css";

import AddProduct from './pages/AddProduct';
import AddUser from './pages/AddUser';
import Login from './pages/Login';
import Index from './pages/Index';

const router = createBrowserRouter([
  {
    path: "/",
    element: <Index />,
  },
  {
    path: "/user/:id",
    element: <Index />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/add-user",
    element: <AddUser />,
  },
  {
    path: "/add-product",
    element: <AddProduct />,
  },
]);

export default function App() {
  return <RouterProvider router={router} fallbackElement={<p>Loading...</p>} />;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => router.dispose());
}