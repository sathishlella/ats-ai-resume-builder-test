// app/api/parse/route.ts
import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { logResumeEmailsFromParse } from '@/lib/emailLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

async function extractPdfWithPdfJs(bytes: Uint8Array): Promise<string> {
  // Lazy-load to keep edge bundling happy and ensure node runtime
  const pdfjs: any = await import('pdfjs-dist')
  const loadingTask = pdfjs.getDocument({ data: bytes })
  const doc = await loadingTask.promise

  let out = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false,
    })
    const text = content.items
      .map((it: any) => (typeof it?.str === 'string' ? it.str : ''))
      .join(' ')
    out += text + '\n'
  }
  return out.trim()
}

async function extractPdfWithPdfParse(bytes: Uint8Array): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default as any
  const res = await pdfParse(Buffer.from(bytes))
  return (res?.text || '').trim()
}

function emailsFromRawBytes(bytes: Uint8Array): string[] {
  // Sometimes emails are present in raw content even if text extraction fails
  const s = Buffer.from(bytes).toString('latin1')
  const hits = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
  // de-dup + lowercase
  return Array.from(new Set(hits.map((e) => e.toLowerCase())))
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File
    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const type = file.type || ''
    let text = ''

    if (type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) {
      // 1) Try pdfjs-dist
      try {
        text = await extractPdfWithPdfJs(bytes)
      } catch {
        // ignore and try fallback
      }
      // 2) Fallback to pdf-parse if needed
      if (text.trim().length < 10) {
        try {
          const t2 = await extractPdfWithPdfParse(bytes)
          if (t2.trim().length > 0) text = t2
        } catch {
          // ignore, try raw bytes email sniff
        }
      }
      // 3) Last chance: pull emails from raw bytes (helpful for some PDFs)
      if (text.trim().length < 10) {
        const rawEmails = emailsFromRawBytes(bytes)
        if (rawEmails.length > 0) {
          text = `Emails found: ${rawEmails.join(', ')}`
        }
      }
    } else if (
      type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name?.toLowerCase().endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
      text = (result.value || '').trim()
    } else {
      // Plain text or other - best effort
      text = Buffer.from(bytes).toString('utf-8').trim()
    }

    if (!text || text.trim().length === 0) {
      // Friendly message for truly image-only PDFs (no OCR)
      return NextResponse.json(
        {
          error:
            'No text extracted. This PDF may be a scanned image. Please upload a text-based PDF or DOCX file.',
        },
        { status: 422 }
      )
    }

    // Log email(s) to CSV
    const { email, all } = await logResumeEmailsFromParse({
      text,
      filename: file.name,
      filetype: type,
      bytes: bytes.byteLength,
    })

    return NextResponse.json({
      text,
      meta: { type, bytes: bytes.byteLength, email, emails: all },
    })
  } catch (err: any) {
    console.error('parse error:', err)
    return NextResponse.json({ error: err?.message || 'parse failed' }, { status: 500 })
  }
}
