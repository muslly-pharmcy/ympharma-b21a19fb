// PostgREST `or()` filter expressions are parsed as a comma/parenthesis
// separated grammar. Interpolating a raw user string lets the caller rewrite
// the whole expression (e.g. `x,id.gte.0` widens the result set), so every
// term embedded into a filter must be sanitised first.
//
// Pure + client-safe on purpose so it can be unit tested directly.

const DISALLOWED = /[,()."'\\:*%\u0000-\u001f]/g

/**
 * Strip every character with meaning in a PostgREST filter expression and
 * collapse whitespace. Returns '' when nothing searchable remains.
 */
export function sanitizeFilterTerm(input: string, maxLength = 80): string {
  return input
    .replace(DISALLOWED, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

/** Build a safe `ilike` contains pattern for a single column. */
export function ilikeContains(column: string, term: string): string {
  return `${column}.ilike.%${sanitizeFilterTerm(term)}%`
}
