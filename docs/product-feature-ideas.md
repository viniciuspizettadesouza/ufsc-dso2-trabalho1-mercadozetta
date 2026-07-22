# MercadoZetta Product Feature Ideas

## Purpose

This document is the durable catalog of product and user-facing ideas discussed
for MercadoZetta. It prevents useful ideas from disappearing when they are not
selected for the active implementation roadmap.

- `PROJECT_IMPROVEMENT_PLAN.md` is the execution source of truth: current
  verified state, next action, ordering, dependencies, and acceptance gates.
- This catalog is a product backlog and review aid. An entry here does not
  authorize implementation, establish scope, or override the active plan.
- Before implementing an idea, verify the current code, define the user problem,
  select a measurable outcome, and move an accepted slice into the active plan.
- When an idea is implemented, update its status here in the same phase. Keep
  rejected or deferred ideas so later agents can understand that they were
  considered.

Snapshot date: 2026-07-22. Statuses are based on the repository after completed
Step 17 and must be reverified when revisited.

## Product direction

- First payment market: Portugal through the CampusMarket tenant, then the wider
  EEA if pilot evidence supports it.
- CampusMarket uses EUR/`pt-PT`; its immutable pre-transition USD orders remain
  USD history. MercadoZetta remains a distinct USD/`en-US` configuration.
- A live United States market requires explicit regional, legal, tax, address,
  payment, and shipping validation; the USD configuration alone is not readiness.
- Product type: white-label, multi-tenant, multi-seller marketplace with a cart
  that can contain products from multiple sellers.
- Selected payment direction: Stripe Checkout and Stripe Connect. Initial
  Portuguese candidates are cards, dynamically eligible Apple Pay/Google Pay,
  and MB WAY. Other methods require separate compatibility review.

## Legend

Implementation status:

- `✅` implemented and user-visible;
- `◐` partial, limited, or present without a complete user journey;
- `⚙` backend/infrastructure exists but the feature is not usable end to end;
- `○` idea not implemented;
- `—` intentionally avoid unless a valid and truthful requirement appears.

Review horizon:

- `V1` first sellable Portuguese version;
- `Next` high-value follow-up after the first sellable version;
- `Later` useful but not currently urgent;
- `Conditional` implement only after a concrete requirement or measured demand;
- `Avoid` do not implement in the described form.

## Current differentiators worth preserving

These capabilities were not prominent in the generic ecommerce checklist but
are already valuable parts of MercadoZetta.

| Capability                           | Status | Notes                                                          |
| ------------------------------------ | ------ | -------------------------------------------------------------- |
| Multi-tenant white-label branding    | ✅     | MercadoZetta and CampusMarket configurations                   |
| Public multi-seller marketplace      | ✅     | Public catalog, seller catalog, and seller profile             |
| Seller product lifecycle management  | ✅     | Create, edit, inventory, price, and lifecycle status           |
| Seller operations overview           | ✅     | Revenue, order counts, low stock, and inventory history        |
| Persistent authenticated cart        | ✅     | PostgreSQL-backed and tenant/user scoped                       |
| Multi-seller order snapshots         | ✅     | Seller-owned lines and immutable product-name snapshots        |
| Exact authoritative money            | ✅     | Integer minor units and immutable priced-order totals          |
| Transactional checkout and inventory | ✅     | Locking, conditional decrement, and atomic order creation      |
| Idempotent critical mutations        | ✅     | Checkout, product creation, and reviews                        |
| Secure cookie sessions               | ✅     | Rotation, replay detection, CSRF, revocation, and session UI   |
| Tenant and ownership enforcement     | ✅     | Backend authorization and database boundaries                  |
| Audit and operational baseline       | ✅     | Structured logs, audit events, health, readiness, and recovery |
| Typed API contract                   | ✅     | Zod/OpenAPI contract and generated frontend types              |
| Accessibility baseline               | ✅     | Semantic controls, focus, contrast, Axe, and manual checklist  |

## 1. Product discovery and search

| Idea                                | Status | Horizon and notes                                              |
| ----------------------------------- | ------ | -------------------------------------------------------------- |
| Search by product name              | ✅     | Existing backend-backed search                                 |
| Search product descriptions         | ✅     | Existing behavior in addition to name                          |
| Search by SKU                       | ○      | Conditional; add only with a real SKU domain requirement       |
| Search autocomplete                 | ○      | Next; use backend suggestions and keyboard-accessible UI       |
| Typo correction/tolerance           | ○      | Next; measure relevance and false matches                      |
| Search synonyms                     | ○      | Next; tenant/language-aware synonym governance                 |
| Search history                      | ○      | Later; requires retention and privacy behavior                 |
| Popular searches/products in search | ○      | Later; requires trustworthy analytics                          |
| Voice search                        | ○      | Conditional; low priority until mobile demand supports it      |
| Semantic/AI search                  | ○      | Conditional; only after conventional search is measured        |
| Search by image                     | ○      | Conditional; image safety, storage, privacy, and cost required |
| Useful no-results suggestions       | ◐      | Next; empty state exists, recovery suggestions do not          |
| Search relevance sorting            | ○      | Next; define and measure relevance before exposing it          |

