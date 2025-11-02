'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import MatchScoreCard from '@/components/MatchScoreCard'
import UploadDropzone from '@/components/UploadDropzone'
import Editor from '@/components/Editor'
import TemplatePicker from '@/components/TemplatePicker'
import KeywordHints from '@/components/KeywordHints'

export default function DashboardPage() {
  const [resumeText, setResumeText] = useState('')
  const [jdText, setJdText] = useState('')
  const [matchScore, setMatchScore] = useState<number | null>(null)

  const [generatedResume, setGeneratedResume] = useState('')
  const [generatedCover, setGeneratedCover] = useState('')
  const [loadingGen, setLoadingGen] = useState(false)
  const [loadingAgg, setLoadingAgg] = useState(false) // <-- NEW

  // keyword insight state
  const [missingRequired, setMissingRequired] = useState<string[]>([])
  const [missingPreferred, setMissingPreferred] = useState<string[]>([])
  const [presentRequired, setPresentRequired] = useState<string[]>([])
  const [presentPreferred, setPresentPreferred] = useState<string[]>([])

  // simple tab for AI workspace
  const [tab, setTab] = useState<'resume' | 'cover'>('resume')

  async function score() {
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, jdText }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `Score failed (${res.status})`)

      setMatchScore(data.score ?? 0)
      setMissingRequired(data.missingRequired ?? [])
      setMissingPreferred(data.missingPreferred ?? [])
      setPresentRequired(data.presentRequired ?? [])
      setPresentPreferred(data.presentPreferred ?? [])
    } catch (e: any) {
      alert(e?.message || 'Failed to compute score')
    }
  }

  async function generate(type: 'resume' | 'cover') {
    try {
      setLoadingGen(true)
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, jdText, type }),
      })
      const data = await res.json().catch(() => ({}))
      setLoadingGen(false)
      if (!res.ok) throw new Error(data?.error || `Generate failed (${res.status})`)

      if (type === 'resume') setGeneratedResume(data.text)
      else setGeneratedCover(data.text)
    } catch (e: any) {
      setLoadingGen(false)
      alert(e?.message || 'Failed to generate content.')
    }
  }

  // ---- NEW: Aggressive match generator (resume only) ----
  async function generateAggressive() {
    try {
      setLoadingAgg(true)
      const res = await fetch('/api/generate/aggressive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText, jdText, type: 'resume' }),
      })
      const data = await res.json().catch(() => ({}))
      setLoadingAgg(false)
      if (!res.ok) throw new Error(data?.error || `Aggressive generate failed (${res.status})`)
      setGeneratedResume(data.text)
      setTab('resume') // show what we just generated
    } catch (e: any) {
      setLoadingAgg(false)
      alert(e?.message || 'Aggressive generation failed.')
    }
  }

  async function exportDocx(type: 'resume' | 'cover') {
    const body = JSON.stringify({
      content: type === 'resume' ? (generatedResume || resumeText) : generatedCover,
    })
    const res = await fetch('/api/export/docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      alert(e?.error || `DOCX export failed (${res.status})`)
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = type === 'resume' ? 'resume.docx' : 'cover-letter.docx'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportPdf(type: 'resume' | 'cover') {
    const body = JSON.stringify({
      content: type === 'resume' ? (generatedResume || resumeText) : generatedCover,
    })
    const res = await fetch('/api/export/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      alert(e?.error || `PDF export failed (${res.status})`)
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = type === 'resume' ? 'resume.pdf' : 'cover-letter.pdf'
    a.click()
    URL.revokeObjectURL(url)
  }

  const disableActions = !jdText.trim() // basic guard

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 space-y-8">
      <div className="flex items-end justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>

      {/* ===== Top grid: Inputs + Insights ===== */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* LEFT: Resume inputs */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Upload Resume</h2>
            <UploadDropzone onParsed={setResumeText} />
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <Editor
              label="Or paste your resume text"
              value={resumeText}
              onChange={setResumeText}
            />
          </div>
        </div>

        {/* RIGHT: JD + Score/Insights (sticky) */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-20 self-start">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <Editor
              label="Paste Job Description"
              value={jdText}
              onChange={setJdText}
            />
          </div>

          <MatchScoreCard score={matchScore} onScore={score} />

          <KeywordHints
            missingRequired={missingRequired}
            missingPreferred={missingPreferred}
            presentRequired={presentRequired}
            presentPreferred={presentPreferred}
          />
        </div>
      </div>

      {/* ===== AI Workspace (tabs) ===== */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-xl border bg-gray-50 p-1">
            <button
              onClick={() => setTab('resume')}
              className={`px-3 py-1.5 text-sm rounded-lg ${tab === 'resume' ? 'bg-white shadow-sm font-medium' : 'text-gray-600'}`}
              aria-pressed={tab === 'resume'}
            >
              AI Resume
            </button>
            <button
              onClick={() => setTab('cover')}
              className={`px-3 py-1.5 text-sm rounded-lg ${tab === 'cover' ? 'bg-white shadow-sm font-medium' : 'text-gray-600'}`}
              aria-pressed={tab === 'cover'}
            >
              AI Cover Letter
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {/* Economy generate uses existing route */}
            <button
              onClick={() => generate(tab)}
              disabled={disableActions}
              className={`px-3 py-2 rounded-xl text-white ${disableActions ? 'bg-gray-300 cursor-not-allowed' : 'bg-brand-900 hover:bg-brand-800'}`}
              title={disableActions ? 'Paste a Job Description to enable' : ''}
            >
              {loadingGen ? 'Generating…' : 'Generate'}
            </button>

            {/* NEW: Aggressive match (visible on Resume tab only) */}
            {tab === 'resume' && (
              <button
                onClick={generateAggressive}
                disabled={disableActions}
                className={`px-3 py-2 rounded-xl text-white ${disableActions ? 'bg-gray-300 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-500'}`}
                title={disableActions ? 'Paste a Job Description to enable' : 'Injects JD keywords more aggressively'}
              >
                {loadingAgg ? 'Aggressive match…' : 'Aggressive match'}
              </button>
            )}

            <button onClick={() => exportDocx(tab)} className="px-3 py-2 rounded-xl border">
              DOCX
            </button>
            <button onClick={() => exportPdf(tab)} className="px-3 py-2 rounded-xl border">
              PDF
            </button>
          </div>
        </div>

        <div className="mt-4 w-full h-96 p-3 rounded-xl border overflow-y-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {tab === 'resume' ? generatedResume : generatedCover}
          </ReactMarkdown>
        </div>
      </div>

      {/* Templates */}
      <TemplatePicker />
    </div>
  )
}
