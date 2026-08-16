import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "clinical_check",
  title: "Run a clinical safety check",
  description:
    "Run allergy, interaction, dose, contraindication, pregnancy, renal and hepatic checks for a list of drugs against an optional patient record. Advisory only — never a substitute for a licensed pharmacist.",
  inputSchema: {
    drugs: z
      .array(z.string().trim().min(1))
      .min(1)
      .describe("Drug names to evaluate together."),
    patient_id: z
      .string()
      .uuid()
      .nullable()
      .describe("Optional patient id whose allergies and conditions should be considered."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ drugs, patient_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text" as const, text: "Not authenticated" }], isError: true };
    }
    try {
      const { actorFromToken } = await import("../actor.server");
      const { loadClientRecord } = await import("@/lib/ai/runtime/ego-memory.server");
      const { groundClinically } = await import("@/lib/ai/runtime/clinical-rag.server");

      const actor = await actorFromToken(ctx);
      const record = patient_id ? await loadClientRecord(actor.organizationId, patient_id) : null;
      const grounding = await groundClinically({ record, drugNames: drugs });

      const text = grounding.warnings.length
        ? grounding.warnings
            .map((w) => `[${w.severity}/${w.category}] ${w.message} (${w.source})`)
            .join("\n")
        : "No warnings returned by the clinical engine. Advisory only — confirm with a pharmacist.";

      return {
        content: [{ type: "text" as const, text }],
        structuredContent: {
          provider: grounding.providerId,
          confidence: grounding.confidence,
          highest_severity: grounding.highestSeverity,
          warnings: grounding.warnings,
        },
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: (err as Error).message }],
        isError: true,
      };
    }
  },
});
