# Marketplace operations baseline

The authenticated seller operations view combines tenant- and seller-scoped
operational data without introducing monetary estimates:

- counts of non-archived products, active products, low-stock products,
  inventory units, distinct orders, open orders, and ordered units;
- up to 100 non-archived products at or below the requested low-stock threshold;
- paginated inventory-set and checkout-decrement history from append-only audit
  events; and
- seller order search by order UUID or the seller's line-item product name,
  plus exact lifecycle-status filtering.

`GET /seller/operations` defaults the low-stock threshold to five. Revenue is
not inferred because Step 14 has not introduced authoritative prices or
immutable order-line price snapshots.

## Category decision

A managed taxonomy is not required for the current catalog requirements. The
marketplace supports normalized category and subcategory filters, but there is
no administration workflow, canonical hierarchy, merchandising rule, or
cross-channel discovery requirement that would justify tenant-managed taxonomy
records and migrations. Free-text category input therefore remains for this
baseline. Revisit the decision when a concrete discovery requirement needs
stable category identifiers, aliases, hierarchy, or governance.