## 2. Catalog navigation, categories, and filters

| Idea                                     | Status | Horizon and notes                                           |
| ---------------------------------------- | ------ | ----------------------------------------------------------- |
| Category field and exact category filter | ✅     | Current taxonomy is intentionally free text                 |
| Subcategory field                        | ◐      | Stored/API-filterable but not a complete navigation journey |
| Governed category hierarchy              | ○      | Conditional; requires accepted taxonomy ownership           |
| Category and subcategory menus           | ○      | Next after category strategy is accepted                    |
| Breadcrumbs                              | ○      | Next with navigable category hierarchy                      |
| Category landing pages                   | ○      | Later; useful for discovery and SEO                         |
| Brand filter                             | ○      | Conditional; requires a structured product-brand field      |
| Minimum/maximum price filters            | ○      | Next; authoritative, indexed backend filter                 |
| Size filter                              | ○      | Conditional; requires variants/structured attributes        |
| Colour filter                            | ○      | Conditional; requires variants/structured attributes        |
| Rating filter                            | ○      | Next after review aggregates exist                          |
| Availability filter                      | ✅     | In-stock and sold-out filters                               |
| Material filter                          | ○      | Conditional; requires structured specifications             |
| Promotion filter                         | ○      | Later after promotion domain exists                         |
| Sort by newest                           | ✅     | Existing                                                    |
| Sort by oldest                           | ✅     | Existing additional option                                  |
| Sort by name                             | ✅     | Existing additional option                                  |
| Sort by inventory                        | ✅     | Existing seller/customer-visible option                     |
| Sort by lowest/highest price             | ○      | Next                                                        |
| Sort by best-selling                     | ○      | Later; define eligible order states and time window         |
| Sort by rating/most reviewed             | ○      | Next after aggregates exist                                 |
| Sort by discount                         | ○      | Later after promotion domain exists                         |
| Stable paginated catalog                 | ✅     | Keep filters and sorting database-backed                    |

## 3. Catalog cards and category-page interactions

| Idea                              | Status | Horizon and notes                                             |
| --------------------------------- | ------ | ------------------------------------------------------------- |
| Responsive product image          | ✅     | One catalog image with alt text                               |
| Large-image/list density controls | ○      | Conditional; test whether users need layout choices           |
| Quick View                        | ○      | Later; avoid duplicating an incomplete product page           |
| Second image on hover             | ○      | Later after gallery/multiple images exist                     |
| New badge                         | ○      | Later; define objective age window                            |
| Promotion badge                   | ○      | Later after promotion snapshots exist                         |
| Best-seller badge                 | ○      | Later; use real eligible sales data                           |
| Last-units badge                  | ◐      | Exact inventory is shown; dedicated threshold badge is absent |
| Sold-out/status badge             | ✅     | Current lifecycle and availability labels                     |
| Available-stock display           | ✅     | Exact current inventory is visible                            |
| Instalment summary                | ○      | Conditional by supported payment method and regulation        |
| Rating average/count on card      | ○      | Next after aggregates exist                                   |
| Favourite action on card          | ✅     | Persistent for authenticated users                            |
| Add-to-cart action on card        | ✅     | Persistent for authenticated users                            |
| Card loading skeleton             | ✅     | Existing catalog pending state                                |
| Card error and empty states       | ✅     | Existing, but can gain recovery suggestions                   |

## 4. Product detail content and media

| Idea                                  | Status | Horizon and notes                                          |
| ------------------------------------- | ------ | ---------------------------------------------------------- |
| Product name                          | ✅     | Existing                                                   |
| Product description                   | ✅     | Existing                                                   |
| Seller/store identity                 | ✅     | Existing public seller profile link                        |
| Product brand                         | ○      | Conditional; add a structured field first                  |
| SKU                                   | ○      | Conditional; seller/customer requirement required          |
| Category/subcategory display          | ◐      | Category visible; subcategory journey incomplete           |
| Structured specifications             | ○      | Next when actual product types are defined                 |
| Dimensions                            | ○      | Conditional; useful for physical shipping calculations     |
| Weight                                | ○      | V1 if shipping quotes require it; otherwise conditional    |
| Warranty                              | ○      | Later; seller policy and legal claims required             |
| Single product image                  | ✅     | Existing with alternative text                             |
| Image gallery                         | ○      | Next                                                       |
| Image zoom                            | ○      | Next with gallery                                          |
| Product video                         | ○      | Conditional; storage, moderation, and performance required |
| 360-degree images                     | ○      | Conditional; low priority                                  |
| Customer photos                       | ○      | Later with review-media moderation                         |
| Image optimization/responsive sources | ○      | Next; measure and set media rules                          |
| Safe image upload/object storage      | ◐      | URL validation exists; managed upload/storage does not     |

## 5. Product purchase controls and merchandising

