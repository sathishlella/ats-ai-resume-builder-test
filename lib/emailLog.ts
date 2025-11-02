// lib/emailLog.ts
import { list, put } from '@vercel/blob'
import 'server-only'

const CSV_PATH = 'emails/emails.csv' // one file, grows over time

export function extractEmails(text: string): string[] {
  const hits = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
    .map(e => e.toLowerCase())
    // basic junk filters
    .filter(e => !/^(no-?reply|do-?not-?reply)/.test(e) && !e.endsWith('@example.com'))
  return Array.from(new Set(hits))
}

function safe(val: any): string {
  if (val == null) return ''
  const s = String(val).replace(/[\r\n]+/g, ' ')
  // avoid commas breaking CSV columns
  return s.replace(/,/g, ' ')
}

async function readCsvIfExists(): Promise<string | null> {
  const { blobs } = await list({ prefix: CSV_PATH })
  const blob = blobs.find(b => b.pathname === CSV_PATH)
  if (!blob) return null
  const res = await fetch(blob.url)
  return await res.text()
}

export async function appendEmailRow(params: {
  email: string
  filename?: string
  filetype?: string
  bytes?: number
}) {
  const { email, filename = '', filetype = '', bytes = 0 } = params
  const stamp = new Date().toISOString()
  const row = `${stamp},${safe(email)},${safe(filename)},${safe(filetype)},${bytes}`
  const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN

  let csv = await readCsvIfExists()
  if (!csv) {
    csv = 'timestamp,email,filename,filetype,bytes\n'
  }
  if (!csv.endsWith('\n')) csv += '\n'
  csv += row + '\n'

  await put(CSV_PATH, csv, {
    access: 'public',
    contentType: 'text/csv',
    addRandomSuffix: false, // overwrite same path
  })
}

/** Helper you can call from the parse route */
export async function logResumeEmailsFromParse(args: {
  text: string
  filename?: string
  filetype?: string
  bytes?: number
}) {
  const emails = extractEmails(args.text)
  // log the first one (you can loop if you want all)
  const email = emails[0] || '(no-email-found)'
  await appendEmailRow({
    email,
    filename: args.filename,
    filetype: args.filetype,
    bytes: args.bytes ?? 0,
  })
  return { email, all: emails }
}
