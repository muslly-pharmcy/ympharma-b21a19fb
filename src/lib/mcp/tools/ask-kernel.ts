import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "ask_kernel",
  title: "Ask the MUSLLY AI Kernel",
  description:
    "Send a question to the MUSLLY Autonomous AI Kernel. Routes intent, grounds clinical questions in the clinical engine, and returns the answer plus its reasoning trace. High-risk actions are queued for human approval instead of executing.",
  inputSchema: {
    question: z.string().trim().min(3).describe("The question to ask the kernel."),
    agent_key: z
      .string()
      .trim()
      .nullable()
      .describe("Agent to route to; null uses the general pharmacist agent."),
    client_id: z
      .string()
      .uuid()
      .nullable()
      .describe("Optional patient/customer id to load their unified record."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ question, agent_key, client_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text" as const, text: "Not authenticated" }], isError: true };
    }
    try {
      const { actorFromToken } = await import("../actor.server");
      const { dispatch } = await import("@/lib/ai/runtime/kernel.server");

      const actor = await actorFromToken(ctx);
      const res = await dispatch(actor, {
        agentKey: agent_key ?? "pharmacist",
        input: question,
        clientId: client_id,
        fromAgent: "mcp",
      });

      return {
        content: [{ type: "text" as const, text: res.output }],
        structuredContent: {
          run_id: res.runId,
          model: res.model,
          intent: res.intent?.intent ?? null,
          clinical: res.clinical ?? null,
          requires_approval: res.requiresApproval ?? false,
          approval_id: res.approvalId ?? null,
          latency_ms: res.latencyMs,
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
