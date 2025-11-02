import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { buildDocx } from '@/lib/templates'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { content, title } = await req.json()
    const buf = await buildDocx(content || '', title || 'Document')
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${(title || 'document').replace(/\s+/g, '-').toLowerCase()}.docx"`
      }
    })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message || 'DOCX export error' }, { status: 500 })
  }
}
