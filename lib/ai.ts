// lib/ai.ts
type GroqErr = { error?: { message?: string; code?: string; type?: string } }
type ChatOpts = {
  model?: string
  temperature?: number
  top_p?: number
  max_tokens?: number
  stop?: string[]
  timeout_ms?: number
}

export async function chatComplete(
  system: string,
  user: string,
  opts: ChatOpts = {}
): Promise<string> {
  // Expect AI_BASE_URL like:
  //   - https://api.openai.com/v1
  //   - https://api.groq.com/openai/v1
  const base = (process.env.AI_BASE_URL || '').replace(/\/+$/, '')
  const key = process.env.AI_API_KEY || ''
  const envModel = process.env.AI_MODEL || ''
  if (!base || !key) throw new Error('AI not configured')

  const endpoint = `${base}/chat/completions`

  const candidates = Array.from(
    new Set([
      opts.model || envModel,
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
    ])
  ).filter(Boolean) as string[]

  let lastErr: any = null

  for (const model of candidates) {
    try {
      const controller = new AbortController()
      const to = setTimeout(() => controller.abort(), opts.timeout_ms ?? 30000)

      const res = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          // Low by default to avoid meta “notes”; override per-call if needed
          temperature: opts.temperature ?? 0.2,
          top_p: opts.top_p ?? 1,
          max_tokens: opts.max_tokens ?? 2200,
          stop: opts.stop,
          stream: false,
        }),
      })
      clearTimeout(to)

      const raw = await res.text()

      if (!res.ok) {
        let recoverable = false
        try {
          const j: GroqErr = JSON.parse(raw)
          const code = j?.error?.code || ''
          const msg = (j?.error?.message || '').toLowerCase()
          if (
            code === 'model_decommissioned' ||
            msg.includes('decommissioned') ||
            msg.includes('model not found')
          ) {
            recoverable = true
          }
        } catch {
          /* noop */
        }
        if (recoverable) {
          lastErr = raw
          continue
        }
        throw new Error(`AI error ${res.status}: ${raw.slice(0, 300)}`)
      }

      const data = JSON.parse(raw)
      const text = data?.choices?.[0]?.message?.content?.trim() || ''
      if (!text) throw new Error('Empty AI response')
      return text
    } catch (e) {
      lastErr = e
      // try next candidate model
    }
  }

  throw new Error(`All models failed. Last error: ${String(lastErr).slice(0, 300)}`)
}
