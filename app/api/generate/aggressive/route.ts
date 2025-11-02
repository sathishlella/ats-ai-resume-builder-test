// app/api/generate/aggressive/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { chatComplete } from '@/lib/ai'
import { logUsage } from '@/lib/usage'

export const runtime = 'nodejs'

type HeaderBits = { name: string; detailsLine: string; email?: string; phone?: string; linkedin?: string }

function extractHeader(src: string = ''): HeaderBits {
  const lines = src.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length) return { name: '', detailsLine: '' }
  const nameLine = lines.find(l => /^[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+)+$/.test(l)) || lines[0]
  const idx = Math.min(lines.indexOf(nameLine) + 1, lines.length - 1)
  const detailsLine =
    lines.slice(idx, idx + 4).find(l => /\b@|linkedin\.com|https?:\/\/|www\.|[+(\d][\d\s().-]{5,}|\|/.test(l)) || ''
  const email = src.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
  const phone = src.match(/(\+?\d[\d\s().-]{8,})/)?.[0]
  const linkedin = src.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s|]+/i)?.[0]
  return { name: (nameLine || '').trim(), detailsLine: (detailsLine || [linkedin, phone, email].filter(Boolean).join(' | ')).trim(), email, phone, linkedin }
}

const STOP = new Set([
  'the','and','or','for','with','of','to','in','on','by','at','as','is','are','be','an','a','this',
  'that','these','those','will','can','should','must','may','into','from','over','under','per','via',
  'you','we','our','they','their','within','across','etc','your','their','his','her','about','role',
  'position','description','responsibilities','requirements','preferred'
])

const KNOWN = [
  'Python','Java','JavaScript','TypeScript','C#','C++','Go',
  'SQL','NoSQL','PostgreSQL','MySQL','MongoDB','Redis',
  'AWS','Azure','GCP','Redshift','Snowflake','S3','EC2','Lambda','SageMaker',
  'Docker','Kubernetes','K8s','Terraform','Git','CI/CD','Jenkins','Airflow','Spark','PySpark',
  'Hadoop','Kafka','Tableau','Power BI','Qlik','QlikView','Looker',
  'Pandas','NumPy','scikit-learn','TensorFlow','PyTorch',
  'REST','GraphQL','gRPC','Microservices','Monolith',
  'Agile','Scrum','Kanban','Jira','Confluence',
  'ETL','ELT','Data Pipeline','Data Warehouse','Data Lake','Data Modeling',
  'Unit Testing','Integration Testing','E2E Testing','TDD','BDD',
  'Linux','Shell','Bash'
]

function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

