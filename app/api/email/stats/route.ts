// app/api/email/stats/route.ts
import { list } from '@vercel/blob'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'     // <-- don't prerender at build
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET() {
  try {
    const { blobs } = await list({ prefix: 'emails/emails.csv' })
    const blob = blobs.find(b => b.pathname === 'emails/emails.csv')
    if (!blob) return NextResponse.json({ totalExtractions: 0, uniqueEmails: 0 })

    const csv = await (await fetch(blob.url)).text()
    const lines = csv.trim().split('\n')
    if (lines.length <= 1) return NextResponse.json({ totalExtractions: 0, uniqueEmails: 0 })

    const rows = lines.slice(1) // skip header
    const total = rows.length
    const uniq = new Set(
      rows.map(r => (r.split(',')[1] || '').trim()).filter(Boolean)
    ).size

    return NextResponse.json({ totalExtractions: total, uniqueEmails: uniq }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e: any) {
    // Return zeros instead of failing build
    return NextResponse.json({ totalExtractions: 0, uniqueEmails: 0, note: e?.message }, { status: 200 })
  }
}
