import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Theme } from '@/types'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  isDark: boolean
}

const defaultTheme: Theme = {
  mode: 'light',
  primary: '#005D4F',
  secondary: '#0F766E',
  accent: '#C9A227',
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)

  const isDark = theme.mode === 'dark'

  // Hydrate saved theme from localStorage on the client only, to avoid
  // SSR crashes and hydration mismatches.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = window.localStorage.getItem('mussly-theme')
      if (saved) setThemeState(JSON.parse(saved) as Theme)
    } catch {
      // ignore corrupted storage
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem('mussly-theme', JSON.stringify(theme))
    } catch {
      // ignore quota / private-mode failures
    }
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
      document.body.style.backgroundColor = '#0F172A'
      document.body.style.color = '#F1F5F9'
    } else {
      root.classList.remove('dark')
      document.body.style.backgroundColor = '#F4F7F6'
      document.body.style.color = '#111827'
    }
  }, [theme, isDark])

  const setTheme = (newTheme: Theme) => setThemeState(newTheme)

  const toggleTheme = () => {
    setThemeState(prev => ({
      ...prev,
      mode: prev.mode === 'light' ? 'dark' : 'light',
    }))
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