| Idea                       | Status | Horizon and notes                                          |
| -------------------------- | ------ | ---------------------------------------------------------- |
| Add to cart                | ✅     | Existing                                                   |
| Remove from cart           | ✅     | Existing                                                   |
| Product quantity selector  | ◐      | Quantity is editable in cart, not product detail           |
| Buy now                    | ○      | Next; define whether it preserves or bypasses current cart |
| Favourite/wishlist action  | ✅     | Existing persistence                                       |
| Colour selection           | ○      | Conditional; requires variant model and stock per variant  |
| Size selection             | ○      | Conditional; requires variant model and stock per variant  |
| Other product variants     | ○      | Conditional; accepted variant/taxonomy design required     |
| Current exact price        | ✅     | Existing authoritative price                               |
| Previous price             | ○      | Later; needs immutable price/promotion display rules       |
| Discount amount/percentage | ○      | Later after promotion domain                               |
| Instalment presentation    | ○      | Conditional by Stripe method and market rules              |
| Available/sold-out state   | ✅     | Existing                                                   |
| “Only X left” message      | ◐      | Exact inventory exists; dedicated messaging is absent      |
| Back-in-stock notification | ○      | Later; preferences, outbox, and delivery required          |
| Price-drop notification    | ○      | Later; price history exists, delivery workflow does not    |

## 6. Product trust and cross-selling

| Idea                          | Status | Horizon and notes                                             |
| ----------------------------- | ------ | ------------------------------------------------------------- |
| Product ratings and comments  | ✅     | Basic review list and submission                              |
| Questions and answers         | ○      | Later; moderation and seller notifications required           |
| Return-policy summary         | ○      | V1 before live payments                                       |
| Delivery estimate             | ◐      | Deterministic demo estimate; no live carrier                  |
| Shipping quote by postal code | ◐      | Deterministic PT/US syntax-based demo quote                   |
| Security/trust seals          | —      | Avoid unverifiable decorative seals; explain real protections |
| Warranty highlight            | ○      | Conditional on a real seller/product warranty                 |
| Related products              | ○      | Next; begin with explainable category signals                 |
| Frequently bought together    | ○      | Later; needs eligible order analytics                         |
| Customers also bought         | ○      | Later; privacy-safe aggregate analytics                       |
| Accessories                   | ○      | Conditional; requires curated relationship data               |
| Seller reputation/metrics     | ○      | Later; define fair and abuse-resistant metrics                |

## 7. Cart user experience

| Idea                                | Status | Horizon and notes                                       |
| ----------------------------------- | ------ | ------------------------------------------------------- |
| Persistent cart                     | ✅     | Authenticated PostgreSQL cart                           |
| Dedicated cart page                 | ✅     | Persistent quantity editing and removal                 |
| Header cart count/link              | ✅     | Derived from the user-scoped detailed-cart cache        |
| Update quantity                     | ✅     | Existing                                                |
| Remove item                         | ✅     | Existing                                                |
| Item image and product link in cart | ○      | V1 UI improvement                                       |
| Per-line price/subtotal             | ✅     | Existing text presentation                              |
| Order estimate/summary              | ✅     | Current exact quote                                     |
| Unavailable-item recovery           | ◐      | Blocking warning exists; stronger recovery UI is needed |
| Save for later                      | ◐      | Wishlist exists but no transfer action                  |
| Move between cart and favorites     | ○      | Next                                                    |
| Apply coupon                        | ○      | Later after promotion domain                            |
| Shipping estimate in cart           | ◐      | Available at final checkout, not cart                   |
| Estimated delivery                  | ◐      | Deterministic demo estimate, not a carrier promise      |
| Recommended products in cart        | ○      | Later                                                   |
| Free-shipping progress bar          | ○      | Later after promotion/shipping threshold exists         |
| Express/quick checkout              | ○      | Later; preserve review and payment safety               |
| Guest cart persistence              | ○      | Conditional; privacy and merge-on-login rules required  |

## 8. Checkout identity, address, delivery, and confirmation

| Idea                              | Status | Horizon and notes                                                |
| --------------------------------- | ------ | ---------------------------------------------------------------- |
| Authenticated checkout            | ✅     | Existing and protected                                           |
| Guest checkout                    | ○      | Conditional; assess conversion versus marketplace identity needs |
| Fast registration during checkout | ○      | Next; keep requested destination and cart                        |
| Address form                      | ✅     | Protected saved-address management                               |
| Portuguese postal-code validation | ✅     | Syntax validation without claiming address certainty             |
| Address autocomplete              | ○      | Later; external provider/privacy review required                 |
| Multiple saved addresses          | ✅     | Tenant/user-scoped address book                                  |
| Default address                   | ✅     | Atomic single default with promotion on deletion                 |
| Immutable order-time address      | ✅     | Address and delivery option copied into order                    |
| Multiple carriers/services        | ○      | Next after deterministic first adapter                           |
| Store/pickup-point collection     | ○      | Conditional; operational location data required                  |
| Scheduled delivery                | ○      | Conditional; carrier/operations support required                 |
| Final item and amount review      | ✅     | Lines, address, delivery, and authoritative components           |
| Clear submit-payment action       | ○      | V1 with Stripe Checkout handoff                                  |
| Visual confirmation page          | ◐      | Success message/history exists; dedicated page does not          |
| Human-friendly order number       | ◐      | UUID is shown; display-friendly reference is absent              |
| Payment pending/failed/retry UI   | ○      | V1                                                               |
| Never infer success from redirect | ⚙      | Planned payment security invariant                               |

