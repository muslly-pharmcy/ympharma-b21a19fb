# Server Function Auth Audit

Generated: 2026-07-21T00:55:24.411Z

- Total server functions scanned: **154**
- Authenticated (`requireSupabaseAuth` **or** `getActor()`): **150/154**
- With `inputValidator`: **132/154**
- Unauthenticated (public endpoints): **4**

> Any function without `requireSupabaseAuth` is a public endpoint on the deployed site. Confirm each is intentionally public (health checks, public reads via `TO anon` RLS, marketing forms with signature/rate-limit guards) or add the middleware.
>
> **Wave R1.2 completed 2026-07-21:** the 4 remaining unauthenticated functions are all *Public by design* with server-enforced gates. See [`WAVE-R1.2-PUBLIC-FUNCTION-REVIEW.md`](./WAVE-R1.2-PUBLIC-FUNCTION-REVIEW.md) for per-function verdict and evidence. No grey-area endpoints remain.

## ⚠ Unauthenticated server functions

- src/lib/catalog.functions.ts :: listProducts (GET)
- src/lib/catalog.functions.ts :: getProduct (GET)
- src/lib/catalog.functions.ts :: listCategories (GET)
- src/lib/cosmic-search.functions.ts :: cosmicSearch (POST)

## Full inventory

