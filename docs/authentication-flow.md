# Authentication Flow

These diagrams show how MercadoZetta authenticates users and reuses the JWT for
protected product creation. The flow is split between frontend and backend to
keep each diagram readable.

## High-Level Flow

```mermaid
flowchart LR
    User[User] --> Login[Login form]
    Login --> Api[Frontend API service]
    Api --> Backend[Express API]
    Backend --> UserCheck[Find user and check password]

    UserCheck -->|valid credentials| Token[Sign tenant-aware JWT]
    UserCheck -->|invalid credentials| LoginError[Show login error]

    Token --> Store[Store token and user in localStorage]
    Store --> ProductForm[Create product form]
    ProductForm --> AuthHeader[Send Bearer token and tenant id]
    AuthHeader --> Verify[Verify JWT and tenant]

    Verify -->|valid token| CreateProduct[Create product for authenticated seller]
    Verify -->|invalid token| AuthError[Show auth/API error]

    Header[Header logout] --> ClearAuth[Clear token and user]
```

## Frontend Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Login as React Login page
    participant Api as Axios API service
    participant Browser as localStorage
    participant Header as React Header
    participant AddProduct as React AddProduct page

    User->>Login: Submit email and password
    Login->>Api: POST /auth/login
    Api->>Api: Add X-Tenant-Id header
    Api-->>Login: API response

    alt login succeeds
        Login->>Browser: Save token and user
        Login->>User: Navigate to seller products page
    else login fails
        Login->>User: Show invalid credentials message
    end

    User->>AddProduct: Submit product form
    AddProduct->>Browser: Read token and user

    alt token or user id is missing
        AddProduct->>User: Show sign-in-required message
    else token and user id exist
        AddProduct->>Api: POST /products
        Api->>Api: Add Authorization: Bearer token
        Api->>Api: Add X-Tenant-Id header
        Api-->>AddProduct: API response

        alt product creation succeeds
            AddProduct->>User: Navigate to seller products page
        else product creation fails
            AddProduct->>User: Show API error message
        end
    end

    User->>Header: Click logout
    Header->>Browser: Remove token and user
    Header->>User: Navigate home
```

## Backend Flow

```mermaid
sequenceDiagram
    autonumber
    participant Client as Frontend/Axios
    participant Tenant as tenantMiddleware
    participant Routes as Express routes
    participant Auth as AuthController/AuthService
    participant UserModel as User model
    participant AuthMw as authMiddleware
    participant Product as ProductController/ProductService

    Client->>Tenant: POST /auth/login with X-Tenant-Id
    Tenant->>Tenant: Resolve tenant from X-Tenant-Id
    Tenant->>Routes: Attach req.tenant
    Routes->>Routes: Apply auth rate limit
    Routes->>Routes: Validate login payload
    Routes->>Auth: authenticate(validated body, tenant id)
    Auth->>UserModel: Find user by tenantId and email
    UserModel-->>Auth: User document with password selected
    Auth->>Auth: Compare password with bcrypt

    alt credentials are valid
        Auth->>Auth: Sign JWT with user id and tenantId, expires in 1 day
        Auth-->>Client: 200 { user without password, token }
    else credentials are invalid
        Auth-->>Client: 401 Invalid credentials
    end

    Client->>Tenant: POST /products with X-Tenant-Id and Bearer token
    Tenant->>Tenant: Resolve tenant from X-Tenant-Id
    Tenant->>Routes: Attach req.tenant
    Routes->>AuthMw: Require authenticated request
    AuthMw->>AuthMw: Verify Bearer JWT with JWT_SECRET

    alt token is valid for current tenant
        AuthMw->>Routes: Set req.userId
        Routes->>Routes: Validate product payload
        Routes->>Product: createProduct(body, req.userId, tenant id)
        Product-->>Client: 201 Created
    else token is missing, malformed, invalid, expired, or wrong tenant
        AuthMw-->>Client: 401 auth error
    end
```

## Code Map

- Frontend login: `frontend/src/pages/Login.tsx`
- API request headers: `frontend/src/services/api.ts`
- Stored auth state and logout UI: `frontend/src/pages/header/index.tsx`
- Product creation auth check: `frontend/src/pages/AddProduct.tsx`
- Request tenant resolution: `backend/src/middleware/tenant.ts`
- Auth and protected routes: `backend/src/routes.ts`
- Login controller/service: `backend/src/controller/authController.ts` and `backend/src/services/authService.ts`
- JWT verification middleware: `backend/src/middleware/auth.ts`
- Authenticated product creation: `backend/src/controller/productController.ts`