## 9. Payments for Portugal/EEA and later US expansion

| Idea                               | Status | Horizon and notes                                           |
| ---------------------------------- | ------ | ----------------------------------------------------------- |
| Stripe-hosted Checkout             | ○      | V1 selected direction                                       |
| Card payments                      | ○      | V1                                                          |
| Apple Pay                          | ○      | V1 when dynamically eligible                                |
| Google Pay                         | ○      | V1 when dynamically eligible                                |
| MB WAY                             | ○      | V1 Portuguese EUR candidate; one-time wallet flow           |
| Multibanco                         | ○      | Next; validate delayed confirmation and Connect behavior    |
| SEPA Direct Debit                  | ○      | Later; delayed confirmation/mandate risk differs from cards |
| PayPal through Stripe              | ○      | Later; validate Connect and funds-flow constraints          |
| Link                               | ○      | V1/Next when dynamically eligible                           |
| Klarna/BNPL                        | ○      | Conditional; eligibility, consumer-credit UX, and refunds   |
| Save payment method/card           | ○      | Later; require explicit consent and SetupIntent strategy    |
| Instalments                        | ○      | Conditional; market/provider eligibility required           |
| Stripe Connect seller onboarding   | ○      | V1 before live multi-seller money                           |
| Multi-seller allocation            | ○      | V1                                                          |
| Separate charges and transfers     | ○      | V1 before live payments                                     |
| Platform fee/commission            | ○      | V1 business decision and immutable allocation               |
| Delayed transfer until fulfillment | ○      | V1 decision; protect refunds and delivery workflow          |
| Refund and transfer reversal       | ○      | V1 before live mode                                         |
| Reconciliation                     | ○      | V1 before live mode                                         |
| Dispute handling                   | ○      | V1 operational readiness                                    |
| US USD tenant/market               | ○      | Conditional later regionalization phase                     |
| ACH for US buyers                  | ○      | Conditional after US market exists                          |

## 10. User account and identity

| Idea                          | Status | Horizon and notes                                              |
| ----------------------------- | ------ | -------------------------------------------------------------- |
| Account registration          | ✅     | Existing                                                       |
| Login                         | ✅     | Existing                                                       |
| Logout/all-session revocation | ✅     | Existing                                                       |
| Active-session management     | ✅     | Existing                                                       |
| Profile editing               | ✅     | Name and telephone                                             |
| Password change               | ✅     | Existing reauthentication flow                                 |
| Email change                  | ◐      | UI/API exist; real delivery is unavailable                     |
| Email verification            | ◐      | Complete UI and development sink; production delivery deferred |
| Password recovery             | ◐      | Complete UI and development sink; production delivery deferred |
| Account deactivation          | ✅     | Existing with active-order guard                               |
| Data export/access request    | ○      | Next for privacy operations                                    |
| Address book                  | ✅     | Multiple saved addresses and one default                       |
| Saved payment methods         | ○      | Later                                                          |
| Dedicated buyer order history | ✅     | Paginated authenticated `/orders` page                         |
| Buy again                     | ○      | Next after dedicated order detail                              |
| Dedicated favorites page      | ○      | V1                                                             |
| Downloads/digital products    | ○      | Conditional; not current physical-marketplace scope            |
| Notification center           | ✅     | Existing internal notifications                                |
| Notification preferences      | ○      | Next with asynchronous delivery                                |
| Social login                  | ○      | Later; concrete provider and account-linking rules required    |
| Two-factor authentication     | ○      | Next for sellers/admins; risk-based buyer rollout              |
| Login history/security alerts | ◐      | Sessions exist; durable login/security history UI does not     |

## 11. Buyer orders, fulfillment, and post-sale

| Idea                                   | Status | Horizon and notes                                      |
| -------------------------------------- | ------ | ------------------------------------------------------ |
| Buyer order history                    | ✅     | Dedicated paginated authenticated page                 |
| Dedicated order-detail page            | ○      | V1                                                     |
| Order status history                   | ✅     | Existing                                               |
| Seller fulfillment advancement         | ✅     | Confirm, ship, and deliver lifecycle                   |
| Buyer cancellation UI                  | ⚙      | Backend rules exist; buyer UI is absent                |
| Inventory restoration on cancellation  | ○      | V1 before live payments                                |
| Shipment per seller                    | ○      | V1 due to multi-seller orders                          |
| Carrier and service                    | ○      | V1/Next                                                |
| Tracking number/link                   | ○      | V1/Next                                                |
| Real-time tracking updates             | ○      | Later; carrier webhook/polling required                |
| Partial shipments                      | ○      | V1 domain support for independent sellers              |
| Invoice/receipt                        | ○      | V1 policy; VAT/invoice responsibility must be settled  |
| Request return                         | ○      | V1 before live scale                                   |
| Request exchange                       | ○      | Next after return workflow                             |
| Full refund                            | ○      | V1 before live payments                                |
| Partial line/quantity refund           | ○      | Next after accounting behavior is proven               |
| Dispute/chargeback workflow            | ○      | V1 operational requirement                             |
| Buyer/seller support case              | ○      | Next                                                   |
| Product review after eligible purchase | ✅     | Eligibility needs tightening to delivered/non-refunded |
| Delivery review                        | ○      | Later                                                  |

