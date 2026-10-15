import { describe, it, expect, vi } from "vitest";
import {
  invokeReviewCheckout,
  type CheckoutRpc,
} from "../src/lib/erp/checkout-review.server";

const requestId = "d4f980ab-93e8-414b-81ca-acb7e91d8d7e",
  quoteHash = "a".repeat(64);
describe("review checkout request boundary", () => {
  it.each(["unit_price", "quantity", "items", "expires_at", "user_id"])(
    "rejects client-controlled %s before any RPC",
    async (field) => {
      const rpc = vi.fn();
      await expect(
        invokeReviewCheckout({ rpc } as CheckoutRpc, "submit", {
          requestId,
          quoteHash,
          [field]: "0",
        }),
      ).rejects.toThrow();
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it("passes only the stable request and server quote hash", async () => {
    const result = {
        order_id: "WEB_fixture",
        state: "PENDING_REVIEW",
        payment_collected: false,
      },
      rpc = vi.fn().mockResolvedValue({ data: result, error: null });
    expect(
      await invokeReviewCheckout({ rpc }, "submit", { requestId, quoteHash }),
    ).toEqual(result);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("erp_checkout_submit", {
      p_request: requestId,
      p_quote_hash: quoteHash,
    });
  });
  it("preserves a requote refusal for safe UI recovery", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({
        data: null,
        error: { message: "CART_OR_PRICE_CHANGED_REQUOTE" },
      });
    await expect(
      invokeReviewCheckout({ rpc }, "submit", { requestId, quoteHash }),
    ).rejects.toThrow("CART_OR_PRICE_CHANGED_REQUOTE");
  });
  it("forbids choosing another actor for status", async () => {
    const rpc = vi.fn();
    await expect(
      invokeReviewCheckout({ rpc } as CheckoutRpc, "status", {
        requestId,
        userId: requestId,
      }),
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects a malformed request ID before cancellation", async () => {
    const rpc = vi.fn();
    await expect(
      invokeReviewCheckout({ rpc } as CheckoutRpc, "cancel", {
        requestId: "invalid",
      }),
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});
