---
name: pharma-catalog-intake
description: Reconcile verified Yemen medicine sources with ERP SKUs, manufacturer, pack conversion, regulated prices, and reviewed store synchronization.
---

# Medicine catalog intake

- The historical 6,390-item dataset is not proved to be in live `ym.products`; verify source provenance and license before reconciliation.
- Use `node scripts/catalog/review-medicine-import.mjs <source> --out <report>` to produce a review report; never use this preflight tool as a live import command.
- Reject duplicate barcodes and invalid positive integer conversion factors; flag missing generic, pack, prescription, controlled-drug and price provenance.
- Never treat a public/reference SBDMA price as confirmed selling price or purchase cost. Preserve currency YER/SAR/USD and four-decimal precision.
- Compare by canonical org, SKU, lot, barcode, brand, active ingredient, strength, formulation and pack; >80% text similarity is only a human-review suggestion, never medicinal interchangeability.
- Require two-person approval, auditable mapping and a staging preview of diff/rollback before any DB import.
- Link approved `ym.products` to store records with versioned HMAC ERP sync and kill switch; do not apply an unscoped legacy migration or invent test stock in production.
