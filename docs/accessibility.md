# Accessibility Verification

MercadoZetta uses semantic HTML, typed Tailwind control primitives, shared
visible focus treatment, reduced-motion fallbacks, tenant-independent feedback
colors, WCAG AA tenant-palette checks, and Axe assertions in the deterministic
Chromium workflows. Reusable control presentation belongs in the individual
control modules under `frontend/src/components/`; `frontend/src/index.css` is
reserved for the Tailwind theme bridge and true document-wide policies.

## Automated checks

Run the focused and browser checks from the repository root:

```bash
npm test
npm run test:e2e
```

The browser lane runs Axe against protected login, registration, delivery
addresses, checkout, seller orders, and notifications. Automated checks
complement rather than replace keyboard and assistive-technology testing.

## Manual keyboard smoke test

Run this checklist for both `VITE_TENANT_ID=mercadozetta` and
`VITE_TENANT_ID=campus-market`, restarting Vite after changing the value.
Use only the keyboard until the checklist is complete.

1. Open `/` and press `Tab` through the logo, header actions, hero actions,
   catalog filters, product links and actions, and pagination. Confirm every
   focused element has a clearly visible outline and nothing is obscured or
   skipped unexpectedly.
2. Use `Shift+Tab` to traverse the same controls in reverse. Confirm focus is
   never trapped and remains visible at narrow and wide viewport sizes.
3. Activate links and buttons with `Enter`, and buttons with `Space`. Confirm
   disabled controls cannot be activated and remain visually distinguishable.
4. On `/login`, `/register`, and `/products/new`, confirm each field has an
   announced label, validation failures are announced, entered values remain
   available after API errors, and focus is not moved unexpectedly.
5. Complete checkout quantity editing and removal, address creation/edit/delete,
   delivery-option selection, quote retry, seller fulfillment, notification
   read/unread updates, product management, review submission, and pagination.
   Confirm pending labels and success or error messages are announced and
   conflicting actions remain disabled while pending.
6. At 200% browser zoom and a 320 CSS-pixel viewport, confirm controls and text
   remain reachable without two-dimensional scrolling and review controls wrap
   instead of leaving the viewport.
7. Enable the operating system's reduced-motion preference and repeat the main
   navigation. Confirm no essential information depends on animation.
8. With NVDA, VoiceOver, or another available screen reader, check heading and
   landmark navigation, product image alternatives, form labels, status and
   alert announcements, notification counts, and order-status history.
9. Exercise password-reset and email-verification request and confirmation
   pages with valid, missing, and rejected tokens. Confirm labels, pending
   state, success status, error alert, and recovery links are announced.

Record the date, browser and assistive technology versions, tenant, result, and
links to any defects when executing the checklist for a release.