function extractJDKeywords(jd: string): string[] {
  const base = (jd || '').replace(/\r/g, ' ')
  const hits = new Map<string, number>()
  for (const w of KNOWN) {
    const re = new RegExp(`\\b${esc(w)}\\b`, 'i')
    if (re.test(base)) hits.set(w, (hits.get(w) || 0) + 5)
  }
  const tokens = base.match(/\b[A-Za-z][A-Za-z0-9.+#/-]{1,}\b/g) || []
  for (const tRaw of tokens) {
    const t = tRaw.replace(/[,.)(:;]+$/,'').trim()
    if (!t) continue
    const lc = t.toLowerCase()
    if (STOP.has(lc)) continue
    if (lc.length < 2) continue
    if (/^\d{1,2}(\+|yrs?|years?)$/i.test(t)) continue
    const score = (hits.get(t) || 0) + (/[A-Z]{2,}/.test(t) ? 2 : 1)
    hits.set(t, score)
  }
  const uniq: string[] = []
  for (const [k] of [...hits.entries()].sort((a,b)=>b[1]-a[1])) {
    if (uniq.some(u => u.toLowerCase() === k.toLowerCase())) continue
    uniq.push(k)
    if (uniq.length >= 40) break
  }
  return uniq
}

function uniqueCI(arr: string[]) {
  const out: string[] = []
  for (const x of arr) if (!out.some(y => y.toLowerCase() === x.toLowerCase())) out.push(x)
  return out
}

function stripMetaBlocks(md: string) {
  let out = md ?? ''
  out = out.replace(/^\s{0,3}(?:>?\s*)?(?:note|notes?|disclaimer|assumptions?|remarks?)\s*:\s[\s\S]*?(?:\n{2,}|$)/gim, '\n')
  out = out.replace(/^\s{0,3}#{1,6}\s*(?:notes?|disclaimers?|assumptions?)\s*\n[\s\S]*?(?=\n#{1,6}\s|\n{2,}|$)/gim, '\n')
  return out.replace(/\n{3,}/g, '\n\n').trim()
}

function injectHeader(md: string, headerBlock: string) {
  let s = (md || '').trimStart()
  if (s.startsWith(headerBlock.trim())) return s
  const cutIdx = s.search(/\n##\s|\n###\s|\n{2,}/)
  const rest = cutIdx > -1 ? s.slice(cutIdx).replace(/^\n+/, '') : s
  return `${headerBlock}\n\n${rest}`.trim()
}

function normalizeSections(md: string) {
  return md.replace(/(^|\n)###\s/g, '$1## ')
}

function ensureKeySkills(md: string, mustWeave: string[], jdOnly: string[]): string {
  const skillsLine = uniqueCI([...mustWeave, ...jdOnly.map(s => `${s} (familiar)`)])
  if (!skillsLine.length) return md
  const secRe = /(##\s*Key Skills[^\n]*\n)([\s\S]*?)(?=\n##\s|\n*$)/
  const m = md.match(secRe)
  const block = `\n\n## Key Skills\n${skillsLine.join(', ')}\n`
  if (m) {
    const head = md.slice(0, m.index!)
    const body = m[0]
    const tail = md.slice((m.index ?? 0) + m[0].length)
    const lines = body.split('\n')
    let contentIdx = 1
    while (contentIdx < lines.length && !lines[contentIdx].trim()) contentIdx++
    const existing = contentIdx < lines.length ? lines[contentIdx].replace(/^\s*[-*•]\s*/, '') : ''
    const merged = uniqueCI([...existing.split(/\s*,\s*/).filter(Boolean), ...skillsLine])
    lines[contentIdx] = merged.join(', ')
    return head + lines.join('\n') + tail
  }
  const sumRe = /(##\s*Summary[^\n]*\n)([\s\S]*?)(?=\n##\s|\n*$)/
  const sm = md.match(sumRe)
  if (sm) {
    const insertAt = (sm.index ?? 0) + sm[0].length
    return md.slice(0, insertAt) + block + md.slice(insertAt)
  }
  const h1re = /^(#\s.*?)(?:\n{1,}|$)/
  const h1m = md.match(h1re)
  if (h1m) {
    const insertAt = (h1m.index ?? 0) + h1m[0].length
    return md.slice(0, insertAt) + block + md.slice(insertAt)
  }
  return block + '\n' + md
}

function ensurePracticeProjects(md: string, jdOnly: string[]): string {
  if (!jdOnly.length) return md
  if (/(##\s*Projects[^\n]*\n)/i.test(md)) return md
  const snippet =
`\n\n## Projects
- **Practice / Self-Directed – JD Alignment Sandbox (ongoing)**  
  Exploring ${jdOnly.slice(0, 8).join(', ')} through small demos and learning exercises; building prototypes to understand real-world usage and trade-offs.\n`
  const expRe = /(##\s*Professional Experience[^\n]*\n)([\s\S]*?)(?=\n##\s|\n*$)/
  const edRe  = /(##\s*Education[^\n]*\n)([\s\S]*?)(?=\n##\s|\n*$)/
  const em = md.match(expRe)
  if (em) return md.slice(0, (em.index ?? 0) + em[0].length) + snippet + md.slice((em.index ?? 0) + em[0].length)
  const ed = md.match(edRe)
  if (ed) return md.slice(0, (ed.index ?? 0) + ed[0].length) + snippet + md.slice((ed.index ?? 0) + ed[0].length)
  return md + snippet
}

function ensureSummaryKeywords(md: string, top: string[]): string {
  if (!top.length) return md
  const secRe = /(##\s*Summary[^\n]*\n)([\s\S]*?)(?=\n##\s|\n*$)/
  const m = md.match(secRe)
  if (!m) return md
  const block = m[0], head = md.slice(0, m.index!), tail = md.slice((m.index ?? 0) + m[0].length)
  const present = top.every(k => new RegExp(`\\b${esc(k)}\\b`, 'i').test(block))
  if (present) return md
  const add = `\n*Focus areas:* ${top.slice(0, 10).join(', ')}`
  return head + (block.endsWith('\n') ? block + add : block + '\n' + add) + tail
}

const SYSTEM = `You are ResumeGen. Return ONLY the resume or cover letter in clean Markdown.
- No meta notes/disclaimers/placeholders.
- Keep headings "## <Section>".
- Use JD language verbatim where truthful.
- Never invent employers, dates, or degrees.`

function resumeUser(resume: string, jd: string, headerBlock: string, mustWeave: string[], jdOnly: string[], lowOverlap: boolean) {
  const weave = mustWeave.length ? `\n\nMUST WEAVE (Summary/Experience): ${mustWeave.join(', ')}` : ''
  const ksOnly = jdOnly.length ? `\nInclude these ONLY in Key Skills or Practice/Self-Directed Projects (do NOT claim them under past employers): ${jdOnly.join(', ')}` : ''
  const pivotHint = lowOverlap ? `\nLOW OVERLAP: Add a "Projects" section with a Practice/Self-Directed entry that explores JD technologies (no employers or dates).` : ''
  return `Use the following header block AS-IS at the very top (do not reformat it):

${headerBlock}

Then write an ATS-friendly resume in Markdown with these sections:

## Summary
2–4 lines weaving MUST-WEAVE terms where truthful; if overlap is low, mention active upskilling toward JD technologies.

## Key Skills
Start with MUST-WEAVE terms, then add the JD-only list labeled "(familiar)"; then other relevant skills.

## Professional Experience
Reverse-chronological; 4–6 bullets per role. Weave in MUST-WEAVE terms only where truthful. DO NOT put JD-only terms under employers.

## Education
## Certifications (optional)
## Projects (optional)

Constraints:
- Use only truthful info from the candidate resume; do NOT invent employers, dates, or degrees.
- Mirror JD language where accurate.
- Return ONLY the resume Markdown.${weave}${ksOnly}${pivotHint}

Job Description:
${jd}

Candidate Resume:
${resume || 'N/A'}`
}

function coverUser(resume: string, jd: string, name: string, mustWeave: string[], jdOnly: string[]) {
  const must = mustWeave.length ? `\n\nMUST WEAVE in letter: ${mustWeave.join(', ')}` : ''
  const hint = jdOnly.length ? `\nYou may express familiarity/interest in: ${jdOnly.join(', ')}, without claiming past usage.` : ''
  return `Write a concise professional cover letter (<= 350 words) in Markdown.
Include greeting and sign-off with "${name || 'the candidate'}".
No meta comments or notes. Return ONLY the letter.${must}${hint}

Job Description:
${jd}

Candidate Resume:
${resume || 'N/A'}`
}

export async function POST(req: NextRequest) {
  try {
    const { resumeText, jdText, type } = await req.json()
    if (!jdText || !type) {
      return NextResponse.json({ error: 'jdText and type are required' }, { status: 400 })
    }
    if (!process.env.AI_API_KEY || !process.env.AI_BASE_URL || !process.env.AI_MODEL) {
      return NextResponse.json(
        { error: 'AI provider is not configured. Set AI_BASE_URL, AI_API_KEY, AI_MODEL in Vercel envs.' },
        { status: 400 }
      )
    }

    const hdr = extractHeader(resumeText || '')
    const headerBlock = `# ${hdr.name || 'FULL NAME'}\n${hdr.detailsLine}`.trim()

    const jdKw = extractJDKeywords(jdText)
    const presentInResume = jdKw.filter(k => new RegExp(`\\b${esc(k)}\\b`, 'i').test(resumeText || ''))
    const jdOnly = jdKw.filter(k => !presentInResume.some(p => p.toLowerCase() === k.toLowerCase()))
    const lowOverlap = presentInResume.length < Math.max(4, Math.floor(jdKw.length * 0.2))

    const mustWeave = uniqueCI(presentInResume).slice(0, 25)
    const jdOnlyCapped = uniqueCI(jdOnly).slice(0, 20)

    const user =
      type === 'resume'
        ? resumeUser(resumeText, jdText, headerBlock, mustWeave, jdOnlyCapped, lowOverlap)
        : coverUser(resumeText, jdText, hdr.name, mustWeave, jdOnlyCapped)

    let text = await chatComplete(SYSTEM, user, { temperature: 0.1 })
    text = stripMetaBlocks(text || '')
    text = normalizeSections(text)
    if (type === 'resume') {
      text = injectHeader(text, headerBlock)
      text = ensureKeySkills(text, mustWeave, jdOnlyCapped)
      if (lowOverlap) text = ensurePracticeProjects(text, jdOnlyCapped)
      const top = uniqueCI([...mustWeave.slice(0, 5), ...jdOnlyCapped.slice(0, 5)])
      text = ensureSummaryKeywords(text, top)
    }

    // log usage
    try {
      const email = (resumeText || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || ''
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      await logUsage({ email, source: 'aggressive', resumeText, ip })
    } catch {}

    if (!text) return NextResponse.json({ error: 'Empty AI response' }, { status: 502 })
    return NextResponse.json({ text })
  } catch (err: any) {
    console.error('Aggressive Generate API error:', err)
    return NextResponse.json({ error: err?.message || 'Generate error' }, { status: 500 })
  }
}
