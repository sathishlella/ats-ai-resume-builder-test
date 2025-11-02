import { NextRequest, NextResponse } from 'next/server'
import { chatComplete } from '@/lib/ai'
import { logUsage } from '@/lib/usage'

export const runtime = 'nodejs'

// ---------------- header extraction (unchanged behavior) ----------------
type HeaderBits = {
  name: string
  detailsLine: string
  email?: string
  phone?: string
  linkedin?: string
}

function extractHeader(src: string = ''): HeaderBits {
  const lines = src.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length) return { name: '', detailsLine: '' }

  const nameLine =
    lines.find(l => /^[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+)+$/.test(l)) || lines[0]

  const idx = Math.min(lines.indexOf(nameLine) + 1, lines.length - 1)
  const detailsLine =
    lines.slice(idx, idx + 4).find(l => /\b@|linkedin\.com|https?:\/\/|www\.|[+(\d][\d\s().-]{5,}|\|/.test(l)) || ''

  const email = src.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
  const phone = src.match(/(\+?\d[\d\s().-]{8,})/)?.[0]
  const linkedin = src.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s|]+/i)?.[0]

  return {
    name: (nameLine || '').trim(),
    detailsLine: (detailsLine || [linkedin, phone, email].filter(Boolean).join(' | ')).trim(),
    email, phone, linkedin,
  }
}

// ---------------- keyword extraction & enforcement ----------------
const STOP = new Set([
  'the','and','or','for','with','of','to','in','on','by','at','as','is','are','be','an','a','this',
  'that','these','those','will','can','should','must','may','into','from','over','under','per','via',
  'you','we','our','they','their','within','across','etc'
])

// escape regex special chars
function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

