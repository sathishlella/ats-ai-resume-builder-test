// components/UploadDropzone.tsx
'use client'

import { useRef, useState } from 'react'

export default function UploadDropzone({ onParsed }: { onParsed: (text: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  async function onFile(file: File) {
    try {
      setLoading(true)
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/parse', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      setLoading(false)

      if (!res.ok) throw new Error(data?.error || `Parse failed (${res.status})`)
      if (!data?.text) throw new Error('No text extracted. Please try a different file.')
      onParsed(data.text)
    } catch (e: any) {
      setLoading(false)
      alert(e?.message || 'Failed to parse file.')
    }
  }

  return (
    <div
      className="border-2 border-dashed rounded-2xl p-6 text-center hover:bg-brand-50 cursor-pointer"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault() }}
      onDrop={(e) => {
        e.preventDefault()
        const f = e.dataTransfer.files?.[0]
        if (f) onFile(f)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      <div className="text-sm text-brand-600">
        {loading ? 'Parsing… (up to ~20s for PDFs)' : 'Drag & drop your resume (PDF/DOCX), or click to select'}
      </div>
    </div>
  )
}

