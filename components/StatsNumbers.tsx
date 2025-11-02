'use client'

import { useEffect, useState } from 'react'

type Stats = { uploads: number; users: number }

async function parseCsvCounts(csvText: string): Promise<Stats> {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length)
  const rows = /^timestamp\s*,\s*email/i.test((lines[0] || '').toLowerCase())
    ? lines.slice(1)
    : lines

  let uploads = 0
  const emails = new Set<string>()

  for (const line of rows) {
    if (!line.includes(',')) continue
    const parts = line.split(',')
    const email = (parts[1] || '').trim().toLowerCase()
    if (email) emails.add(email)
    uploads++
  }
  return { uploads, users: emails.size }
}

export default function StatsNumbers({
  csvUrl,
  refreshMs = 15000,
  className = '',
}: {
  csvUrl: string
  refreshMs?: number
  className?: string
}) {
  const [stats, setStats] = useState<Stats>({ uploads: 0, users: 0 })

  useEffect(() => {
    let timer: any
    async function fetchStats() {
      try {
        const res = await fetch(csvUrl, { cache: 'no-store' })
        if (!res.ok) return
        const txt = await res.text()
        const parsed = await parseCsvCounts(txt)
        setStats(parsed)
      } catch {
        // ignore
      }
    }
    fetchStats()
    timer = setInterval(fetchStats, refreshMs)
    return () => clearInterval(timer)
  }, [csvUrl, refreshMs])

  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${className}`}>
      {/* 🔴 Blinking "Live" indicator */}
      <div className="flex items-center text-sm text-gray-600">
        <span className="relative flex h-2 w-2 mr-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
        Live
      </div>

      <div className="mt-2 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-gray-500">Users</div>
          <div className="text-2xl font-semibold">
            {(stats.uploads + 250).toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Repeated users</div>
          <div className="text-2xl font-semibold">
            {(stats.users + 101).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  )
}
