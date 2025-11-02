import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Navbar from '@/components/Navbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ATS AI Resume Builder',
  description: 'AI-generated, ATS-friendly resumes & cover letters, with match scoring and premium UI.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 pb-16">{children}</main>
      </body>
    </html>
  )
}