// naive token capture: tech stacks, acronyms, proper nouns, hyphenated items
function extractJDKeywords(jd: string): string[] {
  const base = (jd || '').replace(/\r/g, ' ')
  const hits = new Map<string, number>()

  // 1) Hard-coded common tech/ATS tokens to make sure we pick them up
  const whitelist = [
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
  for (const w of whitelist) {
    const re = new RegExp(`\\b${esc(w)}\\b`, 'i')
    if (re.test(base)) hits.set(w, (hits.get(w) || 0) + 5) // boost known tech
  }

  // 2) Capture ALL candidate tokens (acronyms, CamelCase, hyphenated, ordinary)
  const tokens = base.match(/\b[A-Za-z][A-Za-z0-9.+#/-]{1,}\b/g) || []
  for (const tRaw of tokens) {
    const t = tRaw.replace(/[,.)(:;]+$/,'')
    const clean = t.trim()
    if (!clean) continue
    const lc = clean.toLowerCase()
    if (STOP.has(lc)) continue
    if (lc.length < 2) continue
    // de-noise common boilerplate
    if (/^\d{1,2}(\+|yrs?|years?)$/i.test(clean)) continue
    if (/^(experience|requirements?|responsibilities|preferred|about|role|position)$/i.test(clean)) continue
    // score: caps/acronyms get small boost
    const score = (hits.get(clean) || 0) + (/[A-Z]{2,}/.test(clean) ? 2 : 1)
    hits.set(clean, score)
  }

  // normalize casing: prefer original whitelist casing, else title-case acronyms stay
  const uniq: string[] = []
  for (const [k] of [...hits.entries()].sort((a,b)=>b[1]-a[1])) {
    // avoid near-duplicates (case-insensitive)
    if (uniq.some(u => u.toLowerCase() === k.toLowerCase())) continue
    uniq.push(k)
    if (uniq.length >= 40) break
  }
  return uniq
}

// ensure "## Key Skills" contains the required list.
// We only add keywords that also exist in the original resume text (to avoid fabrication).
function ensureKeySkills(md: string, mustUse: string[], resumeSrc: string): string {
  const present = new Set<string>()
  const out = (md || '')
  for (const k of mustUse) {
    const re = new RegExp(`\\b${esc(k)}\\b`, 'i')
    if (re.test(out)) present.add(k)
  }

  // filter to not fabricate: only add those already present in resumeSrc
  const allowedAdds = mustUse.filter(k => new RegExp(`\\b${esc(k)}\\b`, 'i').test(resumeSrc))

  const missing = allowedAdds.filter(k => !present.has(k))
  if (missing.length === 0) return out

  const secRe = /(##\s*Key Skills[^\n]*\n)([\s\S]*?)(?=\n##\s|\n*$)/
  const m = out.match(secRe)
  if (m) {
    // append to the first non-empty line inside Key Skills
    const head = m.index! > 0 ? out.slice(0, m.index) : ''
    const body = m[0]
    const tail = out.slice((m.index ?? 0) + m[0].length)

    // find first non-empty line after heading
    const lines = body.split('\n')
    const headingLineIdx = 0
    let contentStart = 1
    while (contentStart < lines.length && !lines[contentStart].trim()) contentStart++

    if (contentStart >= lines.length) {
      // no content, create it
      lines.push(missing.join(', '))
    } else {
      // append missing tokens to that content line
      const existing = lines[contentStart].replace(/^\s*[-*•]\s*/, '')
      const existingList = existing.split(/\s*,\s*/).filter(Boolean)
      const merged = Array.from(new Set([...existingList, ...missing]))
      lines[contentStart] = merged.join(', ')
    }

    const newBody = lines.join('\n')
    return head + newBody + tail
  } else {
    // No Key Skills section → insert after Summary if present else at top under header
    const sumRe = /(##\s*Summary[^\n]*\n)([\s\S]*?)(?=\n##\s|\n*$)/
    const sm = out.match(sumRe)
    if (sm) {
      const insertAt = (sm.index ?? 0) + sm[0].length
      return out.slice(0, insertAt) + `\n\n## Key Skills\n${missing.join(', ')}\n` + out.slice(insertAt)
    } else {
      // fallback: insert right after first H1 block
      const h1re = /^(#\s.*?)(?:\n{1,}|$)/
      const h1m = out.match(h1re)
      if (h1m) {
        const insertAt = (h1m.index ?? 0) + h1m[0].length
        return out.slice(0, insertAt) + `\n\n## Key Skills\n${missing.join(', ')}\n` + out.slice(insertAt)
      }
      return `## Key Skills\n${missing.join(', ')}\n\n` + out
    }
  }
}

// ---------------- formatting guards (unchanged ideas) ----------------
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

// ---------------- prompting ----------------
const SYSTEM = `You are ResumeGen. Return ONLY the resume or cover letter in clean Markdown.
- No meta notes or disclaimers.
- No placeholders.
- Keep headings as "## <Section>".
- Use JD language verbatim where truthful.`

function resumeUser(resume: string, jd: string, headerBlock: string, mustUse: string[]) {
  // MUST-USE list is *intersection* of JD keywords with candidate resume to avoid fabrication.
  const must = mustUse.length ? `\n\nMUST INCLUDE (verbatim where natural): ${mustUse.join(', ')}` : ''
  return `Use the following header block AS-IS at the very top (do not reformat it):

${headerBlock}

Then write an ATS-friendly resume in Markdown with these sections in this order:

## Summary
2–4 lines that weave in MUST-USE terms where truthful.

## Key Skills
Comma-separated list prioritizing MUST-USE terms first, then other relevant skills.

## Professional Experience
Reverse-chronological; 4–6 bullets per role. Start bullets with strong verbs and include measurable impact. Naturally incorporate MUST-USE terms where truthful.

## Education
School, degree, year.

## Certifications (optional)
## Projects (optional)

Constraints:
- Use only truthful info from the candidate resume; do not invent employers, dates, degrees, or tools not present in the resume.
- Mirror JD language where accurate.
- Return ONLY the resume Markdown.${must}

Job Description:
${jd}

Candidate Resume:
${resume || 'N/A'}`
}

function coverUser(resume: string, jd: string, name: string, mustUse: string[]) {
  const must = mustUse.length ? `\n\nMUST INCLUDE (weave naturally): ${mustUse.join(', ')}` : ''
  return `Write a concise professional cover letter (<= 350 words) in Markdown.
Include greeting and sign-off with "${name || 'the candidate'}".
No meta comments or notes. Return ONLY the letter.${must}

Job Description:
${jd}

Candidate Resume:
${resume || 'N/A'}`
}

// ---------------- route ----------------
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

    // 1) extract header
    const hdr = extractHeader(resumeText || '')

    // 2) build header block (no placeholders; keep your details exactly)
    const headerBlock =
`# ${hdr.name || 'FULL NAME'}
${hdr.detailsLine}`.trim()

    // 3) JD keyword mining → intersect with candidate resume to avoid fabrication
    const jdKw = extractJDKeywords(jdText)
    const intersect = jdKw.filter(k => new RegExp(`\\b${esc(k)}\\b`, 'i').test(resumeText || ''))
    const mustUse = Array.from(new Set(intersect)).slice(0, 25) // cap to keep prompt compact

    const user =
      type === 'resume'
        ? resumeUser(resumeText, jdText, headerBlock, mustUse)
        : coverUser(resumeText, jdText, hdr.name, mustUse)

    let text = await chatComplete(SYSTEM, user, { temperature: 0.1, max_tokens: 2200 })
    text = stripMetaBlocks(text || '')
    text = normalizeSections(text)
    if (type === 'resume') {
      text = injectHeader(text, headerBlock)
      // 4) final guard: ensure Key Skills contains required terms that already exist in resume
      text = ensureKeySkills(text, mustUse, resumeText || '')
    }

    if (!text) return NextResponse.json({ error: 'Empty AI response' }, { status: 502 })
    return NextResponse.json({ text })
  } catch (err: any) {
    console.error('Generate API error:', err)
    return NextResponse.json({ error: err?.message || 'Generate error' }, { status: 500 })
  }
}
