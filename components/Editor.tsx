'use client'

export default function Editor({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-brand-700">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)}
                className="w-full h-56 p-3 rounded-2xl border" />
    </div>
  )
}
