# Tenant Theming

MercadoZetta keeps each tenant's identity in a checked-in, typed brand
configuration while sharing the same React components. Runtime CSS custom
properties connect the selected configuration to semantic Tailwind utilities:

```text
BrandConfig.theme -> --theme-* properties -> Tailwind theme aliases -> components
```

`VITE_TENANT_ID` selects the brand at build or development-server startup. An
unknown or missing value uses `defaultBrand`. Restart Vite after changing the
value; production images must be rebuilt because Vite variables are compiled
into the frontend bundle.

## Theme contract

`frontend/src/brands/schema.ts` defines `BrandTheme`. Every brand supplies the
complete color, typography, radius, and shadow structure. `BrandProvider.tsx`
applies those values to the document root, and `frontend/src/index.css` exposes
them to Tailwind through `@theme inline`.

| Brand theme value           | Runtime property              | Tailwind utilities                          |
| --------------------------- | ----------------------------- | ------------------------------------------- |
| `colors.canvas`             | `--theme-canvas`              | `bg-canvas`                                 |
| `colors.surface.default`    | `--theme-surface`             | `bg-surface`                                |
| `colors.surface.emphasized` | `--theme-surface-emphasized`  | `bg-surface-emphasized`                     |
| `colors.action.primary`     | `--theme-action-primary`      | `bg-action`, `text-action`, `border-action` |
| `colors.action.primaryText` | `--theme-action-primary-text` | `text-on-action`                            |
| `colors.action.accent`      | `--theme-action-accent`       | `text-accent`                               |
| `colors.text.primary`       | `--theme-text`                | `text-content`                              |
| `colors.text.muted`         | `--theme-text-muted`          | `text-muted`                                |
| `colors.border`             | `--theme-border`              | `border-theme-border`                       |
| `typography.body`           | `--theme-font-body`           | `font-body`                                 |
| `typography.heading`        | `--theme-font-heading`        | `font-heading`                              |
| `radius.control`            | `--theme-radius-control`      | `rounded-control`                           |
| `radius.surface`            | `--theme-radius-surface`      | `rounded-surface`                           |
| `shadows.surface`           | `--theme-shadow-surface`      | `shadow-surface`                            |

Use these semantic utilities in components. Do not repeat arbitrary utilities
such as `bg-[var(--theme-surface)]` or hard-code decorative tenant colors. Keep
error, warning, success, and lifecycle-state colors independent from branding
so their meaning does not change between tenants.

Reusable form presentation belongs in the individual control modules under
`frontend/src/components/`. Keep `frontend/src/index.css` limited to the theme
bridge and true document-wide policies such as typography, visible focus, and
reduced motion.

## Modify an existing theme

1. Edit the tenant's complete `theme` object in `frontend/src/brands/default.ts`
   or `frontend/src/brands/campusMarket.ts`.
2. Keep the semantic meaning of each token. For example, `primaryText` is the
   foreground placed on `primary`, not another decorative accent.
3. Update `BrandProvider.test.tsx` if an asserted CSS-property value changes.
   Its shared contrast check already evaluates both built-in themes.
4. Run the automated checks and the two-tenant manual accessibility smoke test
   described below.

If the shape of `BrandTheme` changes, also update every brand, the
`BrandProvider` property mapping, the `@theme inline` aliases, and the explicit
property assertion in `BrandProvider.test.tsx`. Prefer extending the semantic
contract over adding one-off component variables.

## Add a checked-in brand

1. Add the logo and favicon assets under `frontend/src/assets/`.
2. Create a brand module under `frontend/src/brands/` that satisfies
   `BrandConfig`. Inheriting stable copy from `defaultBrand` is acceptable, but
   supply a complete theme so brand presentation does not depend on another
   tenant's values.
3. Register the configuration in the `brands` map in
   `frontend/src/brands/index.ts` and export it when tests or other modules need
   direct access.
4. Add the brand to the selection, property-mapping, and contrast scenarios in
   `frontend/src/brands/BrandProvider.test.tsx`.
5. Select it with `VITE_TENANT_ID=<tenant-id>` and restart or rebuild the
   frontend.

A frontend brand does not create an application tenant. The same identifier
must be an active tenant in `backend/src/tenants.ts`, and deployment, seed, and
browser-test configuration must be updated when the new tenant is intended to
support the complete application. Backend tenant and ownership checks remain
authoritative.

## Verification

Run from the repository root:

```bash
npm --prefix frontend test -- src/brands/BrandProvider.test.tsx
npm --prefix frontend run lint
npm --prefix frontend run build
npm run format:check
npm run test:e2e
```

The theme test requires a contrast ratio of at least 4.5:1 for primary and
muted text on their supported surfaces, primary actions and their labels, and
accent usage. The browser lane checks visible keyboard focus and runs Axe on the
main authenticated workflows.

Finally, execute the keyboard, responsive-zoom, reduced-motion, and screen-reader
checklist in [Accessibility Verification](accessibility.md) for every affected
tenant. Automated contrast and Axe checks do not replace this manual review.
