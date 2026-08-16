import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import {
  archiveProduct,
  createProduct,
  updateProduct,
} from '@/lib/catalog.mutations.functions'
import {
  adjustStock,
  consumeReservation,
  createWarehouse,
  receiveStock,
  releaseReservation,
  reserveStock,
  returnStock,
  transferStock,
  updateWarehouse,
} from '@/lib/inventory.mutations.functions'
import {
  createSupplier,
  updateSupplier,
} from '@/lib/suppliers.mutations.functions'
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  receivePurchaseOrder,
  submitPurchaseOrder,
  updatePurchaseOrder,
} from '@/lib/purchasing.functions'

function useInvalidator(keys: Array<Array<string>>) {
  const qc = useQueryClient()
  return () => keys.forEach((k) => qc.invalidateQueries({ queryKey: k }))
}

// ---------- catalog ----------
export function useCreateProduct() {
  const fn = useServerFn(createProduct)
  const invalidate = useInvalidator([['catalog', 'list']])
  return useMutation({ mutationFn: fn, onSuccess: invalidate })
}
export function useUpdateProduct() {
  const fn = useServerFn(updateProduct)
  const invalidate = useInvalidator([['catalog', 'list'], ['catalog', 'product']])
  return useMutation({ mutationFn: fn, onSuccess: invalidate })
}
export function useArchiveProduct() {
  const fn = useServerFn(archiveProduct)
  const invalidate = useInvalidator([['catalog', 'list'], ['catalog', 'product']])
  return useMutation({ mutationFn: fn, onSuccess: invalidate })
}

// ---------- warehouses ----------
export function useCreateWarehouse() {
  const fn = useServerFn(createWarehouse)
  const invalidate = useInvalidator([['inventory', 'warehouses']])
  return useMutation({ mutationFn: fn, onSuccess: invalidate })
}
export function useUpdateWarehouse() {
  const fn = useServerFn(updateWarehouse)
  const invalidate = useInvalidator([['inventory', 'warehouses']])
  return useMutation({ mutationFn: fn, onSuccess: invalidate })
}

// ---------- suppliers ----------
export function useCreateSupplier() {
  const fn = useServerFn(createSupplier)
  const invalidate = useInvalidator([['suppliers', 'list']])
  return useMutation({ mutationFn: fn, onSuccess: invalidate })
}
export function useUpdateSupplier() {
  const fn = useServerFn(updateSupplier)
  const invalidate = useInvalidator([['suppliers', 'list']])
  return useMutation({ mutationFn: fn, onSuccess: invalidate })
}

// ---------- stock ----------
export function useReceiveStock() {
  const fn = useServerFn(receiveStock)
  const invalidate = useInvalidator([['inventory', 'stock-summary']])
  return useMutation({ mutationFn: fn, onSuccess: invalidate })
}
export function useAdjustStock() {
  const fn = useServerFn(adjustStock)
  const invalidate = useInvalidator([['inventory', 'stock-summary']])
  return useMutation({ mutationFn: fn, onSuccess: invalidate })
}
export function useTransferStock() {
  const fn = useServerFn(transferStock)
  const invalidate = useInvalidator([['inventory', 'stock-summary']])
  return useMutation({ mutationFn: fn, onSuccess: invalidate })
}
export function useReserveStock() {
  const fn = useServerFn(reserveStock)
  const invalidate = useInvalidator([['inventory', 'stock-summary'], ['inventory', 'reservations']])
  return useMutation({ mutationFn: fn, onSuccess: invalidate })
}
export function useReleaseReservation() {
  const fn = useServerFn(releaseReservation)
  const invalidate = useInvalidator([['inventory', 'stock-summary'], ['inventory', 'reservations']])
  return useMutation({ mutationFn: fn, onSuccess: invalidate })
}
export function useConsumeReservation() {
  const fn = useServerFn(consumeReservation)
  const invalidate = useInvalidator([['inventory', 'stock-summary'], ['inventory', 'reservations']])
  return useMutation({ mutationFn: fn, onSuccess: invalidate })
}
export function useReturnStock() {
  const fn = useServerFn(returnStock)
  const invalidate = useInvalidator([['inventory', 'stock-summary']])
  return useMutation({ mutationFn: fn, onSuccess: invalidate })
}

// ---------- purchasing ----------
export function usePurchaseOrderMutations() {
  const invalidate = useInvalidator([['purchasing', 'list'], ['purchasing', 'detail']])
  const create = useServerFn(createPurchaseOrder)
  const update = useServerFn(updatePurchaseOrder)
  const submit = useServerFn(submitPurchaseOrder)
  const approve = useServerFn(approvePurchaseOrder)
  const cancel = useServerFn(cancelPurchaseOrder)
  const receive = useServerFn(receivePurchaseOrder)
  return {
    create: useMutation({ mutationFn: create, onSuccess: invalidate }),
    update: useMutation({ mutationFn: update, onSuccess: invalidate }),
    submit: useMutation({ mutationFn: submit, onSuccess: invalidate }),
    approve: useMutation({ mutationFn: approve, onSuccess: invalidate }),
    cancel: useMutation({ mutationFn: cancel, onSuccess: invalidate }),
    receive: useMutation({ mutationFn: receive, onSuccess: invalidate }),
  }
}