## 12. Wishlist and saved shopping

| Idea                     | Status | Horizon and notes                                 |
| ------------------------ | ------ | ------------------------------------------------- |
| Add/remove favorite      | ✅     | Existing                                          |
| Persistent wishlist      | ✅     | Existing backend collection                       |
| Dedicated wishlist page  | ○      | V1                                                |
| Share wishlist           | ○      | Later; privacy and public-token behavior required |
| Multiple wishlists       | ○      | Conditional                                       |
| Price-drop alert         | ○      | Later                                             |
| Back-in-stock alert      | ○      | Later                                             |
| Move to cart             | ○      | Next                                              |
| Save cart item for later | ○      | Next                                              |

## 13. Promotions and pricing incentives

| Idea                                     | Status | Horizon and notes                                        |
| ---------------------------------------- | ------ | -------------------------------------------------------- |
| Coupon code                              | ○      | Later after refunds/multi-seller allocation are stable   |
| Fixed discount                           | ○      | Later                                                    |
| Percentage discount                      | ○      | Later                                                    |
| Free shipping                            | ○      | Later                                                    |
| Free-shipping threshold                  | ○      | Later                                                    |
| Progressive/tiered discount              | ○      | Conditional                                              |
| Buy X get Y                              | ○      | Conditional                                              |
| Product bundles/kits                     | ○      | Conditional                                              |
| Flash sale                               | ○      | Conditional; truthful schedule and stock required        |
| Scheduled promotional price              | ○      | Later                                                    |
| Cashback                                 | ○      | Conditional; financial liability/ledger required         |
| Points program                           | ○      | Conditional; liability, expiry, refund behavior required |
| Coupon usage limits                      | ○      | Required whenever coupons are accepted                   |
| Promotion stacking rules                 | ○      | Required whenever multiple promotions exist              |
| Seller-funded/platform-funded allocation | ○      | Required for marketplace promotions                      |

## 14. Personalization and retention

| Idea                         | Status | Horizon and notes                                     |
| ---------------------------- | ------ | ----------------------------------------------------- |
| Recently viewed products     | ○      | Next with explicit retention                          |
| Continue shopping            | ○      | Next                                                  |
| Buy again                    | ○      | Next                                                  |
| Generic related products     | ○      | Next before personalization                           |
| Recommendations for you      | ○      | Later; consent and measurable value required          |
| Recommendations from history | ○      | Later                                                 |
| AI recommendations           | ○      | Conditional after explainable baseline                |
| Abandoned-cart reminder      | ○      | Later; consent, rate limits, and unsubscribe required |
| Personalized home page       | ○      | Conditional                                           |

## 15. Reviews and community content

| Idea                                 | Status | Horizon and notes                                |
| ------------------------------------ | ------ | ------------------------------------------------ |
| Numeric 1–5 rating                   | ✅     | Existing                                         |
| Review comment                       | ✅     | Existing                                         |
| Update one review per author/product | ✅     | Existing upsert behavior                         |
| Purchased-product restriction        | ✅     | Existing but too permissive for cancelled orders |
| Delivered/non-refunded eligibility   | ○      | V1/Next tightening                               |
| Visible verified-purchase badge      | ○      | Next                                             |
| Average rating                       | ○      | Next                                             |
| Rating count and distribution        | ○      | Next                                             |
| Filter reviews by rating             | ○      | Next                                             |
| Sort reviews                         | ○      | Next                                             |
| Review photos                        | ○      | Later; storage and moderation required           |
| Review videos                        | ○      | Conditional; cost and moderation required        |
| Helpful votes/likes                  | ○      | Later; abuse controls required                   |
| Seller response to review            | ○      | Later                                            |
| Report review                        | ○      | Later with moderation workflow                   |
| Review moderation/admin              | ○      | Later with explicit privileged roles             |

## 16. Communication, help, and notifications

| Idea                               | Status | Horizon and notes                                         |
| ---------------------------------- | ------ | --------------------------------------------------------- |
| In-app notifications               | ✅     | Existing read/unread center                               |
| Transactional email                | ○      | V1 for account/payment/order operations                   |
| Development email sink             | ○      | V1 before production provider activation                  |
| Notification preferences           | ○      | Next                                                      |
| Security-message category          | ○      | Next; cannot be disabled where required                   |
| Marketplace/order-message category | ○      | Next                                                      |
| Marketing-message category         | ○      | Later; explicit consent/unsubscribe                       |
| SMS                                | ○      | Conditional                                               |
| Push notifications                 | ○      | Conditional                                               |
| WhatsApp                           | ○      | Conditional                                               |
| Buyer-seller chat                  | ○      | Conditional; moderation, safety, and retention required   |
| Human support chat                 | ○      | Later with support operations                             |
| AI chat/assistant                  | ○      | Conditional after help content and human escalation exist |
| FAQ                                | ○      | V1 transparency/help content                              |
| Help centre                        | ○      | Next                                                      |
| Contact/support page               | ○      | V1                                                        |

