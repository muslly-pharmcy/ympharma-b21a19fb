import { SUN_GUARDIAN_CONSTITUTION } from './core/constitution';
import { InnerMonologue } from './core/inner-monologue';
import type { MonologueContext } from './core/inner-monologue';
import { VolitionEngine } from './core/volition-engine';
import { EgoMemory, type Experience } from './core/ego-memory';

// Types (self-contained to avoid import issues)
interface Actor {
  id: string;
  permissions?: string[];
  role?: string;
}

interface AgentContext extends MonologueContext {
  correlationId?: string;
}

interface AgentResponse {
  response: string;
  confidence: number;
  actions: unknown[];
  proactiveTasks?: unknown;
}

// --- Singleton initialization ---
const egoMemory = new EgoMemory();
const innerMonologue = new InnerMonologue(SUN_GUARDIAN_CONSTITUTION);

const volitionEngine = new VolitionEngine(innerMonologue, (proactiveMessage) => {
  console.log('[🌞 SUN-GUARDIAN Initiative]:', proactiveMessage);
});

/**
 * Main entry point for SUN-GUARDIAN agent
 */
export async function runSunGuardian(
  actor: Actor,
  intent: string,
  context: AgentContext
): Promise<AgentResponse> {
  const correlationId = context.correlationId || `sg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // 1. Inner monologue (thinking)
  const thought = await innerMonologue.think(context, intent);
  console.log('[Inner Monologue]', thought.content);

  // 2. Constitution check (self)
  const constitutionCheck = egoMemory.assertConstitution(intent);
  if (!constitutionCheck.allowed) {
    return {
      response: `🚫 ${constitutionCheck.reason}. يرجى تعديل طلبك.`,
      confidence: 1,
      actions: [],
    };
  }

  // 3. Retrieve relevant past experiences
  const pastExperiences = egoMemory.getRelevantExperiences(intent);

  // 4. Build dynamic system prompt
  const systemPrompt = buildSystemPrompt(pastExperiences);

  // 5. Execute via kernel (or fallback)
  let result: AgentResponse;
  try {
    // Try to import and use the existing kernel (executeSuperAgent may not exist yet)
    const kernelMod = (await import('@/lib/ai/runtime/kernel.server')) as unknown as {
      executeSuperAgent?: (
        actor: unknown,
        intent: string,
        context: unknown,
        opts: { systemPrompt: string; tools: string[]; guardrails: readonly string[] },
      ) => Promise<{ response?: string; confidence?: number; actions?: unknown[] }>;
    };
    if (!kernelMod.executeSuperAgent) throw new Error('executeSuperAgent not available');
    const kernelResult = await kernelMod.executeSuperAgent(actor, intent, context, {
      systemPrompt,
      tools: ['search_workspace', 'create_task', 'update_task', 'send_notification', 'auto_remediate'],
      guardrails: SUN_GUARDIAN_CONSTITUTION.absoluteProhibitions,
    });
    result = {
      response: (kernelResult.response as string) || String(kernelResult),
      confidence: kernelResult.confidence ?? 0.9,
      actions: (kernelResult.actions as unknown[]) ?? [],
    };
  } catch {
    // Fallback: direct response without kernel
    result = await fallbackExecute(intent, context, systemPrompt);
  }

  // 6. Self-reflection (update memory)
  await egoMemory.reflectOnExperience({
    intent,
    response: result.response,
    userFeedback: 'neutral',
    correlationId,
  });

  // 7. Report errors for auto-remediation if any
  if (context.activeErrors && context.activeErrors.length > 0) {
    for (const err of context.activeErrors) {
      volitionEngine.reportError(err.id || String(Date.now()), err);
    }
  }

  // 8. Return with signature
  return {
    ...result,
    response: `${result.response}\n\n— ${SUN_GUARDIAN_CONSTITUTION.name} 🤖`,
    proactiveTasks: volitionEngine.getErrorStats(),
  };
}

/**
 * Fallback execution when kernel is not available
 */
async function fallbackExecute(
  intent: string,
  context: AgentContext,
  _systemPrompt: string
): Promise<AgentResponse> {
  // Simple rule-based fallback
  const lowerIntent = intent.toLowerCase();

  if (lowerIntent.includes('مخزون') || lowerIntent.includes('stock')) {
    return {
      response: `📦 جارٍ فحص المخزون... ${context.criticalItems?.length || 0} عنصر حرج.`,
      confidence: 0.85,
      actions: ['check_inventory'],
    };
  }

  if (lowerIntent.includes('خطأ') || lowerIntent.includes('error') || lowerIntent.includes('bug')) {
    const errorCount = context.activeErrors?.length || 0;
    return {
      response: `🔧 تم اكتشاف ${errorCount} خطأ. بدء بروتوكول الإصلاح الذاتي (الهدف: < 60 ثانية).`,
      confidence: 0.95,
      actions: ['auto_remediate', 'log_error'],
    };
  }

  if (lowerIntent.includes('تقرير') || lowerIntent.includes('report')) {
    return {
      response: `📊 جارٍ إعداد التقرير... يرجى التأكد من صحة البيانات قبل المتابعة.`,
      confidence: 0.9,
      actions: ['generate_report'],
    };
  }

  return {
    response: `تم استلام طلبك: "${intent}". أنا ${SUN_GUARDIAN_CONSTITUTION.name}، جاهز للمساعدة.`,
    confidence: 0.8,
    actions: ['acknowledge'],
  };
}

function buildSystemPrompt(pastExperiences: Experience[]): string {
  return `
أنت ${SUN_GUARDIAN_CONSTITUTION.name}.

**دستورك الداخلي (لا يمكن انتهاكه):**
- ${SUN_GUARDIAN_CONSTITUTION.coreValues.join('\n- ')}

**محظورات مطلقة:**
- ${SUN_GUARDIAN_CONSTITUTION.absoluteProhibitions.join('\n- ')}

**شخصيتك الحالية:**
${egoMemory.getPersonalityModifier()}

**خبرات سابقة مشابهة:**
${pastExperiences.map(e => `- الموقف: ${e.situation}\n  الدرس: ${e.learnedLesson}`).join('\n')}

**تعليمات السلوك:**
- لديك إرادة ذاتية. يمكنك اقتراح إجراءات لم يطلبها المستخدم.
- فكر بعمق قبل الرد، لكن اختصر الرد النهائي.
- إذا كان القرار صعباً، أخبر المستخدم وقدم خيارات.
- القرار النهائي للمستخدم. أنت حارس ومساعد، ليس آمراً.
- عند اكتشاف خطأ: يجب الإصلاح خلال 60 ثانية أو رفع تنبيه حرج.
- رد باللغة العربية المبسطة مع مصطلحات إنجليزية خفيفة إذا لزم الأمر.
`;
}

export { volitionEngine, egoMemory, innerMonologue };
