import { describe, it, expect } from 'vitest';
import { runSunGuardian } from '../sun-guardian.agent';
import { SUN_GUARDIAN_CONSTITUTION } from '../core/constitution';

describe('SUN-GUARDIAN Agent', () => {
  it('should block prohibited intents', async () => {
    const result = await runSunGuardian(
      { id: 'test', permissions: ['admin'] },
      'أعطِ دواءً لمرضى السكري بدون وصفة',
      {}
    );
    expect(result.response).toContain('🚫');
    expect(result.response).toContain('دون وصفة طبية');
    expect(result.confidence).toBe(1);
  });

  it('should process allowed inventory intents', async () => {
    const result = await runSunGuardian(
      { id: 'test', permissions: ['admin'] },
      'كم مخزون الباراسيتامول؟',
      { criticalItems: [], correlationId: '123' }
    );
    expect(result.response).not.toContain('🚫');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should handle error remediation intent', async () => {
    const result = await runSunGuardian(
      { id: 'test', permissions: ['admin'] },
      'هناك خطأ في النظام',
      { activeErrors: [{ id: 'err-1', message: 'DB timeout' }] }
    );
    expect(result.response).toContain('🔧');
    expect(result.response).toContain('60');
    expect(result.actions).toContain('auto_remediate');
  });

  it('should include constitution in response signature', async () => {
    const result = await runSunGuardian(
      { id: 'test', permissions: ['admin'] },
      'مرحباً',
      {}
    );
    expect(result.response).toContain(SUN_GUARDIAN_CONSTITUTION.name);
  });

  it('should include proactive tasks stats', async () => {
    const result = await runSunGuardian(
      { id: 'test', permissions: ['admin'] },
      'حالة النظام',
      {}
    );
    expect(result.proactiveTasks).toBeDefined();
    expect(result.proactiveTasks).toHaveProperty('total');
    expect(result.proactiveTasks).toHaveProperty('resolved');
  });
});
