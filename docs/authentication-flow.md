# Authentication Flow

These diagrams show how MercadoZetta authenticates users, validates the
tenant-bound session, revokes access tokens on logout, and reuses the JWT for
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

    Token --> Store[Store short-lived token and user in localStorage]
    Store --> ProductForm[Create product form]
    ProductForm --> AuthHeader[Send Bearer token and tenant id]
    AuthHeader --> Verify[Verify JWT, tenant, user, and token version]

    Verify -->|valid token| CreateProduct[Create product for authenticated seller]
    Verify -->|invalid token| AuthError[Show auth/API error]

    Header[Header logout] --> Revoke[Increment server-side token version]
    Revoke --> ClearAuth[Clear token and user]
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
    Header->>Api: POST /auth/logout with Bearer token
    Api->>Api: Add X-Tenant-Id header
    Api-->>Header: 204, auth error, or network error
    Header->>Browser: Always remove token and user
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
    UserModel-->>Auth: User with password and tokenVersion selected
    Auth->>Auth: Compare password with bcrypt

    alt credentials are valid
        Auth->>Auth: Sign JWT with id, tenantId, and tokenVersion
        Note over Auth: Lifetime uses JWT_ACCESS_TOKEN_TTL (default 15m)
        Auth-->>Client: 200 { user without password or tokenVersion, token }
    else credentials are invalid
        Auth-->>Client: 401 Invalid credentials
    end

    Client->>Tenant: POST /products with X-Tenant-Id and Bearer token
    Tenant->>Tenant: Resolve tenant from X-Tenant-Id
    Tenant->>Routes: Attach req.tenant
    Routes->>AuthMw: Require authenticated request
    AuthMw->>AuthMw: Verify Bearer JWT with JWT_SECRET
    AuthMw->>AuthMw: Require id, tenantId, and tokenVersion claims
    AuthMw->>UserModel: Find matching tenant-scoped user and tokenVersion

    alt token and server-side session are valid for current tenant
        AuthMw->>Routes: Set req.userId
        Routes->>Routes: Validate product payload
        Routes->>Product: createProduct(body, req.userId, tenant id)
        Product-->>Client: 201 Created
    else token is missing, malformed, invalid, expired, revoked, or wrong tenant
        AuthMw-->>Client: 401 auth error
    end

    Client->>Tenant: POST /auth/logout with X-Tenant-Id and Bearer token
    Tenant->>Routes: Attach req.tenant
    Routes->>AuthMw: Validate current session
    AuthMw->>Auth: logout(user id, tenant id)
    Auth->>UserModel: Increment tokenVersion
    Auth-->>Client: 204 No Content
```

## Tenant Resolution

`tenantMiddleware` runs before every route. `TENANT_HEADER_REQUIRED` controls
whether requests without `X-Tenant-Id` are rejected. It defaults to `false` in
development and tests and `true` in production. When the header is optional,
requests without it use the default MercadoZetta tenant. Because the middleware
is global, strict mode currently also requires the header on public, health,
and readiness requests.

## Session Model

- Access tokens are stored in `localStorage` and sent as Bearer tokens. This is
  intentionally simple for the demo; the README records the XSS tradeoff and a
  possible future move to secure cookies.
- Every newly issued token contains the user id, tenant id, and the user's
  current `tokenVersion`.
- Protected requests verify both the JWT and a matching user record in MongoDB.
- Logout increments `tokenVersion`, invalidating every previously issued token
  for that user in the tenant. The frontend clears its local auth state even if
  the logout request fails.
- Users created before `tokenVersion` existed are treated as version `0` for
  backward compatibility.

## Code Map

- Frontend login: `frontend/src/pages/Login.tsx`
- API request headers: `frontend/src/services/api.ts`
- Stored auth state and logout UI: `frontend/src/pages/header/index.tsx`
- Product creation auth check: `frontend/src/pages/AddProduct.tsx`
- Request tenant resolution: `backend/src/middleware/tenant.ts`
- Auth and protected routes: `backend/src/routes.ts`
- Login controller/service: `backend/src/controller/authController.ts` and `backend/src/services/authService.ts`
- Security configuration: `backend/src/config/security.ts`
- JWT verification middleware: `backend/src/middleware/auth.ts`
- Authenticated product creation: `backend/src/controller/productController.ts`
