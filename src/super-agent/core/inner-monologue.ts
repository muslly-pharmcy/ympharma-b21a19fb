import { Constitution } from './constitution';

export type ThoughtPhase = 'observe' | 'orient' | 'decide' | 'act' | 'reflect';

export interface Thought {
  phase: ThoughtPhase;
  content: string;
  timestamp: Date;
  confidence: number;
}

export interface MonologueContext {
  criticalItems?: unknown[]
  activeAlerts?: unknown[]
  activeErrors?: Array<{ id?: string; [key: string]: unknown }>
  isHighRisk?: boolean
  [key: string]: unknown
}

export class InnerMonologue {
  private thoughts: Thought[] = [];

  constructor(private constitution: Constitution) {}

  async think(context: MonologueContext, intent: string): Promise<Thought> {
    const observation = this.observe(context);
    const orientation = this.orient(observation);
    const decision = this.decide(orientation, intent);
    const reflection = await this.reflect(decision, context);

    const finalThought: Thought = {
      phase: 'reflect',
      content: `[تأمل] ${reflection.summary} (ثقة: ${reflection.confidence})`,
      timestamp: new Date(),
      confidence: reflection.confidence,
    };

    this.thoughts.push(finalThought);
    return finalThought;
  }

  private observe(context: MonologueContext): string {
    const critical = context.criticalItems?.length || 0;
    const alerts = context.activeAlerts?.length || 0;
    const errors = context.activeErrors?.length || 0;
    return `الملاحظة: ${critical} عنصر حرج، ${alerts} تنبيه، ${errors} خطأ نشط.`;
  }

  private orient(observation: string): string {
    const priority = this.constitution.priorities[0];
    return `التوجيه: الأولوية القصوى هي "${priority}". ${observation}`;
  }

  private decide(orientation: string, intent: string): string {
    if (intent.includes('حذف') && !intent.includes('تأكيد')) {
      return `القرار: طلب حذف بدون تأكيد. سأطلب تأكيداً بشرياً أولاً.`;
    }
    if (intent.includes('خطأ') || intent.includes('error') || intent.includes('bug')) {
      return `القرار: خطأ مكتشف. يجب الإصلاح خلال 60 ثانية أو رفع تنبيه حرج.`;
    }
    return `القرار: تنفيذ الطلب مع إضافة تحذيرات أمان.`;
  }

  private async reflect(decision: string, context: MonologueContext): Promise<{ summary: string; confidence: number }> {
    const baseConfidence = 0.85;
    if (context.isHighRisk) {
      return {
        summary: `القرار يتوافق مع الدستور، لكن السياق عالي الخطورة. أنصح بتأكيد بشري.`,
        confidence: baseConfidence - 0.2,
      };
    }
    if ((context.activeErrors?.length ?? 0) > 0) {
      return {
        summary: `خطأ نشط يتطلب إصلاح فوري. بدء بروتوكول الإصلاح الذاتي.`,
        confidence: baseConfidence + 0.05,
      };
    }
    return {
      summary: `القرار آمن ومنطقي. يمكن التنفيذ.`,
      confidence: baseConfidence + 0.1,
    };
  }

  getRecentThoughts(): Thought[] {
    return this.thoughts.slice(-5);
  }

  getFullTranscript(): string {
    return this.thoughts.map(t => `[${t.phase}] ${t.content}`).join('\n');
  }
}
