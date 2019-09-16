import React from 'react';
import { BrowserRouter, Route } from 'react-router-dom';

import Register from './pages/Register';
import Login from './pages/Login';
import Main from './pages/Main';
import Index from './pages/Index';


export default function Routes() {
    return (
        <BrowserRouter>
            <Route path="/" exact component={Index} />
            <Route path="/login" exact component={Login} />
            <Route path="/register" component={Register} />
            <Route path="/user/:id" component={Main} />
        </BrowserRouter>
    );
}
