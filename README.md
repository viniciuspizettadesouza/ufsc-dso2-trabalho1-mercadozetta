# MercadoZetta

MercadoZetta is a marketplace project for INE5612 - Desenvolvimento de Sistemas
Orientados a Objetos II.

The application lets users search products, create an account, log in with email
and password, and create products for sale. Product creation is protected by JWT,
and each created product is linked to the authenticated seller.

## Quick Start

For the common local development setup, install dependencies, copy the example
environment files, and start MongoDB, the backend, and the frontend:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run dev:local
```

Open the frontend URL printed by Vite. It is usually:

```text
http://localhost:5173
```

To run the full demo stack in Docker instead:

```bash
npm run compose:up
```

In another terminal, seed repeatable demo data:

```bash
npm run compose:seed
```

Useful root commands:

```bash
npm run db:up
npm run dev
npm run seed:demo
npm run compose:up
npm test
npm run lint
```

## 1. Technologies

- Backend: Node.js, Express, MongoDB, Mongoose, JWT, and bcryptjs
- Frontend: React, TypeScript, Vite, React Router, and Axios
- Tests: Vitest, Supertest, and Testing Library

## 2. Project Structure

```text
backend/    Express API, MongoDB models, and authentication rules
frontend/   React + Vite web application
images/     Images used by the documentation
```

## 3. Prerequisites

Before installing the project, make sure you have:

- Node.js 22.22 or newer
- npm
- Docker, if you want to use a local MongoDB for development
- Git

Check that Node.js and npm are available:

```bash
nvm use
node -v
npm -v
```

## 4. Clone The Repository

```bash
git clone <repository-url>
cd ufsc-dso2-trabalho1-mercadozetta
```

If you already have the repository cloned, enter the project folder:

```bash
cd ufsc-dso2-trabalho1-mercadozetta
```

## 5. Install Dependencies

Install the root, backend, and frontend dependencies:

```bash
npm install
```

```bash
cd backend
npm install
```

```bash
cd ../frontend
npm install
```

Return to the project root:

```bash
cd ..
```

## 6. Configure Local MongoDB For Development

For local development, you can use a local MongoDB instead of creating a MongoDB
Atlas database.

With Docker installed, start the local MongoDB container from the project root:

```bash
npm run db:up
```

The command starts the `mercadozetta-mongo` container. If the container does not
exist yet, Docker Compose creates it from `docker-compose.yml`.

To stop the local MongoDB container:

```bash
npm run db:down
```

To follow MongoDB logs:

```bash
npm run db:logs
```

The API will access the database at:

```text
mongodb://localhost:27017/mercadozetta
```

## 7. Configure Environment Variables

### Backend

Create the backend `.env` file from the example:

```bash
cd backend
cp .env.example .env
```

To use the local MongoDB Docker container, set `backend/.env` to:

```env
MONGODB_URI=mongodb://localhost:27017/mercadozetta
JWT_SECRET=local_dev_secret_please_change_later
PORT=3333
CORS_ORIGIN=http://localhost:5173
RATE_LIMIT_AUTH_WINDOW_MS=900000
RATE_LIMIT_AUTH_MAX=5
RATE_LIMIT_REGISTER_WINDOW_MS=900000
RATE_LIMIT_REGISTER_MAX=10
```

`JWT_SECRET` is used to sign JWT tokens. For local development, it can be any
long string. In production, use a strong secret and never commit it to Git.
`CORS_ORIGIN` accepts one or more comma-separated frontend origins. The rate
limit variables control the login and account creation windows in milliseconds.

If you use MongoDB Atlas instead of local MongoDB, replace `MONGODB_URI` with
your Atlas connection string:

```env
MONGODB_URI=mongodb+srv://user:password@cluster.example.mongodb.net/mercadozetta?retryWrites=true&w=majority
JWT_SECRET=replace_with_a_long_random_secret
PORT=3333
CORS_ORIGIN=https://your-frontend.example.com
RATE_LIMIT_AUTH_WINDOW_MS=900000
RATE_LIMIT_AUTH_MAX=5
RATE_LIMIT_REGISTER_WINDOW_MS=900000
RATE_LIMIT_REGISTER_MAX=10
```

### Frontend

Create the frontend `.env` file from the example:

```bash
cd ../frontend
cp .env.example .env
```

Set `frontend/.env` to point to the local API:

```env
VITE_API_URL=http://localhost:3333
VITE_TENANT_ID=mercadozetta
```

`VITE_TENANT_ID` selects the active white-label tenant. The default tenant is
`mercadozetta`; the sample second tenant is `campus-market`.

Return to the project root:

```bash
cd ..
```

## 8. Run The Project

From the project root, start MongoDB, the backend, and the frontend with:

```bash
npm run dev:local
```

This runs `npm run db:up` first, then starts both applications. The API should
be available at:

```text
http://localhost:3333
```

Vite will print the frontend URL in the terminal. It is usually:

```text
http://localhost:5173
```

Open that URL in your browser.

If MongoDB is already running and you only want to start the apps, run:

```bash
npm run dev
```

You can also run each app separately from the project root.

Start only the backend:

```bash
npm run dev:backend
```

Start only the frontend:

```bash
npm run dev:frontend
```

The older folder-specific commands still work too:

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev
```

