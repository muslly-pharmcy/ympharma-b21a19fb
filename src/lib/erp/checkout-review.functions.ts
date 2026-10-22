import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  invokeReviewCheckout,
  type CheckoutRpc,
} from "./checkout-review.server";
export const reviewCheckoutMode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    invokeReviewCheckout(context.supabase as unknown as CheckoutRpc, "mode"),
  );
export const reviewCheckoutQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) =>
    invokeReviewCheckout(context.supabase as unknown as CheckoutRpc, "quote"),
  );
export const submitReviewCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => data)
  .handler(({ context, data }) =>
    invokeReviewCheckout(
      context.supabase as unknown as CheckoutRpc,
      "submit",
      data,
    ),
  );
export const reviewCheckoutStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => data)
  .handler(({ context, data }) =>
    invokeReviewCheckout(
      context.supabase as unknown as CheckoutRpc,
      "status",
      data,
    ),
  );
export const cancelReviewCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => data)
  .handler(({ context, data }) =>
    invokeReviewCheckout(
      context.supabase as unknown as CheckoutRpc,
      "cancel",
      data,
    ),
  );
