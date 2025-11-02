'use client'

import Link from 'next/link'

export default function Navbar() {
  return (
    <header className="border-b bg-white/70 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold">ATS<span className="gradient-text">AI</span></Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="https://ats-ai-resume-builder.vercel.app/" className="hover:underline">Dashboard</Link>
          <a href="https://sathishlella.github.io/Career-Canvas/" target="_blank" className="hover:underline">Career Canvas</a>
        </nav>
      </div>
    </header>
  )
}
