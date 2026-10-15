import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  reviewCheckoutQuote,
  submitReviewCheckout,
  reviewCheckoutStatus,
  cancelReviewCheckout,
} from "@/lib/erp/checkout-review.functions";
import {
  ErpManagedCheckout,
  type ReviewCheckoutPort,
} from "./ErpManagedCheckout";
export function ConnectedErpManagedCheckout({ actorId }: { actorId: string }) {
  const quote = useServerFn(reviewCheckoutQuote),
    submit = useServerFn(submitReviewCheckout),
    status = useServerFn(reviewCheckoutStatus),
    cancel = useServerFn(cancelReviewCheckout);
  const port = useMemo<ReviewCheckoutPort>(
    () => ({
      quote: () => quote(),
      submit: (data) => submit({ data }),
      status: (requestId) => status({ data: { requestId } }),
      cancel: (requestId) => cancel({ data: { requestId } }),
    }),
    [quote, submit, status, cancel],
  );
  return <ErpManagedCheckout key={actorId} actorId={actorId} port={port} />;
}
