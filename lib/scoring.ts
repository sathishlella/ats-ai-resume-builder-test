/**
 * Simple TF-IDF cosine similarity + optional Embedding similarity (if configured).
 */

function tokenize(text: string): string[] {
  return (text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean))
}

function termFreq(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = {}
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1
  const total = tokens.length || 1
  for (const k in tf) tf[k] = tf[k] / total
  return tf
}

function idf(corpus: string[][]): Record<string, number> {
  const df: Record<string, number> = {}
  const N = corpus.length
  for (const doc of corpus) {
    const seen = new Set(doc)
    for (const t of seen) df[t] = (df[t] || 0) + 1
  }
  const idf: Record<string, number> = {}
  for (const t in df) {
    idf[t] = Math.log((N + 1) / (df[t] + 1)) + 1
  }
  return idf
}

function dot(a: Record<string, number>, b: Record<string, number>): number {
  let s = 0
  const keys = Object.keys(Object.keys(a).length < Object.keys(b).length ? a : b)
  for (const k of keys) if (a[k] && b[k]) s += a[k] * b[k]
  return s
}

function norm(a: Record<string, number>): number {
  let s = 0
  for (const k in a) s += a[k] * a[k]
  return Math.sqrt(s)
}

export function tfidfScore(a: string, b: string): number {
  const ta = tokenize(a)
  const tb = tokenize(b)
  const idfMap = idf([ta, tb])
  const tfa = termFreq(ta)
  const tfb = termFreq(tb)

  const va: Record<string, number> = {}
  const vb: Record<string, number> = {}
  for (const t in tfa) va[t] = tfa[t] * (idfMap[t] || 0)
  for (const t in tfb) vb[t] = tfb[t] * (idfMap[t] || 0)

  const sim = dot(va, vb) / ((norm(va) * norm(vb)) || 1)
  // Clamp 0..1
  return Math.max(0, Math.min(1, sim))
}

// Optional embedding similarity if user configures an embeddings endpoint
export async function embedSimilarity(a: string, b: string): Promise<number> {
  const base = process.env.EMBEDDINGS_BASE_URL
  const key = process.env.EMBEDDINGS_API_KEY
  const model = process.env.EMBEDDINGS_MODEL

  if (!base || !key || !model) throw new Error('Embeddings not configured')

  async function embed(text: string): Promise<number[]> {
    const res = await fetch(`${base}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model, input: text })
    })
    if (!res.ok) throw new Error('Embeddings error')
    const data = await res.json()
    const vec = data.data?.[0]?.embedding as number[]
    if (!vec) throw new Error('No embedding returned')
    return vec
  }

  const [ea, eb] = await Promise.all([embed(a), embed(b)])

  let s = 0, na = 0, nb = 0
  for (let i = 0; i < ea.length; i++) {
    const x = ea[i], y = eb[i]
    s += x * y
    na += x * x
    nb += y * y
  }
  const sim = s / ((Math.sqrt(na) * Math.sqrt(nb)) || 1)
  // map from [-1,1] => [0,1]
  return (sim + 1) / 2
}
