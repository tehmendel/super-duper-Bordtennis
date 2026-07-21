// supabase.functions.invoke() only puts a generic "Edge Function returned a
// non-2xx status code" in error.message on failure — the actual Norwegian
// error text the function returned lives in the response body, reachable via
// error.context (a Response). This pulls that out when available, falling
// back to the generic message only if the body can't be read/parsed.
export async function resolveFunctionError(
  data: { error?: string } | null | undefined,
  error: unknown,
  fallback: string,
): Promise<string> {
  if (data?.error) return data.error
  if (error && typeof error === 'object' && 'context' in error) {
    try {
      const body = await (error as { context: Response }).context.json()
      if (body && typeof body.error === 'string') return body.error
    } catch {
      // response body wasn't JSON (or already consumed) — fall through
    }
  }
  return error instanceof Error ? error.message : fallback
}
