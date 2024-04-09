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
    element: <Index history={undefined} />,
  },
  {
    path: "/user/:id",
    element: <Index history={undefined} />,
  },
  {
    path: "/login",
    element: <Login history={undefined} />,
  },
  {
    path: "/add-user",
    element: <AddUser history={undefined} />,
  },
  {
    path: "/add-product",
    element: <AddProduct history={undefined} />,
  },
]);

export default function App() {
  return <RouterProvider router={router} fallbackElement={<p>Loading...</p>} />;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => router.dispose());
}