## 17. Mobile and installable experience

| Idea                            | Status | Horizon and notes                                                     |
| ------------------------------- | ------ | --------------------------------------------------------------------- |
| Responsive layout               | ✅     | Existing breakpoint-based UI                                          |
| 320px/200% zoom support         | ◐      | Documented verification; repeat for every new flow                    |
| Mobile-optimized navigation     | ◐      | Responsive basics exist; dedicated menu/cart UX can improve           |
| Mobile-optimized checkout       | ◐      | Basic responsive page; full flow does not yet exist                   |
| Touch target and gesture review | ◐      | Controls exist; gesture-specific behavior does not                    |
| PWA/installability              | ○      | Conditional on repeat mobile-use analytics                            |
| Offline browsing                | ○      | Conditional; inventory/prices must never appear authoritative offline |
| Biometric login                 | ○      | Conditional; WebAuthn/passkeys should be evaluated first              |
| Passkeys/WebAuthn               | ○      | Later security/convenience candidate                                  |

## 18. Performance, media, and resilience

| Idea                                       | Status | Horizon and notes                                 |
| ------------------------------------------ | ------ | ------------------------------------------------- |
| Production frontend build                  | ✅     | Existing Vite/Nginx baseline                      |
| React Query server-state cache             | ✅     | Existing                                          |
| Measured Web Vitals                        | ○      | Next before performance claims                    |
| Performance budgets                        | ○      | Next                                              |
| Route/code splitting                       | ○      | Next based on bundle measurement                  |
| Lazy-loaded images                         | ○      | Next                                              |
| Responsive/optimized image formats         | ○      | Next                                              |
| Explicit image dimensions/aspect stability | ◐      | Catalog aspect exists; full media contract absent |
| HTTP cache headers                         | ○      | Next/Conditional after asset/API strategy         |
| CDN                                        | ○      | Conditional by deployment need                    |
| Object storage/image processing            | ○      | Next when uploads are implemented                 |
| Graceful provider outage UI                | ○      | V1 for Stripe/shipping/email boundaries           |
| Retry/recovery without duplicate mutations | ✅     | Strong backend baseline; extend to new providers  |

## 19. Security, privacy, and compliance visible to users

| Idea                                 | Status | Horizon and notes                                              |
| ------------------------------------ | ------ | -------------------------------------------------------------- |
| HTTPS deployment                     | ◐      | Documented reverse-proxy responsibility                        |
| Secure cookie sessions and CSRF      | ✅     | Existing                                                       |
| Session list and revocation          | ✅     | Existing user-facing security control                          |
| Two-factor authentication            | ○      | Next, prioritizing sellers/support                             |
| Passkeys                             | ○      | Later                                                          |
| Payment fraud controls               | ○      | V1 provider signals plus application abuse rules               |
| Privacy policy                       | ○      | V1 before live user/payment data                               |
| Terms of service                     | ○      | V1                                                             |
| Cookie/analytics consent             | ○      | Conditional on non-essential cookies/analytics                 |
| Data access/export                   | ○      | Next                                                           |
| Data correction/profile              | ✅     | Partial privacy right through profile controls                 |
| Account deactivation                 | ✅     | Existing; retention/redaction policy must remain explicit      |
| Data deletion/anonymization workflow | ◐      | Lifecycle baseline exists; complete user/legal workflow absent |
| Login/security history               | ◐      | Sessions exist; event history UI does not                      |
| Seller KYC visibility                | ○      | V1 via Stripe-hosted Connect status, not copied documents      |
| Clear payment/refund state           | ○      | V1                                                             |
| Accessibility statement              | ○      | V1 transparency page                                           |

## 20. Accessibility and inclusive UX

| Idea                                   | Status | Horizon and notes                                       |
| -------------------------------------- | ------ | ------------------------------------------------------- |
| Keyboard navigation                    | ✅     | Existing baseline and manual checklist                  |
| Screen-reader semantics                | ✅     | Existing baseline; manual verification remains required |
| Visible focus                          | ✅     | Existing global policy                                  |
| Alternative text                       | ✅     | Existing product images                                 |
| WCAG-aware colour contrast             | ✅     | Both checked-in brands tested                           |
| Reduced-motion support                 | ✅     | Existing global policy                                  |
| Announced pending/success/error states | ✅     | Existing shared mutation patterns                       |
| High-contrast mode/theme               | ○      | Conditional after user need/OS support assessment       |
| In-app font-size control               | ○      | Conditional; preserve browser zoom first                |
| Skip links/landmark review             | ◐      | Semantic landmarks exist; verify complete navigation    |
| Error summary and focus management     | ◐      | Per-flow support varies; V1 checkout review required    |
| Accessible hosted-payment handoff      | ○      | V1 verification with Stripe Checkout                    |

## 21. Internationalization and regionalization