| File | Function | Method | Auth | Mode | Validated |
|---|---|---|---|---|---|
| `src/lib/ai.functions.ts` | `listAgents` | GET | ✅ | actor | — |
| `src/lib/ai.functions.ts` | `listAvailableToolsFn` | GET | ✅ | actor | — |
| `src/lib/ai.functions.ts` | `invokeAgent` | POST | ✅ | actor | ✅ |
| `src/lib/ai.functions.ts` | `listRuns` | GET | ✅ | actor | ✅ |
| `src/lib/analytics.functions.ts` | `getExecutiveKpis` | GET | ✅ | actor | — |
| `src/lib/analytics.functions.ts` | `getDispensesSeries` | GET | ✅ | actor | ✅ |
| `src/lib/analytics.functions.ts` | `getCustomersGrowth` | GET | ✅ | actor | ✅ |
| `src/lib/analytics.functions.ts` | `getCampaignsSummary` | GET | ✅ | actor | — |
| `src/lib/analytics.functions.ts` | `getInventoryHealth` | GET | ✅ | actor | — |
| `src/lib/analytics.functions.ts` | `getAiUsage` | GET | ✅ | actor | — |
| `src/lib/campaigns.functions.ts` | `listCampaigns` | GET | ✅ | actor | ✅ |
| `src/lib/campaigns.functions.ts` | `getCampaign` | GET | ✅ | actor | ✅ |
| `src/lib/campaigns.functions.ts` | `listSegments` | GET | ✅ | actor | — |
| `src/lib/campaigns.functions.ts` | `getSegment` | GET | ✅ | actor | ✅ |
| `src/lib/campaigns.functions.ts` | `previewSegment` | POST | ✅ | actor | ✅ |
| `src/lib/campaigns.mutations.functions.ts` | `upsertSegment` | POST | ✅ | actor | ✅ |
| `src/lib/campaigns.mutations.functions.ts` | `recalcSegment` | POST | ✅ | actor | ✅ |
| `src/lib/campaigns.mutations.functions.ts` | `createCampaign` | POST | ✅ | actor | ✅ |
| `src/lib/campaigns.mutations.functions.ts` | `updateCampaign` | POST | ✅ | actor | ✅ |
| `src/lib/campaigns.mutations.functions.ts` | `scheduleCampaign` | POST | ✅ | actor | ✅ |
| `src/lib/campaigns.mutations.functions.ts` | `transitionCampaign` | POST | ✅ | actor | ✅ |
| `src/lib/campaigns.mutations.functions.ts` | `startCampaign` | POST | ✅ | actor | ✅ |
| `src/lib/cart.functions.ts` | `listCart` | GET | ✅ | middleware | — |
| `src/lib/cart.functions.ts` | `addToCart` | POST | ✅ | middleware | ✅ |
| `src/lib/cart.functions.ts` | `removeFromCart` | POST | ✅ | middleware | ✅ |
| `src/lib/cart.functions.ts` | `setCartQuantity` | POST | ✅ | middleware | ✅ |
| `src/lib/catalog.functions.ts` | `listProducts` | GET | ❌ | none | ✅ |
| `src/lib/catalog.functions.ts` | `getProduct` | GET | ❌ | none | ✅ |
| `src/lib/catalog.functions.ts` | `listCategories` | GET | ❌ | none | — |
| `src/lib/catalog.mutations.functions.ts` | `createProduct` | POST | ✅ | actor | ✅ |
| `src/lib/catalog.mutations.functions.ts` | `updateProduct` | POST | ✅ | actor | ✅ |
| `src/lib/catalog.mutations.functions.ts` | `archiveProduct` | POST | ✅ | actor | ✅ |
| `src/lib/clinical.functions.ts` | `runClinicalCheckForPrescription` | POST | ✅ | actor | ✅ |
| `src/lib/cosmic-search.functions.ts` | `cosmicSearch` | POST | ❌ | none | ✅ |
| `src/lib/customers.functions.ts` | `listCustomers` | GET | ✅ | actor | ✅ |
| `src/lib/customers.functions.ts` | `getCustomer` | GET | ✅ | actor | ✅ |
| `src/lib/customers.mutations.functions.ts` | `createCustomer` | POST | ✅ | actor | ✅ |
| `src/lib/customers.mutations.functions.ts` | `updateCustomer` | POST | ✅ | actor | ✅ |
| `src/lib/customers.mutations.functions.ts` | `archiveCustomer` | POST | ✅ | actor | ✅ |
| `src/lib/customers.mutations.functions.ts` | `mergeCustomers` | POST | ✅ | actor | ✅ |
| `src/lib/customers.mutations.functions.ts` | `addCustomerAddress` | POST | ✅ | actor | ✅ |
| `src/lib/customers.mutations.functions.ts` | `addCustomerContact` | POST | ✅ | actor | ✅ |
| `src/lib/customers.mutations.functions.ts` | `addCustomerTag` | POST | ✅ | actor | ✅ |
| `src/lib/customers.mutations.functions.ts` | `removeCustomerTag` | POST | ✅ | actor | ✅ |
| `src/lib/dispenses.functions.ts` | `listDispenses` | POST | ✅ | actor | ✅ |
| `src/lib/dispenses.functions.ts` | `listPendingDispenses` | POST | ✅ | actor | ✅ |
| `src/lib/dispenses.functions.ts` | `getDispense` | POST | ✅ | actor | ✅ |
| `src/lib/dispenses.mutations.functions.ts` | `createDispense` | POST | ✅ | actor | ✅ |
| `src/lib/dispenses.mutations.functions.ts` | `prepareDispense` | POST | ✅ | actor | ✅ |
| `src/lib/dispenses.mutations.functions.ts` | `verifyDispenseItemBarcode` | POST | ✅ | actor | ✅ |
| `src/lib/dispenses.mutations.functions.ts` | `verifyDispense` | POST | ✅ | actor | ✅ |
| `src/lib/dispenses.mutations.functions.ts` | `dispensePrescription` | POST | ✅ | actor | ✅ |
| `src/lib/dispenses.mutations.functions.ts` | `completeDispense` | POST | ✅ | actor | ✅ |
| `src/lib/dispenses.mutations.functions.ts` | `cancelDispense` | POST | ✅ | actor | ✅ |
| `src/lib/dispenses.mutations.functions.ts` | `returnDispense` | POST | ✅ | actor | ✅ |
| `src/lib/doctors.functions.ts` | `listDoctors` | GET | ✅ | actor | — |
| `src/lib/doctors.functions.ts` | `getDoctor` | GET | ✅ | actor | ✅ |
| `src/lib/doctors.mutations.functions.ts` | `createDoctor` | POST | ✅ | actor | ✅ |
| `src/lib/doctors.mutations.functions.ts` | `updateDoctor` | POST | ✅ | actor | ✅ |
| `src/lib/doctors.mutations.functions.ts` | `addLicense` | POST | ✅ | actor | ✅ |
| `src/lib/insurance.functions.ts` | `listInsuranceProviders` | POST | ✅ | actor | ✅ |
| `src/lib/insurance.functions.ts` | `listInsurancePlans` | POST | ✅ | actor | ✅ |
| `src/lib/insurance.functions.ts` | `getPatientCoverage` | POST | ✅ | actor | ✅ |
| `src/lib/insurance.functions.ts` | `listInsuranceClaims` | POST | ✅ | actor | ✅ |
| `src/lib/insurance.functions.ts` | `getInsuranceClaim` | POST | ✅ | actor | ✅ |
| `src/lib/insurance.functions.ts` | `listAuthorizations` | POST | ✅ | actor | ✅ |
| `src/lib/insurance.mutations.functions.ts` | `upsertInsuranceProvider` | POST | ✅ | actor | ✅ |
| `src/lib/insurance.mutations.functions.ts` | `upsertInsurancePlan` | POST | ✅ | actor | ✅ |
| `src/lib/insurance.mutations.functions.ts` | `upsertPatientInsurance` | POST | ✅ | actor | ✅ |
| `src/lib/insurance.mutations.functions.ts` | `verifyCoverage` | POST | ✅ | actor | ✅ |
| `src/lib/insurance.mutations.functions.ts` | `createAuthorization` | POST | ✅ | actor | ✅ |
| `src/lib/insurance.mutations.functions.ts` | `decideAuthorization` | POST | ✅ | actor | ✅ |
| `src/lib/insurance.mutations.functions.ts` | `createInsuranceClaim` | POST | ✅ | actor | ✅ |
| `src/lib/insurance.mutations.functions.ts` | `submitInsuranceClaim` | POST | ✅ | actor | ✅ |
| `src/lib/insurance.mutations.functions.ts` | `approveInsuranceClaim` | POST | ✅ | actor | ✅ |
| `src/lib/insurance.mutations.functions.ts` | `rejectInsuranceClaim` | POST | ✅ | actor | ✅ |
| `src/lib/insurance.mutations.functions.ts` | `recordInsurancePayment` | POST | ✅ | actor | ✅ |
| `src/lib/insurance.mutations.functions.ts` | `reconcileInsuranceClaim` | POST | ✅ | actor | ✅ |
| `src/lib/insurance.mutations.functions.ts` | `cancelInsuranceClaim` | POST | ✅ | actor | ✅ |
| `src/lib/inventory.functions.ts` | `listWarehouses` | GET | ✅ | middleware | — |
| `src/lib/inventory.functions.ts` | `getStockSummary` | GET | ✅ | middleware | ✅ |
| `src/lib/inventory.mutations.functions.ts` | `createWarehouse` | POST | ✅ | actor | ✅ |
| `src/lib/inventory.mutations.functions.ts` | `updateWarehouse` | POST | ✅ | actor | ✅ |
| `src/lib/inventory.mutations.functions.ts` | `receiveStock` | POST | ✅ | actor | ✅ |
| `src/lib/inventory.mutations.functions.ts` | `adjustStock` | POST | ✅ | actor | ✅ |
| `src/lib/inventory.mutations.functions.ts` | `transferStock` | POST | ✅ | actor | ✅ |
| `src/lib/inventory.mutations.functions.ts` | `reserveStock` | POST | ✅ | actor | ✅ |
| `src/lib/inventory.mutations.functions.ts` | `releaseReservation` | POST | ✅ | actor | ✅ |
| `src/lib/inventory.mutations.functions.ts` | `consumeReservation` | POST | ✅ | actor | ✅ |
| `src/lib/inventory.mutations.functions.ts` | `returnStock` | POST | ✅ | actor | ✅ |
| `src/lib/loyalty.functions.ts` | `listLoyaltyAccounts` | GET | ✅ | actor | ✅ |
| `src/lib/loyalty.functions.ts` | `getLoyaltyAccount` | GET | ✅ | actor | ✅ |
| `src/lib/loyalty.functions.ts` | `listLoyaltyTransactions` | GET | ✅ | actor | ✅ |
| `src/lib/loyalty.functions.ts` | `listRewards` | GET | ✅ | actor | ✅ |
| `src/lib/loyalty.functions.ts` | `listLoyaltyRules` | GET | ✅ | actor | — |
| `src/lib/loyalty.functions.ts` | `listLoyaltyTiers` | GET | ✅ | actor | — |
| `src/lib/loyalty.mutations.functions.ts` | `issuePoints` | POST | ✅ | actor | ✅ |
| `src/lib/loyalty.mutations.functions.ts` | `redeemPoints` | POST | ✅ | actor | ✅ |
| `src/lib/loyalty.mutations.functions.ts` | `reversePoints` | POST | ✅ | actor | ✅ |
| `src/lib/loyalty.mutations.functions.ts` | `expirePoints` | POST | ✅ | actor | ✅ |
| `src/lib/loyalty.mutations.functions.ts` | `adjustPoints` | POST | ✅ | actor | ✅ |
| `src/lib/loyalty.mutations.functions.ts` | `createReward` | POST | ✅ | actor | ✅ |
| `src/lib/loyalty.mutations.functions.ts` | `redeemReward` | POST | ✅ | actor | ✅ |
| `src/lib/loyalty.mutations.functions.ts` | `upsertLoyaltyRule` | POST | ✅ | actor | ✅ |
| `src/lib/me.functions.ts` | `getMyOrganization` | GET | ✅ | actor | — |
| `src/lib/medical-directory.functions.ts` | `searchAdenDirectory` | GET | ✅ | middleware | ✅ |
| `src/lib/medical-directory.functions.ts` | `findSuppliersByCompany` | GET | ✅ | middleware | ✅ |
| `src/lib/medical-directory.functions.ts` | `listProductsByAgent` | GET | ✅ | middleware | ✅ |
| `src/lib/modules.functions.ts` | `listPharmacyProducts` | GET | ✅ | middleware | ✅ |
| `src/lib/modules.functions.ts` | `listModulePatients` | GET | ✅ | middleware | — |
| `src/lib/modules.functions.ts` | `listModuleDoctors` | GET | ✅ | middleware | ✅ |
| `src/lib/modules.functions.ts` | `listModuleDeliveries` | GET | ✅ | middleware | ✅ |
| `src/lib/modules.functions.ts` | `listModuleTransactions` | GET | ✅ | middleware | — |
| `src/lib/patients.functions.ts` | `listPatients` | GET | ✅ | actor | — |
| `src/lib/patients.functions.ts` | `getPatient` | GET | ✅ | actor | ✅ |
| `src/lib/patients.mutations.functions.ts` | `createPatient` | POST | ✅ | actor | ✅ |
| `src/lib/patients.mutations.functions.ts` | `updatePatient` | POST | ✅ | actor | ✅ |
| `src/lib/patients.mutations.functions.ts` | `addAllergy` | POST | ✅ | actor | ✅ |
| `src/lib/patients.mutations.functions.ts` | `addCondition` | POST | ✅ | actor | ✅ |
| `src/lib/patients.mutations.functions.ts` | `addEmergencyContact` | POST | ✅ | actor | ✅ |
| `src/lib/patients.mutations.functions.ts` | `mergePatients` | POST | ✅ | actor | ✅ |
| `src/lib/prescriptions.functions.ts` | `listPrescriptions` | POST | ✅ | actor | ✅ |
| `src/lib/prescriptions.functions.ts` | `getPrescription` | POST | ✅ | actor | ✅ |
| `src/lib/prescriptions.mutations.functions.ts` | `createPrescription` | POST | ✅ | actor | ✅ |
| `src/lib/prescriptions.mutations.functions.ts` | `updatePrescription` | POST | ✅ | actor | ✅ |
| `src/lib/prescriptions.mutations.functions.ts` | `addPrescriptionItem` | POST | ✅ | actor | ✅ |
| `src/lib/prescriptions.mutations.functions.ts` | `removePrescriptionItem` | POST | ✅ | actor | ✅ |
| `src/lib/prescriptions.mutations.functions.ts` | `transitionPrescription` | POST | ✅ | actor | ✅ |
| `src/lib/prescriptions.mutations.functions.ts` | `addPrescriptionNote` | POST | ✅ | actor | ✅ |
| `src/lib/promotions.functions.ts` | `listPromotions` | GET | ✅ | middleware | — |
| `src/lib/promotions.functions.ts` | `getPromotion` | GET | ✅ | middleware | ✅ |
| `src/lib/promotions.functions.ts` | `listCoupons` | GET | ✅ | middleware | — |
| `src/lib/promotions.functions.ts` | `previewPromotion` | POST | ✅ | middleware | ✅ |
| `src/lib/promotions.mutations.functions.ts` | `createPromotion` | POST | ✅ | actor | ✅ |
| `src/lib/promotions.mutations.functions.ts` | `updatePromotion` | POST | ✅ | actor | ✅ |
| `src/lib/promotions.mutations.functions.ts` | `transitionPromotion` | POST | ✅ | actor | ✅ |
| `src/lib/promotions.mutations.functions.ts` | `createCoupon` | POST | ✅ | actor | ✅ |
| `src/lib/promotions.mutations.functions.ts` | `archiveCoupon` | POST | ✅ | actor | ✅ |
| `src/lib/promotions.mutations.functions.ts` | `redeemCoupon` | POST | ✅ | actor | ✅ |
| `src/lib/purchasing.functions.ts` | `listPurchaseOrders` | GET | ✅ | middleware | — |
| `src/lib/purchasing.functions.ts` | `getPurchaseOrder` | GET | ✅ | middleware | ✅ |
| `src/lib/purchasing.functions.ts` | `createPurchaseOrder` | POST | ✅ | actor | ✅ |
| `src/lib/purchasing.functions.ts` | `updatePurchaseOrder` | POST | ✅ | actor | ✅ |
| `src/lib/purchasing.functions.ts` | `submitPurchaseOrder` | POST | ✅ | actor | ✅ |
| `src/lib/purchasing.functions.ts` | `approvePurchaseOrder` | POST | ✅ | actor | ✅ |
| `src/lib/purchasing.functions.ts` | `cancelPurchaseOrder` | POST | ✅ | actor | ✅ |
| `src/lib/purchasing.functions.ts` | `receivePurchaseOrder` | POST | ✅ | actor | ✅ |
| `src/lib/sbdma-import.functions.ts` | `analyzeSbdmaImport` | POST | ✅ | middleware | ✅ |
| `src/lib/sbdma-import.functions.ts` | `commitSbdmaImport` | POST | ✅ | middleware | ✅ |
| `src/lib/sbdma-import.functions.ts` | `listSbdmaImportJobs` | GET | ✅ | middleware | — |
| `src/lib/sbdma-import.functions.ts` | `getSbdmaImportJob` | GET | ✅ | middleware | ✅ |
| `src/lib/suppliers.functions.ts` | `listSuppliers` | GET | ✅ | middleware | — |
| `src/lib/suppliers.mutations.functions.ts` | `createSupplier` | POST | ✅ | actor | ✅ |
| `src/lib/suppliers.mutations.functions.ts` | `updateSupplier` | POST | ✅ | actor | ✅ |
