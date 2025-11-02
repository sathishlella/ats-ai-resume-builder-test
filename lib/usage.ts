// lib/usage.ts
import { list, put } from '@vercel/blob'
import { createHash } from 'crypto'

const CSV_PATH = 'logs/usage.csv'

function escCell(s: string) {
  return (s || '').replace(/[\r\n,]+/g, ' ').trim()
}

async function readCsv(): Promise<string> {
  try {
    // Find the blob by its key/path
    const { blobs } = await list({
      prefix: CSV_PATH,
      token: process.env.BLOB_READ_WRITE_TOKEN, // safe to include; read requires token if not public
    })
    const item =
      blobs.find(b => b.pathname === CSV_PATH) ||
      blobs[0]

    if (!item) return '' // file not created yet

    // If you saved with access:'public', a plain fetch works
    const r = await fetch(item.url, { cache: 'no-store' })
    if (!r.ok) return ''
    return await r.text()
  } catch {
    return ''
  }
}

export async function logUsage(opts: {
  email?: string
  source: 'upload' | 'paste' | 'score' | 'generate' | 'aggressive'
  resumeText?: string
  bytes?: number
  ip?: string
}) {
  const ts = new Date().toISOString()
  const sha16 = opts.resumeText
    ? createHash('sha256').update(opts.resumeText).digest('hex').slice(0, 16)
    : ''

  // read existing (may be empty)
  const existing = await readCsv()

  // ensure header exists exactly once
  let csv = existing || 'ts,source,email,bytes,sha16,ip\n'
  if (!csv.startsWith('ts,source,email,bytes,sha16,ip')) {
    csv = 'ts,source,email,bytes,sha16,ip\n' + csv
  }
  if (!csv.endsWith('\n')) csv += '\n'

  const row = [
    ts,
    escCell(opts.source),
    escCell((opts.email || '').toLowerCase()),
    String(opts.bytes ?? 0),
    escCell(sha16),
    escCell(opts.ip || ''),
  ].join(',')

  const next = csv + row + '\n'

  await put(CSV_PATH, next, {
    access: 'public',                // public so the stats API can fetch it easily
    contentType: 'text/csv',
    addRandomSuffix: false,          // overwrite same key/path
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
}

export async function getUsageStats() {
  const text = await readCsv()
  if (!text) return { total_extractions: 0, unique_emails: 0 }

  const lines = text.split(/\r?\n/).filter(Boolean)
  if (!lines.length) return { total_extractions: 0, unique_emails: 0 }

  const start = lines[0].startsWith('ts,') ? 1 : 0
  const rows = lines.slice(start)

  let total = rows.length
  const uniq = new Set<string>()

  for (const l of rows) {
    const cols = l.split(',')
    const email = (cols[2] || '').trim().toLowerCase()
    if (email) uniq.add(email)
  }

  return { total_extractions: total, unique_emails: uniq.size }
}
