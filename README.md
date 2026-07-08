# MercadoZetta

MercadoZetta is a marketplace project for INE5612 - Desenvolvimento de Sistemas
Orientados a Objetos II.

The application lets users search products, create an account, log in with email
and password, and create products for sale. Product creation is protected by JWT,
and each created product is linked to the authenticated seller.

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

With Docker installed, create and start a MongoDB container:

```bash
docker run --name mercadozetta-mongo -p 27017:27017 -d mongo:7
```

If the container already exists but is stopped, start it again with:

```bash
docker start mercadozetta-mongo
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
```

`JWT_SECRET` is used to sign JWT tokens. For local development, it can be any
long string. In production, use a strong secret and never commit it to Git.

If you use MongoDB Atlas instead of local MongoDB, replace `MONGODB_URI` with
your Atlas connection string:

```env
MONGODB_URI=mongodb+srv://user:password@cluster.example.mongodb.net/mercadozetta?retryWrites=true&w=majority
JWT_SECRET=replace_with_a_long_random_secret
PORT=3333
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
```

Return to the project root:

```bash
cd ..
```

## 8. Run The Project

Keep two terminals open: one for the backend and one for the frontend.

In the first terminal, start the backend:

```bash
cd backend
npm run dev
```

The API should be available at:

```text
http://localhost:3333
```

In the second terminal, start the frontend:

```bash
cd frontend
npm run dev
```

Vite will print the frontend URL in the terminal. It is usually:

```text
http://localhost:5173
```

Open that URL in your browser.

## 9. Manual Smoke Test

With the backend, frontend, and MongoDB running:

1. Open `http://localhost:5173`.
2. Go to `/register`.
3. Create a user with email and password.
4. Go to `/login`.
5. Log in with the user you created.
6. Confirm that you are redirected to a page like `/sellers/:sellerId`.
7. Go to `/products/new`.
8. Create a product.
9. Return to the logged-in user's page.
10. Confirm that the product appears in that seller's product list.

Optionally, create a second user and another product. Then confirm that each
seller page only shows products from that seller.

## 10. Useful Commands

Run all automated tests from the project root:

```bash
npm test
```

Run all automated tests with coverage thresholds from the project root:

```bash
npm run test:coverage
```

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

## 11. Main Application Routes

- `/` - home page and product search
- `/register` - user registration
- `/login` - login
- `/products/new` - authenticated product creation
- `/sellers/:sellerId` - seller page with that seller's products

## 12. Important Notes

- `.env` files are local and should not be committed.
- The backend needs `MONGODB_URI` to start correctly.
- Product creation requires login.
- The frontend sends the JWT token stored in `localStorage` on authenticated
  requests.

<img src="images/mercadozetta.jpg" width="400">
