import { useRouter } from '@tanstack/react-router'

interface RouteLoadErrorProps {
  title: string
  error: unknown
  reset: () => void
}

export function RouteLoadError({ title, error, reset }: RouteLoadErrorProps) {
  const router = useRouter()

  return (
    <div dir="rtl" className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-bold text-red-700">{title}</h1>
      <pre className="mt-3 whitespace-pre-wrap rounded bg-red-50 p-3 text-sm">
        {String(error instanceof Error ? error.message : error)}
      </pre>
      <button
        className="mt-4 rounded bg-teal-600 px-4 py-2 text-white"
        onClick={() => {
          reset()
          void router.invalidate()
        }}
      >
        إعادة المحاولة
      </button>
    </div>
  )
}
