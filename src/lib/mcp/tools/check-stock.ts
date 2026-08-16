import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "check_stock",
  title: "Check product stock",
  description:
    "Returns current stock quantities across the signed-in user's warehouses for a given product id.",
  inputSchema: {
    product_id: z.string().uuid().describe("The catalog_products.id UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ product_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("inventory_stock")
      .select("warehouse_id, quantity, batch_number, expiry_date")
      .eq("product_id", product_id);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const total = (data ?? []).reduce((sum, row: { quantity?: number }) => sum + (row.quantity ?? 0), 0);
    return {
      content: [{ type: "text", text: JSON.stringify({ total, batches: data ?? [] }, null, 2) }],
      structuredContent: { total, batches: data ?? [] },
    };
  },
});
