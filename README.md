# MercadoZetta

MercadoZetta is a marketplace project for INE5612 - Desenvolvimento de Sistemas Orientados a Objetos II.

The app lets users search products, create an account, log in with email and password, and create products for sale. Product creation is protected by JWT authentication, and each created product is linked to the authenticated seller.

## Stack

- Backend: Node.js, Express, MongoDB, Mongoose, JWT, bcryptjs
- Frontend: React, TypeScript, Vite, React Router, Axios
- Tests: Vitest, Supertest, Testing Library

## Project Structure

```text
backend/    Express API and MongoDB models
frontend/   React + Vite web app
images/     Project images used by this README
```

## Environment Setup

Create a backend environment file from the example:

```bash
cd backend
cp .env.example .env
```

Set these values in `backend/.env`:

```env
MONGODB_URI=mongodb+srv://user:password@cluster.example.mongodb.net/mercadozetta?retryWrites=true&w=majority
JWT_SECRET=replace_with_a_long_random_secret
PORT=3333
```

Create a frontend environment file from the example:

```bash
cd frontend
cp .env.example .env
```

Set the API URL in `frontend/.env`:

```env
VITE_API_URL=http://localhost:3333
```

## Install

Install dependencies separately in each app:

```bash
cd backend
npm install
```

```bash
cd frontend
npm install
```

## Run

Start the backend:

```bash
cd backend
npm run dev
```

Start the frontend:

```bash
cd frontend
npm run dev
```

The backend defaults to `http://localhost:3333`. Vite will print the frontend URL in the terminal, usually `http://localhost:5173`.

## Main Features

- Product search on the home page
- User registration
- Login with email and password
- JWT token storage in the frontend
- Authenticated product creation
- Seller-specific product listing on `/user/:id`

## Useful Commands

Backend:

```bash
cd backend
npm test
npm audit
```

Frontend:

```bash
cd frontend
npm test
npm run build
npm run lint
npm audit
```

## Manual Smoke Test

After configuring the `.env` files and starting both servers:

1. Create a user at `/add-user`.
2. Log in at `/login`.
3. Create a product at `/add-product`.
4. Confirm the logged-in seller page shows only that seller's products.

<img src="images/mercadozetta.jpg" width="400">
