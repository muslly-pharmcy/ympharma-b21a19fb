import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  SeedanceEngine,
  SHOT_TYPES,
  CAMERA_MOVES,
  LIGHTING_SETUPS,
  DURATIONS,
  type DramaScriptInput,
  type SeedanceCharacter,
  type SeedanceShot,
  type SeedancePromptOutput,
} from '@/lib/ai/seedance-engine'
import { startSeedanceVideo, pollSeedanceVideo } from '@/lib/seedance.functions'

const fieldClass =
  'w-full p-2.5 rounded bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500'
const smallField =
  'p-2 rounded bg-slate-800 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500'

const emptyCharacter = (): SeedanceCharacter => ({ name: '', role: '', visualStyle: '' })
const defaultShot = (): SeedanceShot => ({
  shotType: 'Low Angle Cinematic',
  cameraMovement: 'Push In',
  lighting: 'Cinematic Rim Light',
  durationSeconds: 8,
})

type VideoState =
  | { phase: 'idle' }
  | { phase: 'running'; jobId: string; progress: number }
  | { phase: 'done'; url: string }
  | { phase: 'error'; message: string }

export const SeedanceStudio: React.FC = () => {
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('Business Drama')
  const [logline, setLogline] = useState('')
  const [sceneDescription, setSceneDescription] = useState('')
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16')
  const [renderStyle, setRenderStyle] = useState(
    'Photorealistic 8K, Masterpiece Cinematic Lighting, Hyper-detailed textures, Motion Blur Natural',
  )
  const [lockContinuity, setLockContinuity] = useState(true)
  const [characters, setCharacters] = useState<SeedanceCharacter[]>([emptyCharacter()])
  const [shots, setShots] = useState<SeedanceShot[]>([defaultShot()])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [output, setOutput] = useState<SeedancePromptOutput | null>(null)
  const [video, setVideo] = useState<VideoState>({ phase: 'idle' })
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current)
  }, [])

  const buildInput = (): DramaScriptInput => ({
    title,
    genre,
    logline: logline || 'مشهد درامي سينمائي عالي الدقة',
    characters,
    sceneDescription,
    shots,
    aspectRatio,
    renderStyle,
    lockContinuity,
  })

  const handleGenerate = () => {
    if (!title.trim() || !sceneDescription.trim()) {
      setError('يرجى كتابة عنوان المشهد والوصف على الأقل.')
      return
    }
    setError('')
    setOutput(SeedanceEngine.generateCinematicPrompt(buildInput()))
    setCopied(false)
  }

  const poll = useCallback((jobId: string) => {
    pollTimer.current = setTimeout(async () => {
      try {
        const res = await pollSeedanceVideo({ data: { jobId } })
        if (res.status === 'completed' && res.url) {
          setVideo({ phase: 'done', url: res.url })
        } else if (res.status === 'failed') {
          setVideo({ phase: 'error', message: res.error ?? 'فشل التوليد.' })
        } else {
          setVideo({ phase: 'running', jobId, progress: (res as { progress?: number }).progress ?? 0 })
          poll(jobId)
        }
      } catch (e) {
        setVideo({ phase: 'error', message: e instanceof Error ? e.message : 'خطأ غير متوقع.' })
      }
    }, 8000)
  }, [])

  const handleGenerateVideo = async () => {
    if (!title.trim() || !sceneDescription.trim()) {
      setError('يرجى كتابة عنوان المشهد والوصف قبل توليد الفيديو.')
      return
    }
    setError('')
    const input = buildInput()
    const built = SeedanceEngine.generateCinematicPrompt(input)
    setOutput(built)
    setVideo({ phase: 'running', jobId: '', progress: 0 })

    try {
      const { jobId } = await startSeedanceVideo({
        data: {
          prompt: built.videoPrompt,
          aspectRatio,
          seconds: (shots[0]?.durationSeconds ?? 8) as 4 | 6 | 8,
        },
      })
      setVideo({ phase: 'running', jobId, progress: 0 })
      poll(jobId)
    } catch (e) {
      setVideo({ phase: 'error', message: e instanceof Error ? e.message : 'تعذّر بدء التوليد.' })
    }
  }

  const updateShot = (index: number, patch: Partial<SeedanceShot>) =>
    setShots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  const updateCharacter = (index: number, patch: Partial<SeedanceCharacter>) =>
    setCharacters((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))

  return (
    <div
      dir="rtl"
      className="max-w-3xl mx-auto p-5 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100"
    >
      <h1 className="text-2xl font-bold text-amber-400">🎬 SEEDANCE DRAMA STUDIO V2.0</h1>
      <p className="text-sm text-slate-400 mt-1 mb-6">
        محرك توليد الأوامر السينمائية المتقدمة — مع توليد فيديو حقيقي
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1">عنوان المشهد</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: وصول الرئيس التنفيذي"
            className={fieldClass}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">نوع الدراما</label>
            <input value={genre} onChange={(e) => setGenre(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">الملخص السريع</label>
            <input
              value={logline}
              onChange={(e) => setLogline(e.target.value)}
              placeholder="مثال: مواجهة حاسمة في اجتماع الشركة"
              className={fieldClass}
            />
          </div>
        </div>

        {/* Characters */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-200">مصفوفة استمرارية الشخصيات</h2>
            <button
              type="button"
              onClick={() => setCharacters((p) => [...p, emptyCharacter()])}
              className="text-xs px-2 py-1 rounded bg-slate-800 border border-slate-600 text-amber-400"
            >
              + شخصية
            </button>
          </div>
          <div className="space-y-2">
            {characters.map((c, i) => (
              <div key={i} className="grid md:grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <input
                  value={c.name}
                  onChange={(e) => updateCharacter(i, { name: e.target.value })}
                  placeholder="الاسم"
                  className={smallField}
                />
                <input
                  value={c.role}
                  onChange={(e) => updateCharacter(i, { role: e.target.value })}
                  placeholder="الدور"
                  className={smallField}
                />
                <input
                  value={c.visualStyle}
                  onChange={(e) => updateCharacter(i, { visualStyle: e.target.value })}
                  placeholder="الأسلوب البصري"
                  className={smallField}
                />
                <button
                  type="button"
                  onClick={() => setCharacters((p) => p.filter((_, x) => x !== i))}
                  disabled={characters.length === 1}
                  className="text-xs px-2 rounded border border-slate-700 text-rose-400 disabled:opacity-30"
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Shots */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-200">اللقطات وحركة الكاميرا</h2>
            <button
              type="button"
              onClick={() => setShots((p) => [...p, defaultShot()])}
              className="text-xs px-2 py-1 rounded bg-slate-800 border border-slate-600 text-amber-400"
            >
              + لقطة
            </button>
          </div>
          <div className="space-y-3">
            {shots.map((s, i) => (
              <div key={i} className="rounded border border-slate-800 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-amber-400">Shot {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => setShots((p) => p.filter((_, x) => x !== i))}
                    disabled={shots.length === 1}
                    className="text-xs text-rose-400 disabled:opacity-30"
                  >
                    حذف
                  </button>
                </div>
                <div className="grid md:grid-cols-4 gap-2">
                  <select
                    value={s.shotType}
                    onChange={(e) => updateShot(i, { shotType: e.target.value })}
                    className={smallField}
                  >
                    {SHOT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    value={s.cameraMovement}
                    onChange={(e) => updateShot(i, { cameraMovement: e.target.value })}
                    className={smallField}
                  >
                    {CAMERA_MOVES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    value={s.lighting}
                    onChange={(e) => updateShot(i, { lighting: e.target.value })}
                    className={smallField}
                  >
                    {LIGHTING_SETUPS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    value={s.durationSeconds}
                    onChange={(e) => updateShot(i, { durationSeconds: Number(e.target.value) })}
                    className={smallField}
                  >
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}s
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Visual settings */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">نسبة العرض</label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as '9:16' | '16:9')}
              className={fieldClass}
            >
              <option value="9:16">9:16 (عمودي)</option>
              <option value="16:9">16:9 (أفقي)</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-300 pb-2">
              <input
                type="checkbox"
                checked={lockContinuity}
                onChange={(e) => setLockContinuity(e.target.checked)}
                className="accent-amber-500 w-4 h-4"
              />
              قفل الاستمرارية بين اللقطات
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1">أسلوب الرندر</label>
          <input
            value={renderStyle}
            onChange={(e) => setRenderStyle(e.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1">
            وصف المشهد السينمائي
          </label>
          <textarea
            value={sceneDescription}
            onChange={(e) => setSceneDescription(e.target.value)}
            rows={5}
            placeholder="صف حركة الكاميرا، انفعال الشخصية، والإضاءة المطلوبة..."
            className={fieldClass}
          />
        </div>

        {error && (
          <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded p-2">
            {error}
          </p>
        )}

        <div className="grid md:grid-cols-2 gap-3">
          <button
            onClick={handleGenerate}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 font-bold text-slate-950 rounded-lg transition duration-200 shadow-lg"
          >
            ⚡ توليد الأمر السينمائي
          </button>
          <button
            onClick={handleGenerateVideo}
            disabled={video.phase === 'running'}
            className="w-full py-3 bg-slate-100 hover:bg-white disabled:opacity-50 font-bold text-slate-950 rounded-lg transition duration-200 shadow-lg"
          >
            {video.phase === 'running' ? '⏳ جارٍ التوليد…' : '🎥 توليد الفيديو'}
          </button>
        </div>
      </div>

      {video.phase === 'running' && (
        <div className="mt-6 p-4 rounded-lg border border-slate-700 bg-slate-950/60">
          <p className="text-sm text-slate-300">
            يتم الآن توليد المقطع… قد يستغرق من دقيقة إلى ثلاث دقائق. لا تغلق الصفحة.
          </p>
          <div className="mt-3 h-2 w-full bg-slate-800 rounded overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${Math.max(8, video.progress)}%` }}
            />
          </div>
        </div>
      )}

      {video.phase === 'error' && (
        <p className="mt-6 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded p-3">
          {video.message}
        </p>
      )}

      {video.phase === 'done' && (
        <div className="mt-6 p-4 rounded-lg border border-amber-500/30 bg-black/60">
          <video
            src={video.url}
            controls
            playsInline
            className="w-full rounded max-h-[70vh] bg-black"
          />
          <a
            href={video.url}
            download="seedance-scene.mp4"
            className="inline-block mt-3 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-amber-400 rounded border border-slate-600"
          >
            ⬇️ تحميل المقطع
          </a>
        </div>
      )}

      {output && (
        <div className="mt-8 p-4 bg-black/60 rounded-lg border border-amber-500/30">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-mono text-amber-400">STATUS: {output.stage} | LOCKED</span>
            <span className="text-xs font-mono text-slate-500">{output.frameLockHash}</span>
          </div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            الأمر النهائي الموجه لـ Seedance AI:
          </label>
          <pre
            dir="ltr"
            className="p-3 bg-slate-950 rounded text-green-400 text-xs font-mono whitespace-pre-wrap overflow-x-auto border border-slate-800 text-left"
          >
            {output.formattedSeedancePrompt}
          </pre>
          <button
            onClick={() => {
              navigator.clipboard.writeText(output.formattedSeedancePrompt)
              setCopied(true)
            }}
            className="mt-3 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-amber-400 rounded border border-slate-600 transition"
          >
            {copied ? '✅ تم النسخ' : '📋 نسخ الأمر'}
          </button>
        </div>
      )}
    </div>
  )
}

export default SeedanceStudio