| Idea                                          | Status | Horizon and notes                                                |
| --------------------------------------------- | ------ | ---------------------------------------------------------------- |
| Tenant-specific locale/currency configuration | ✅     | Existing typed brand configuration                               |
| Portuguese Portugal (`pt-PT`) interface       | ○      | V1; current copy is mixed Portuguese/English                     |
| EUR presentation and product prices           | ✅     | CampusMarket migrated deliberately; MercadoZetta remains USD     |
| Immutable historical multi-currency display   | ✅     | Snapshot currencies survive transitions and format independently |
| English interface                             | ◐      | Much copy exists in English but is not a coherent locale         |
| User-selectable language                      | ○      | Next after translation architecture                              |
| Additional EEA languages                      | ○      | Conditional by market expansion                                  |
| US English/USD tenant                         | ✅     | MercadoZetta is the checked-in USD/`en-US` configuration         |
| Regional address formats                      | ○      | V1 for Portugal; later per supported country                     |
| Regional telephone formats                    | ◐      | Telephone exists without complete regional validation            |
| VAT display and responsibility                | ○      | V1 legal/business decision                                       |
| Tax calculation                               | ○      | V1/Next according to merchant/seller model                       |
| Invoice rules                                 | ○      | V1 legal/business decision                                       |
| Time-zone/date formatting                     | ◐      | Technical timestamps exist; coherent locale UX needs review      |

## 22. Conversion ideas and ethical constraints

| Idea                             | Status | Horizon and notes                                          |
| -------------------------------- | ------ | ---------------------------------------------------------- |
| Truthful stock count             | ✅     | Existing authoritative inventory                           |
| Low-stock threshold message      | ○      | Next if objectively configured                             |
| Free-shipping threshold/progress | ○      | Later after real policy exists                             |
| Promotion countdown              | ○      | Conditional; only server-authoritative real expiry         |
| Warranty highlight               | ○      | Conditional on real warranty                               |
| Real security explanation        | ○      | V1 transparency copy                                       |
| Trust seals                      | —      | Avoid unless issued and verifiable                         |
| “People viewing now”             | —      | Avoid unless based on accurate, privacy-safe live data     |
| “Recent purchases”               | —      | Avoid unless accurate, consent-safe, and non-manipulative  |
| False scarcity/countdowns        | —      | Never implement                                            |
| A/B testing                      | ○      | Later with consent, guardrails, and meaningful sample size |
| Funnel analytics                 | ○      | Next with privacy/consent strategy                         |

## 23. Convenience and sharing

| Idea                   | Status | Horizon and notes                                       |
| ---------------------- | ------ | ------------------------------------------------------- |
| Compare products       | ○      | Later; requires comparable structured attributes        |
| Share product          | ○      | Next                                                    |
| Copy product link      | ○      | Next                                                    |
| Print product/order    | ○      | Conditional; printable invoice/order may be more useful |
| Gift list              | ○      | Conditional                                             |
| Buy again              | ○      | Next                                                    |
| Buy for another person | ○      | Conditional; shipping/recipient privacy required        |
| Gift message           | ○      | Conditional                                             |
| Gift receipt           | ○      | Conditional                                             |

## 24. Loyalty, subscriptions, and recurring commerce

| Idea                  | Status | Horizon and notes                                               |
| --------------------- | ------ | --------------------------------------------------------------- |
| VIP program           | ○      | Conditional                                                     |
| Customer levels/tiers | ○      | Conditional                                                     |
| Member benefits       | ○      | Conditional                                                     |
| Refer a friend        | ○      | Conditional; fraud and reward accounting required               |
| Subscription products | ○      | Conditional; not part of current one-time-order model           |
| Recurring purchases   | ○      | Conditional; consent, retries, cancellation, and stock required |
| Loyalty points        | ○      | Conditional; financial liability and refunds required           |
| Cashback              | ○      | Conditional                                                     |

## 25. Seller-facing product experience

| Idea                                    | Status | Horizon and notes                                |
| --------------------------------------- | ------ | ------------------------------------------------ |
| Create and edit listing                 | ✅     | Existing                                         |
| Inventory and lifecycle management      | ✅     | Existing                                         |
| Exact price and price history           | ✅     | Existing backend history                         |
| Seller order queue/search/filter        | ✅     | Existing                                         |
| Low-stock warnings                      | ✅     | Existing                                         |
| Inventory history                       | ✅     | Existing                                         |
| Revenue overview                        | ✅     | Existing immutable-line aggregation              |
| Stripe connected-account onboarding     | ○      | V1                                               |
| Payout-readiness status                 | ○      | V1                                               |
| Earnings, fees, refunds, transfers view | ○      | V1/Next                                          |
| Shipment creation/tracking entry        | ○      | V1                                               |
| Return/refund response                  | ○      | V1/Next                                          |
| Customer-question response              | ○      | Later                                            |
| Review response                         | ○      | Later                                            |
| Seller notifications/preferences        | ○      | Next                                             |
| Bulk product/inventory operations       | ○      | Conditional                                      |
| CSV import/export                       | ○      | Conditional                                      |
| Promotion participation controls        | ○      | Later                                            |
| Store policies/profile enhancement      | ◐      | Public profile exists; policy content is limited |

