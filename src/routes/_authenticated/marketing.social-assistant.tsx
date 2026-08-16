import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { Copy, Loader2, Share2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import {
  generateSocialPosts,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
  type SocialPost,
} from '@/lib/social.functions'

export const Route = createFileRoute('/_authenticated/marketing/social-assistant')({
  head: () => ({
    meta: [
      { title: 'مساعد المحتوى الاجتماعي — صيدلية المصلي' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: SocialAssistantPage,
})

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  tiktok: 'تيك توك',
  instagram: 'إنستغرام',
  facebook: 'فيسبوك',
  x: 'إكس (تويتر)',
}

const SHARE_URL: Record<SocialPlatform, (text: string) => string> = {
  tiktok: () => 'https://www.tiktok.com/upload',
  instagram: () => 'https://www.instagram.com/',
  facebook: (t) => `https://www.facebook.com/sharer/sharer.php?u=https://muslly.com&quote=${encodeURIComponent(t)}`,
  x: (t) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}`,
}

function SocialAssistantPage() {
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(['instagram', 'facebook'])
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState<'professional' | 'friendly' | 'urgent'>('friendly')
  const [posts, setPosts] = useState<SocialPost[]>([])

  const genFn = useServerFn(generateSocialPosts)
  const gen = useMutation({
    mutationFn: () => genFn({ data: { platforms, topic: topic || null, tone } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error ?? 'تعذّر التوليد')
        return
      }
      setPosts(res.posts)
      toast.success(`تم توليد ${res.posts.length} منشور`)
    },
    onError: () => toast.error('تعذّر الاتصال بخدمة الذكاء'),
  })

  function toggle(p: SocialPlatform): void {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    )
  }

  function fullText(post: SocialPost): string {
    return `${post.caption}\n\n${post.cta}\n\n${post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}`
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 pt-24 md:p-8 md:pt-24" dir="rtl">
      <header className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">مساعد المحتوى الاجتماعي</h1>
          <p className="text-sm text-gray-500">
            منشورات عربية جاهزة مبنية على أصناف الصيدلية الحالية.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {SOCIAL_PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => toggle(p)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                platforms.includes(p)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 text-gray-600 hover:border-primary/40'
              }`}
            >
              {PLATFORM_LABEL[p]}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="الموضوع (اختياري): عرض فيتامينات، وصول أصناف جديدة…"
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary sm:col-span-2"
          />
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as typeof tone)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="friendly">ودّي</option>
            <option value="professional">احترافي</option>
            <option value="urgent">عرض عاجل</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => gen.mutate()}
          disabled={gen.isPending || platforms.length === 0}
          className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {gen.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          توليد المنشورات
        </button>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {posts.map((post, i) => (
          <article
            key={`${post.platform}-${i}`}
            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <h2 className="mb-2 text-sm font-semibold text-primary">
              {PLATFORM_LABEL[post.platform]}
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
              {post.caption}
            </p>
            <p className="mt-2 text-sm font-medium text-gray-900">{post.cta}</p>
            <p className="mt-2 text-xs text-primary/80">
              {post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(fullText(post))
                  toast.success('تم النسخ')
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-primary/40"
              >
                <Copy className="h-3.5 w-3.5" /> نسخ
              </button>
              <a
                href={SHARE_URL[post.platform](fullText(post))}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-primary/40"
              >
                <Share2 className="h-3.5 w-3.5" /> مشاركة
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
