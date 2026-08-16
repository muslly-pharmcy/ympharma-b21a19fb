import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, DollarSign, PieChart } from 'lucide-react'
import { listModuleTransactions } from '@/lib/modules.functions'
import { Skeleton } from '@/components/skeletons/Skeleton'

export function FinanceModule() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day')
  const fetchTx = useServerFn(listModuleTransactions)
  const { data, isLoading } = useQuery({
    queryKey: ['module', 'finance-transactions'],
    queryFn: () => fetchTx(),
    staleTime: 30_000,
  })
  const transactions = data?.items ?? []
  const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const profit = income - expense

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{income.toLocaleString()} ر.ي</p>
          <p className="text-xs text-gray-500">إجمالي الإيرادات</p>
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{expense.toLocaleString()} ر.ي</p>
          <p className="text-xs text-gray-500">إجمالي المصروفات</p>
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-gold" />
            </div>
          </div>
          <p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{profit.toLocaleString()} ر.ي</p>
          <p className="text-xs text-gray-500">صافي الربح</p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-4">
        <div className="flex gap-2">
          {(['day', 'week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${period === p ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {p === 'day' ? 'اليوم' : p === 'week' ? 'الأسبوع' : p === 'month' ? 'الشهر' : 'السنة'}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-4">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <PieChart className="w-5 h-5 text-primary" />
          آخر المعاملات
        </h3>
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>لا توجد معاملات</p>
            </div>
          ) : (
            transactions.slice(0, 20).map((tx, i) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'income' ? 'bg-green-50' : tx.type === 'expense' ? 'bg-red-50' : 'bg-blue-50'}`}>
                    {tx.type === 'income' ? <TrendingUp className="w-5 h-5 text-green-600" /> : tx.type === 'expense' ? <TrendingDown className="w-5 h-5 text-red-600" /> : <DollarSign className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{tx.description}</p>
                    <p className="text-xs text-gray-500">{tx.category}</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className={`font-bold ${tx.type === 'income' ? 'text-green-600' : tx.type === 'expense' ? 'text-red-600' : 'text-blue-600'}`}>
                    {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{tx.amount.toLocaleString()} ر.ي
                  </p>
                  <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleDateString('ar-SA')}</p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
