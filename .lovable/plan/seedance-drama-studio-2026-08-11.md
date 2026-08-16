# Seedance Drama Studio

The code you pasted lost all its JSX markup on the way into chat (the inputs, labels and layout tags were stripped), and it imports `@/lib/ai/seedance-engine`, which does not exist in the project yet. So it can't be pasted in as-is — I'll rebuild it faithfully from the intent.

## What gets built

1. **Prompt engine** — `src/lib/ai/seedance-engine.ts`
   - Types `DramaScriptInput` (title, genre, logline, characters[], sceneDescription, shots[]) and `SeedancePromptOutput` (stage, frameLockHash, formattedSeedancePrompt).
   - `SeedanceEngine.generateCinematicPrompt(input)` — pure client-side function that composes a structured English cinematic prompt from scene, character and shot data (shot type, camera movement, lighting, aspect ratio, duration), plus a deterministic `frameLockHash` for continuity between shots.

2. **Studio UI** — `src/components/ai/SeedanceStudio.tsx`
   - RTL Arabic form: scene title, genre, logline, main-character fields (name / role / visual style), scene description textarea.
   - Generate button, validation alert when title or description is empty.
   - Result panel showing status + frame-lock hash, the final LTR prompt in a monospace block, and a copy button.
   - Dark slate/amber cinematic styling as in your snippet, using theme tokens where they exist.

3. **Route** — `src/routes/seedance-studio.tsx` so the studio is reachable in the app, with its own head metadata.

## Technical notes

- Engine is pure TypeScript with no model call — nothing goes through the AI gateway, no credits used, no backend changes.
- No database, RLS, or server-function changes.
- If you'd later like the prompt sent straight to a video model, that's a separate step.