## 9. Seed Demo Data

The demo seed creates users, sellers, and products for the built-in
`mercadozetta` and `campus-market` tenants. It is safe to run more than once:
seeded records are refreshed, and unrelated local data is left alone.

With MongoDB running through `npm run db:up`, seed the local database:

```bash
npm run seed:demo
```

With the Docker Compose stack, seed through the backend container:

```bash
npm run compose:seed
```

Demo MercadoZetta seller account:

```text
vinicius@mercadozetta.test
mercadozetta123
```

Demo CampusMarket seller account:

```text
vinicius@campus-market.test
campusmarket123
```

## 10. Docker Compose Demo

Docker Compose can run MongoDB, the backend API, and the frontend app together:

```bash
npm run compose:up
```

The services are exposed at:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:3333
MongoDB:  mongodb://localhost:27017/mercadozetta
```

After the stack is healthy, seed demo records from another terminal:

```bash
npm run compose:seed
```

Stop the stack with:

```bash
npm run compose:down
```

## 11. Manual Smoke Test

With the backend, frontend, and MongoDB running:

1. Open `http://localhost:5173`.
2. Run `npm run seed:demo` or `npm run compose:seed`.
3. Confirm that seeded products are visible on the home page or `/products`.
4. Go to `/login`.
5. Log in with `vinicius@mercadozetta.test` and `mercadozetta123`.
6. Confirm that you are redirected to `/sellers/660000000000000000000001`.
7. Confirm that the seller page lists the seeded MercadoZetta products.
8. Go to `/products/new`.
9. Create a product with any name, image URL, and positive quantity.
10. Confirm that the new product appears in that seller's product list.

Optionally, create a second user and another product. Then confirm that each
seller page only shows products from that seller.

## 12. Useful Commands

Start local MongoDB, backend, and frontend:

```bash
npm run dev:local
```

Start only local MongoDB:

```bash
npm run db:up
```

Start backend and frontend without changing MongoDB state:

```bash
npm run dev
```

Seed repeatable demo users, sellers, and products:

```bash
npm run seed:demo
```

Start the complete Docker Compose demo stack:

```bash
npm run compose:up
```

Seed the Docker Compose database:

```bash
npm run compose:seed
```

Stop the Docker Compose stack:

```bash
npm run compose:down
```

Run all automated tests from the project root:

```bash
npm test
```

Run all automated tests with coverage thresholds from the project root:

```bash
npm run test:coverage
```

CI validates pull requests and supported branch pushes with dependency audits,
backend tests, frontend tests, frontend lint, and frontend build.

Backend:

```bash
cd backend
npm test
npm run test:coverage
npm audit
```

Frontend:

```bash
cd frontend
npm test
npm run test:coverage
npm run build
npm run lint
npm audit
```

## 13. Main Application Routes

- `/` - home page and product search
- `/register` - user registration
- `/login` - login
- `/products/new` - authenticated product creation
- `/sellers/:sellerId` - seller page with that seller's products

## 14. Important Notes

- `.env` files are local and should not be committed.
- The backend needs `MONGODB_URI` to start correctly.
- The backend requires `JWT_SECRET` outside development and test environments.
- The backend exposes `GET /health` and `GET /ready` for uptime and dependency
  readiness checks.
- Product creation requires login.
- The frontend sends the JWT token stored in `localStorage` on authenticated
  requests.
- The frontend also sends `X-Tenant-Id` on API requests so the backend can keep
  tenant-owned users and products isolated.
- Supported tenants in this project are `mercadozetta` and `campus-market`.

<img src="images/mercadozetta.jpg" width="400">
