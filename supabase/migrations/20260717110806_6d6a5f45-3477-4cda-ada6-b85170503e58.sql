
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.ai_neural_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL,
  owner_id uuid NULL,
  memory_category text NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding extensions.vector(1536) NULL,
  importance numeric NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  model_version text NOT NULL DEFAULT 'openai/text-embedding-3-small',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_neural_memory TO authenticated;
GRANT ALL ON public.ai_neural_memory TO service_role;

ALTER TABLE public.ai_neural_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "neural_memory admin read"
  ON public.ai_neural_memory FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE INDEX IF NOT EXISTS idx_ai_neural_memory_owner
  ON public.ai_neural_memory (owner_type, owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_neural_memory_embedding
  ON public.ai_neural_memory
  USING hnsw (embedding extensions.vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_ai_neural_memory(
  query_embedding extensions.vector(1536),
  match_count int DEFAULT 10,
  filter_owner_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  owner_type text,
  owner_id uuid,
  memory_category text,
  content text,
  metadata jsonb,
  similarity float,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT
    m.id,
    m.owner_type,
    m.owner_id,
    m.memory_category,
    m.content,
    m.metadata,
    1 - (m.embedding <=> query_embedding) AS similarity,
    m.created_at
  FROM public.ai_neural_memory m
  WHERE m.embedding IS NOT NULL
    AND (filter_owner_type IS NULL OR m.owner_type = filter_owner_type)
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_ai_neural_memory(extensions.vector, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_ai_neural_memory(extensions.vector, int, text) TO authenticated, service_role;
