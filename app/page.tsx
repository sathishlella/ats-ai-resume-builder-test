'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import StatsNumbers from '@/components/StatsNumbers'

const ThreeHero = dynamic(() => import('@/components/ThreeHero'), { ssr: false })
// Public CSV URL (env override if you prefer)
  const CSV_URL =
    process.env.NEXT_PUBLIC_STATS_CSV_URL ||
    'https://1xv5rpvgxmhfsd0c.public.blob.vercel-storage.com/emails/emails.csv'

export default function HomePage() {
  return (
    <div className="pt-16">
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-6">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-6xl font-extrabold leading-tight"
          >
            You’ve done the work. We make sure it gets noticed — with ATS{' '}
            <span className="gradient-text">AI</span>.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-lg text-brand-600"
          >
            Build ATS-friendly resumes and cover letters that rise through filters and
            reach real recruiters. <br />
            <span className="font-semibold">
              It's free. No logins. No spam. No nonsense. Just results.
            </span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.0 }}
            className="flex gap-3"
          >
            <Link
              href="/dashboard"
              className="px-5 py-3 rounded-2xl bg-brand-900 text-white hover:bg-brand-800 transition shadow"
            >
              Get Started
            </Link>
            <a
              href="https://sathishlella.github.io/Career-Canvas/"
              target="_blank"
              className="px-5 py-3 rounded-2xl border border-brand-200 hover:bg-brand-50 transition"
            >
              Need more help?
            </a>
            
          </motion.div>
          {/* Numbers-only live usage */}
          <StatsNumbers csvUrl={CSV_URL} />
        </div>

        {/* IMPORTANT: relative + fixed height + overflow-hidden */}
        <div className="relative h-[420px] rounded-3xl bg-brand-50 overflow-hidden">
          <ThreeHero />
        </div>
      </div>
    </div>
  )
}
