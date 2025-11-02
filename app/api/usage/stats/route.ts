// app/api/usage/stats/route.ts
import { NextResponse } from 'next/server'
import { getUsageStats } from '@/lib/usage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const stats = await getUsageStats()
    return NextResponse.json(stats, { status: 200 })
  } catch (e: any) {
    return NextResponse.json(
      { total_extractions: 0, unique_emails: 0, error: e?.message || 'stats error' },
      { status: 200 }
    )
  }
}
