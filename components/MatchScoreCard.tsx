'use client'

type Props = {
  score: number | null
  onScore: () => void
}

export default function MatchScoreCard({ score, onScore }: Props) {
  // API already returns 0–100; don’t multiply again
  const display = Number.isFinite(score as number)
    ? Math.max(0, Math.min(100, Math.round(Number(score))))
    : 0

  return (
    <div className="rounded-2xl border p-4 bg-white">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">Match Score</h3>
        <button
          onClick={onScore}
          className="px-3 py-1.5 rounded-lg border text-sm"
        >
          calculate Score
        </button>
      </div>

      <div className="text-3xl font-bold mb-2">{display}%</div>

      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-600"
          style={{ width: `${display}%` }}
        />
      </div>
    </div>
  )
}
