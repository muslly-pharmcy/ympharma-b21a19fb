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
  name: "search_catalog",
  title: "Search product catalog",
  description:
    "Search the Muslly pharmacy product catalog by name, barcode, or active ingredient. Returns up to 20 matches visible to the signed-in user.",
  inputSchema: {
    query: z.string().min(1).describe("Search term: product name, barcode, or active ingredient."),
    limit: z.number().int().min(1).max(50).optional().describe("Maximum results to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const max = limit ?? 20;
    const { data, error } = await supabase
      .from("catalog_products")
      .select("id, name_ar, name_en, barcode, active_ingredient, requires_prescription")
      .or(
        `name_ar.ilike.%${query}%,name_en.ilike.%${query}%,barcode.ilike.%${query}%,active_ingredient.ilike.%${query}%`,
      )
      .limit(max);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { results: data ?? [] },
    };
  },
});
