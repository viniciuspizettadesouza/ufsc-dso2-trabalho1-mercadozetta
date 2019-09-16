import React from 'react';
import { BrowserRouter, Route } from 'react-router-dom';

import RegisterProduct from './pages/RegisterProduct';
import RegisterUser from './pages/RegisterUser';
import Login from './pages/Login';
import Products from './pages/Products';
import Index from './pages/Index';


export default function Routes() {
    return (
        <BrowserRouter>
            <Route path="/" exact component={Index} />
            <Route path="/login" exact component={Login} />
            <Route path="/register-user" component={RegisterUser} />
            <Route path="/register-product" component={RegisterProduct} />
            <Route path="/user/:id" component={Products} />
        </BrowserRouter>
    );
}
