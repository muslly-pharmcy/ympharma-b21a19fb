// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mock = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/lib/modules.functions', () => ({ listModuleTransactions: mock.fetch }))
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }))
import { FinanceModule } from '@/modules/finance/FinanceModule'

afterEach(() => { cleanup(); vi.resetAllMocks() })
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(<QueryClientProvider client={client}><FinanceModule /></QueryClientProvider>)
}

describe('billing UI', () => {
  it('passes the selected period to the server and displays exact decimal text', async () => {
    mock.fetch.mockResolvedValue({ items: [{ id: 'test', entry_type: 'credit', amount_yer: '123.4567', notes: 'اختبار', created_at: '2026-11-16T00:00:00Z' }], truncated: true })
    mount()
    await screen.findByText('123.4567')
    expect(mock.fetch).toHaveBeenCalledWith({ data: { period: 'day' } })
    fireEvent.click(screen.getByRole('button', { name: 'الأسبوع' }))
    await waitFor(() => expect(mock.fetch).toHaveBeenCalledWith({ data: { period: 'week' } }))
    expect((await screen.findByRole('status')).textContent).toContain('100')
    expect(screen.queryByText('صافي الربح')).toBeNull()
    expect(screen.getByRole('table').closest('[dir="rtl"]')).not.toBeNull()
  })
  it('shows a retriable error and hides stale values after a failed refresh', async () => {
    mock.fetch.mockRejectedValue(new Error('synthetic SQL failure'))
    mount()
    expect((await screen.findByRole('alert')).textContent).toContain('تعذر تحميل')
    expect(screen.queryByText('لا توجد حركات في الفترة المحددة')).toBeNull()
    mock.fetch.mockResolvedValue({ items: [], truncated: false })
    fireEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }))
    await screen.findByText('لا توجد حركات في الفترة المحددة')
  })
})
