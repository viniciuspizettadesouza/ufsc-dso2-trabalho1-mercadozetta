# Product API Contract Audit

## Scope

This audit compares the product routes in `backend/src/routes.ts`, their
controller and service results, the PostgreSQL mappings, the Zod/OpenAPI source,
and the handwritten frontend contract in `frontend/src/serverState/products.ts`.
It records the contract gaps before frontend types are shared or generated in
Step 9.

## Implemented endpoint shapes

| Endpoint                                | Success response                                       | Expected application errors                                                                                                       |
| --------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `GET /products`                         | `{ items: Product[], page: PageInfo }`                 | `400` tenant or filter validation                                                                                                 |
| `GET /users/{userId}/products`          | `{ items: Product[], page: PageInfo }`                 | `400` seller ID, tenant, or filter validation                                                                                     |
| `GET /products/{productId}`             | `Product` with an optional best-effort `sellerProfile` | `400` product ID or tenant validation; `404 PRODUCT_NOT_FOUND`                                                                    |
| `POST /products`                        | `Product`                                              | `400` payload or tenant validation; `401` session; `403` Origin or CSRF                                                           |
| `PATCH /products/{productId}`           | `Product`                                              | `400` payload, product ID, or tenant validation; `401` session; `403 PRODUCT_FORBIDDEN`, Origin, or CSRF; `404 PRODUCT_NOT_FOUND` |
| `PATCH /products/{productId}/inventory` | `Product`                                              | `400` payload, product ID, or tenant validation; `401` session; `403 PRODUCT_FORBIDDEN`, Origin, or CSRF; `404 PRODUCT_NOT_FOUND` |
| `PATCH /products/{productId}/status`    | `Product`                                              | the same `400`, `401`, `403`, and `404` cases, plus `409 PRODUCT_STATUS_TRANSITION_INVALID` or `409 PRODUCT_INVENTORY_REQUIRED`   |

`PageInfo` is `{ limit, offset, total, hasMore }`. Product list routes always
return this envelope; the frontend's legacy fallback for a bare array is not an
implemented backend response.

## Concrete gaps found

1. OpenAPI modeled `seller` as either a UUID or a seller object. The runtime
   always returns the seller UUID and product detail adds a separate optional
   `sellerProfile`. The detail-only property was absent from the schema and its
   response example.
2. OpenAPI marked `category`, `subcategory`, `createdAt`, and `updatedAt` as
   optional even though the PostgreSQL mapping always returns them. It modeled
   `description` as an optional string even though the database value can be
   `null`.
3. Product, pagination, and error response schemas lived as private declarations
   inside the OpenAPI builder. They could document responses but could not be
   reused as the Step 9 contract source. The create response wrapper also had no
   named schema.
4. Product response examples omitted timestamps, and product detail omitted the
   seller profile that the composed PostgreSQL path returns when the seller
   lookup succeeds.
5. The frontend `Product` type makes `seller`, `inventory`, `status`, category
   fields, and timestamps optional. The backend contract guarantees all except
   `sellerProfile`; `description` is nullable. The frontend seller profile fields
   are optional, while the wire response uses required nullable `username` and
   `telephone` values.
6. The frontend accepts bare product arrays through `pageItems` and `pageInfo`,
   although both product list endpoints guarantee the pagination envelope.
7. Error bodies consistently used `{ error, code, details? }`, but the product
   endpoint metadata used generic descriptions and examples without enumerating
   the concrete codes above. Create was wrapped as `newProduct` while update
   mutations returned a bare product, so mutation responses were not uniform.

## Changes made from this audit

- Product, seller-profile, create-product, page-info, paginated-list, and error
  response shapes now have reusable Zod definitions under
  `backend/src/validators/` and drive the OpenAPI document.
- The product schema now matches the PostgreSQL wire representation: a UUID
  `seller`, nullable `description`, required database-backed fields and
  timestamps, and an optional separate `sellerProfile`.
- Product examples now include timestamps, and the detail example includes
  `sellerProfile`.

No frontend type or runtime response was changed during the initial audit.

## Shared-type boundary

Step 9 uses `openapi-typescript` for runtime-free types only. The checked-in
`docs/openapi.json` generates `frontend/src/contracts/api.ts`; it does not
generate an HTTP client, move endpoint paths out of `frontend/src/routes.ts`, or
add runtime validation to the browser bundle. `npm run generate:contracts`
regenerates OpenAPI and these types together, while `npm run check:api-types`
fails when the checked-in types are stale. The root test command and CI both run
the parity check. Tailwind explicitly excludes the generated declaration file
from source detection so API examples and schema names cannot create unrelated
utilities in the production stylesheet.

The product server-state module now derives `Product`, `ProductStatus`, product
list and mutation responses, and descriptive update fields from the generated
contract. Shared frontend `PageInfo` is likewise derived from OpenAPI. Product
lists no longer accept undocumented bare arrays, and focused fixtures now use
the documented pagination envelope.

## Error and mutation decisions

Each product error response now constrains `code` to the codes reachable at that
HTTP status and includes one matching OpenAPI example per code. Shared error
examples and the schema factory live in `backend/src/validators/responseSchemas.ts`;
the product-specific code groups and Zod-validation examples live beside the
product request and response schemas in `productValidator.ts`.

All successful product mutations now return a bare `Product`: `POST /products`
uses status `201`, and the three PATCH operations use status `200`. The former
`{ newProduct: Product }` create-only wrapper was removed rather than retained as
an undocumented compatibility field. This is a direct contract correction for
an undeployed application; there is no production client or data migration.
Frontend creation consumes the generated `Product` response, and focused,
OpenAPI, and PostgreSQL integration tests verify the accepted shape.

## Exact product-price boundary

Step 14 adds required exact USD prices to product creation and descriptive
updates. JSON represents the minor-unit amount as a canonical decimal string,
for example `{ "currency": "USD", "amountMinor": "12999" }`; neither side of
the API converts prices through binary floating-point arithmetic. Product
responses expose the same shape, with `null` retained only for legacy catalog
rows created before the pricing boundary.

The backend rejects malformed, out-of-range, or tenant-currency-mismatched
prices. Creating a product appends its initial price-history record in the same
transaction as the product and persisted idempotency result. Changing the exact
amount appends one new record; replaying the same amount does not. The catalog
and detail UI format the server amount using the active brand's USD locale
configuration. Checkout remains deliberately legacy-unpriced until the next
monetary slice snapshots locked catalog prices and calculates totals on the
backend.
