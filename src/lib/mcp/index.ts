import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import searchCatalogTool from "./tools/search-catalog";
import checkStockTool from "./tools/check-stock";
import askKernelTool from "./tools/ask-kernel";
import clinicalCheckTool from "./tools/clinical-check";


// OAuth issuer MUST be the direct supabase.co host (RFC 8414 issuer match).
// Read the project ref from a Vite-inlined literal — not process.env — so the
// value survives publish and the Workers runtime.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "muslly-ai-os-mcp",
  title: "MUSLLY AI OS",
  version: "1.0.0",
  instructions:
    "Tools for the MUSLLY AI OS pharmacy platform. Use `whoami` to confirm the signed-in user and their organizations, `search_catalog` to find products, `check_stock` to inspect warehouse inventory, `ask_kernel` to query the autonomous AI kernel, and `clinical_check` for advisory drug-safety checks. All calls run as the authenticated user with row-level security enforced.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, searchCatalogTool, checkStockTool, askKernelTool, clinicalCheckTool],
});

