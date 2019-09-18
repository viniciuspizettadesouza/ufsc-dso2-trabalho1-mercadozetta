import React from 'react';
import { BrowserRouter, Route } from 'react-router-dom';

import AddProduct from './pages/AddProduct';
import AddUser from './pages/AddUser';
import Login from './pages/Login';
import Index from './pages/Index';

export default function Routes() {
    return (
        <BrowserRouter>
            <Route path="/" exact component={Index} />
            <Route path="/user/:id" component={Index} />
            <Route path="/login" exact component={Login} />
            <Route path="/add-user" component={AddUser} />
            <Route path="/add-product" component={AddProduct} />
        </BrowserRouter>
    );
}
