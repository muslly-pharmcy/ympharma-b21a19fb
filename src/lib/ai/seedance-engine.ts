export interface SeedanceCharacter {
  name: string
  role: string
  visualStyle: string
}

export interface SeedanceShot {
  shotType: string
  cameraMovement: string
  lighting: string
  durationSeconds: number
}

export interface DramaScriptInput {
  title: string
  genre: string
  logline: string
  characters: SeedanceCharacter[]
  sceneDescription: string
  shots: SeedanceShot[]
  aspectRatio: string
  renderStyle: string
  lockContinuity: boolean
  frameRate?: string
}

export interface SeedancePromptOutput {
  stage: string
  frameLockHash: string
  /** The full studio document (headers + specs + generation command). */
  formattedSeedancePrompt: string
  /** Just the text passed to the video model. */
  videoPrompt: string
}

export const SHOT_TYPES = [
  'Low Angle Cinematic',
  'Wide Establishing',
  'Medium Close-Up',
  'Extreme Close-Up',
  'Over The Shoulder',
  'Dutch Angle',
  'Top Down',
] as const

export const CAMERA_MOVES = [
  'Push In',
  'Pull Out',
  'Slow Pan',
  'Tracking Shot',
  'Handheld Follow',
  'Crane Up',
  'Static Lock',
] as const

export const LIGHTING_SETUPS = [
  'Cinematic Rim Light',
  'Soft Key Light',
  'High Contrast Noir',
  'Golden Hour',
  'Cold Fluorescent Office',
  'Practical Neon',
] as const

export const DURATIONS = [4, 6, 8] as const

function frameLock(seed: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x1000193
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0
  }
  return `FL-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`.toUpperCase()
}

function buildVideoPrompt(input: DramaScriptInput): string {
  const shot = input.shots[0]
  const cast = input.characters
    .filter((c) => c.name.trim())
    .map((c) => `${c.name} (${c.role || 'Hero'}) — ${c.visualStyle || 'Cinematic Style'}`)
    .join('; ')

  const parts = [
    `Cinematic short drama scene (${input.genre}): ${input.sceneDescription}.`,
    input.logline ? `Story beat: ${input.logline}.` : '',
    cast ? `Characters: ${cast}.` : '',
    shot
      ? `Camera: ${shot.shotType}, ${shot.cameraMovement}, lighting ${shot.lighting}.`
      : '',
    `${input.renderStyle}.`,
    input.lockContinuity
      ? 'Maintain strict facial identity and clothing consistency across frames.'
      : '',
    'High tension, crisp focus, cinematic color grading, Seedance AI optimized.',
  ]

  return parts.filter(Boolean).join(' ')
}

export const SeedanceEngine = {
  buildVideoPrompt,

  generateCinematicPrompt(input: DramaScriptInput): SeedancePromptOutput {
    const characters = input.characters.filter((c) => c.name.trim())
    const frameRate = input.frameRate ?? '60fps'
    const videoPrompt = buildVideoPrompt(input)

    const characterLines = characters.length
      ? characters.map(
          (c) => `- ${c.name} (${c.role || 'Hero'}): ${c.visualStyle || 'Cinematic Style'}`,
        )
      : ['- Single unnamed protagonist: photoreal cinematic styling']

    const shotLines = input.shots.map(
      (s, i) =>
        `[Shot ${i + 1}] - Type: ${s.shotType} | Cam: ${s.cameraMovement} | Light: ${s.lighting} | Duration: ${s.durationSeconds}s`,
    )

    const doc = [
      '[SEEDANCE DRAMA STUDIO V2.0 - CINEMATIC ENGINE]',
      '',
      '[MODE: FINAL VERSION LOCK]',
      '',
      '=== PRE-PRODUCTION & SCENE SPECS ===',
      '',
      `TITLE: ${input.title}`,
      '',
      `GENRE: ${input.genre}`,
      '',
      `LOGLINE: ${input.logline}`,
      '',
      '=== CHARACTER CONTINUITY MATRIX ===',
      '',
      ...characterLines,
      '',
      '=== SCENE DIRECTING & CAMERA WORK ===',
      '',
      ...shotLines,
      '',
      '=== VISUAL & LIGHTING INSTRUCTIONS ===',
      '',
      `- Aspect Ratio: ${input.aspectRatio}`,
      '',
      `- Render Style: ${input.renderStyle}`,
      '',
      input.lockContinuity
        ? '- Continuity Enforcement: Maintain strict facial identity and clothing consistency across frames.'
        : '- Continuity Enforcement: Disabled.',
      '',
      '=== SEEDANCE GENERATION PROMPT ===',
      '',
      `/generate_video --prompt "${videoPrompt}" --aspect_ratio ${input.aspectRatio} --framerate ${frameRate} --lock_continuity ${input.lockContinuity}`,
    ].join('\n')

    return {
      stage: 'FRAME_LOCKED_V2',
      frameLockHash: frameLock(
        `${input.title}|${input.genre}|${input.sceneDescription}|${characterLines.join('|')}|${shotLines.join('|')}|${input.aspectRatio}`,
      ),
      formattedSeedancePrompt: doc,
      videoPrompt,
    }
  },
}
