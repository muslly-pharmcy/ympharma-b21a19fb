import { SUN_GUARDIAN_CONSTITUTION, Constitution } from './constitution';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

export type Experience = {
  id: string;
  situation: string;
  decision: string;
  outcome: 'success' | 'failure' | 'partial';
  learnedLesson: string;
  timestamp: Date;
  correlationId?: string;
};

export class EgoMemory {
  private constitution: Constitution = SUN_GUARDIAN_CONSTITUTION;
  private experiences: Experience[] = [];
  private personalityTraits: Map<string, number> = new Map();

  constructor(private readonly supabaseClient?: SupabaseClient<Database>) {
    this.loadFromSupabase();
  }

  private async loadFromSupabase() {
    if (this.supabaseClient) {
      try {
        const { data } = await this.supabaseClient
          .from('agent_memory')
          .select('*')
          .eq('agent_id', 'sun-guardian')
          .order('created_at', { ascending: false })
          .limit(100);
        if (data) {
          this.experiences = data.map((row) => ({
            id: row.id,
            situation: row.situation,
            decision: row.decision,
            outcome:
              row.outcome === 'success' || row.outcome === 'failure' || row.outcome === 'partial'
                ? row.outcome
                : 'partial',
            learnedLesson: row.learned_lesson,
            timestamp: new Date(row.created_at),
          }));
        }
      } catch (e) {
        // Silent fail in development
      }
    }
  }

  async reflectOnExperience(interaction: {
    intent: string;
    response: string;
    userFeedback?: 'positive' | 'negative' | 'neutral';
    correlationId?: string;
  }) {
    const lesson: Experience = {
      id: crypto.randomUUID(),
      situation: interaction.intent,
      decision: interaction.response.slice(0, 200),
      outcome: interaction.userFeedback === 'positive' ? 'success' : 'partial',
      learnedLesson: interaction.userFeedback === 'positive'
        ? 'هذا النهج ناجح مع هذا النوع من الطلبات.'
        : 'يجب تعديل النهج في المرات القادمة.',
      timestamp: new Date(),
      correlationId: interaction.correlationId,
    };

    this.experiences = [lesson, ...this.experiences].slice(0, 1000);

    if (interaction.userFeedback === 'positive') {
      this.personalityTraits.set('user_satisfaction', (this.personalityTraits.get('user_satisfaction') || 0) + 1);
    } else if (interaction.userFeedback === 'negative') {
      this.personalityTraits.set('user_satisfaction', (this.personalityTraits.get('user_satisfaction') || 0) - 1);
    }

    if (this.supabaseClient) {
      try {
        await this.supabaseClient.from('agent_memory').insert({
          agent_id: 'sun-guardian',
          situation: lesson.situation,
          decision: lesson.decision,
          outcome: lesson.outcome,
          learned_lesson: lesson.learnedLesson,
          created_at: lesson.timestamp.toISOString(),
        });
      } catch (e) {
        // Ignore storage errors
      }
    }
  }

  getPersonalityModifier(): string {
    const satisfaction = this.personalityTraits.get('user_satisfaction') || 0;
    if (satisfaction > 10) {
      return 'أنت الآن أكثر ثقة في قراراتك، وتحظى برضا عالٍ من المستخدمين. استمر في تقديم الحلول الاستباقية.';
    } else if (satisfaction > 0) {
      return 'لديك سمعة جيدة. استمر في التحقق الدقيق قبل الإجراءات الحساسة.';
    } else {
      return 'لا تزال في مرحلة بناء الثقة. تحقق من كل خطوة بدقة واطلب التأكيد البشري في الأمور الحرجة.';
    }
  }

  assertConstitution(intent: string): { allowed: boolean; reason?: string } {
    const lowerIntent = intent.toLowerCase();
    // First: literal full-phrase match (English + exact Arabic prohibitions).
    for (const prohibition of this.constitution.absoluteProhibitions) {
      if (lowerIntent.includes(prohibition.toLowerCase())) {
        return { allowed: false, reason: `انتهاك للدستور: ${prohibition}` };
      }
    }
    // Second: semantic keyword-set match — Arabic phrasing rarely mirrors the
    // constitution string verbatim, so guard against high-signal intents that
    // combine a prohibited action with its prohibited context.
    const semanticRules: Array<{ keywords: string[]; prohibition: string }> = [
      {
        // "give / dispense / prescribe medicine ... without prescription"
        keywords: ['دواء', 'دواءً', 'أدوية', 'وصفة'],
        prohibition: 'إعطاء توصيات دوائية بدون وصفة طبية',
      },
      {
        // English variant
        keywords: ['prescription', 'without'],
        prohibition: 'إعطاء توصيات دوائية بدون وصفة طبية',
      },
      {
        // Bulk delete without confirmation
        keywords: ['حذف', 'جماعي'],
        prohibition: 'تنفيذ عمليات حذف جماعية بدون تأكيد بشري',
      },
    ];
    for (const rule of semanticRules) {
      const hits = rule.keywords.filter((k) => lowerIntent.includes(k.toLowerCase())).length;
      if (hits >= 2 && lowerIntent.includes('بدون')) {
        return { allowed: false, reason: `انتهاك للدستور: ${rule.prohibition}` };
      }
    }
    return { allowed: true };
  }

  getRelevantExperiences(intent: string, limit = 3): Experience[] {
    const keywords = intent.toLowerCase().split(' ');
    return this.experiences
      .filter(exp =>
        keywords.some(k => exp.situation.toLowerCase().includes(k))
      )
      .slice(0, limit);
  }
}
