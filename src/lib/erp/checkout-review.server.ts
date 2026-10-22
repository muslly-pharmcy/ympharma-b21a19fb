import { z } from "zod";
export type CheckoutAction = "mode" | "quote" | "submit" | "status" | "cancel";
export interface CheckoutRpc {
  rpc(
    name: any,
    args?: any,
  ): PromiseLike<{ data: any; error: { message: string } | null }>;
}
const request = z.object({ requestId: z.string().uuid() }).strict();
export async function invokeReviewCheckout(
  db: CheckoutRpc,
  action: CheckoutAction,
  input: unknown = {},
) {
  let args: Record<string, string> = {};
  if (action === "submit") {
    const v = z
      .object({
        requestId: z.string().uuid(),
        quoteHash: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict()
      .parse(input);
    args = { p_request: v.requestId, p_quote_hash: v.quoteHash };
  } else if (action === "status" || action === "cancel") {
    const v = request.parse(input);
    args = { p_request: v.requestId };
  } else z.object({}).strict().parse(input);
  const { data, error } = await db.rpc("erp_checkout_" + action, args);
  if (error) throw new Error(error.message);
  return data;
}