## 26. Administration and support

| Idea                                   | Status | Horizon and notes                       |
| -------------------------------------- | ------ | --------------------------------------- |
| Privileged support roles               | ○      | V1/Next only for defined workflows      |
| Payment reconciliation queue           | ○      | V1 before live mode                     |
| Refund/transfer exception handling     | ○      | V1 before live mode                     |
| Dispute management                     | ○      | V1 before live mode                     |
| Connected-account restriction handling | ○      | V1                                      |
| Shipment/return exception handling     | ○      | Next                                    |
| User support cases                     | ○      | Next                                    |
| Review moderation                      | ○      | Later                                   |
| Product moderation/prohibited goods    | ○      | V1 policy and enforcement scope         |
| Banner management                      | ○      | Later                                   |
| Promotion management                   | ○      | Later                                   |
| Category/taxonomy management           | ○      | Conditional on managed taxonomy         |
| Privileged audit trail                 | ✅     | Backend audit baseline; admin UI absent |

## 27. Modern and AI-assisted ideas

| Idea                             | Status | Horizon and notes                                    |
| -------------------------------- | ------ | ---------------------------------------------------- |
| AI search                        | ○      | Conditional after conventional relevance baseline    |
| Semantic search                  | ○      | Conditional                                          |
| Image search                     | ○      | Conditional                                          |
| AI shopping assistant            | ○      | Conditional; require grounded catalog answers        |
| AI support chat                  | ○      | Conditional; human escalation and privacy required   |
| AI product comparison            | ○      | Conditional; structured facts and citations required |
| AI recommendations               | ○      | Conditional; measure against simple baseline         |
| AI-generated product summary     | ○      | Conditional; label and preserve source facts         |
| AI answers to product questions  | ○      | Conditional; seller-approved facts and escalation    |
| AI-generated seller descriptions | ○      | Conditional; seller review before publication        |
| Fraud/risk assistance            | ○      | Conditional; never replace explicit authorization    |

## 28. Transparency and public information

| Idea                                     | Status | Horizon and notes                                            |
| ---------------------------------------- | ------ | ------------------------------------------------------------ |
| Delivery policy                          | ○      | V1                                                           |
| Return/refund policy                     | ○      | V1                                                           |
| Terms of service                         | ○      | V1                                                           |
| Privacy policy                           | ○      | V1                                                           |
| Cookie policy                            | ○      | Conditional on non-essential cookies                         |
| FAQ                                      | ○      | V1                                                           |
| Help centre                              | ○      | Next                                                         |
| About the marketplace                    | ○      | V1                                                           |
| Contact/support information              | ⚙      | Brand support email exists; public page does not             |
| Legal business identity                  | ⚙      | Brand legal name exists; complete public disclosure does not |
| Portuguese company/tax identifiers       | ○      | V1 according to operating entity requirements                |
| Seller legal identity/policies           | ○      | V1/Next according to marketplace model                       |
| Social links                             | ○      | Conditional                                                  |
| Accessibility statement                  | ○      | V1                                                           |
| Payment-method explanation               | ○      | V1                                                           |
| Fees/commission transparency for sellers | ○      | V1 before Connect onboarding                                 |

## 29. Production and operational ideas that affect users

| Idea                                  | Status | Horizon and notes                              |
| ------------------------------------- | ------ | ---------------------------------------------- |
| Real-time authoritative inventory     | ✅     | Existing transactional baseline                |
| Automatic low-stock warnings          | ✅     | Existing seller view                           |
| Similar-product generation            | ○      | Next/Later                                     |
| Scheduled promotional prices          | ○      | Later                                          |
| Smart coupons                         | ○      | Conditional                                    |
| Automatic recommendations             | ○      | Later/Conditional                              |
| Review management                     | ○      | Later                                          |
| Banner/content management             | ○      | Later                                          |
| Automatic transactional notifications | ◐      | In-app exists; outbox/external delivery absent |
| Transactional outbox                  | ○      | V1/Next before reliable external messaging     |
| Background queue and dead letters     | ○      | Next when retryable work exists                |
| Payment/shipping/email outage states  | ○      | V1 for each activated provider                 |
| User-visible service status           | ○      | Conditional by operational need                |
| Feature flags and payment kill switch | ○      | V1 before live Stripe rollout                  |

## How to promote an idea into the roadmap

Before moving an item from this catalog into `PROJECT_IMPROVEMENT_PLAN.md`,
record:

1. the buyer, seller, or operator problem;
2. the target market/tenant and regulatory assumptions;
3. the smallest useful end-to-end slice;
4. dependencies on money, payment, inventory, fulfillment, identity, privacy,
   messaging, moderation, or support;
5. success and guardrail metrics;
6. backend authority, tenant ownership, failure, retry, and accessibility rules;
7. documentation, migration, tests, observability, and rollback requirements;
8. which existing catalog entries become implemented, superseded, rejected, or
   remain deferred.

Avoid selecting work only because a generic ecommerce checklist contains it.
Prefer features that remove a verified obstacle in discovery, trust, checkout,
delivery, recovery, or post-sale service for the chosen market.
