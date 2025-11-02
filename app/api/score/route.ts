// app/api/score/route.ts
import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'

/* --------------------------- normalize helpers --------------------------- */
function preclean(s: string): string {
  // insert spaces between letters<->digits (python10+ -> python 10+)
  return String(s)
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2');
}

function normalize(s: string): string {
  return preclean(s)
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, '-')        // normalize dashes
    .replace(/[^a-z0-9+.#/\-\s]/g, ' ')      // keep tech chars
    .replace(/\s+/g, ' ')
    .trim()
}

// strip leading/trailing punctuation, but keep inner dots for node.js / .net
function cleanEdgePunct(tok: string): string {
  return tok.replace(/^[.,;:()]+|[.,;:()]+$/g, '')
}

const STOPWORDS = new Set([
  'the','a','an','and','or','for','to','of','in','on','at','with','by','from','as','is','are','was','were','be','being','been',
  'your','you','we','our','they','them','their','this','that','these','those',
  'will','can','must','should','could','may','would',
  'i','me','my','mine','us',
  'job','role','roles','team','teams','company','organization','position','summary','description',
  'responsibilities','responsibility','requirements','requirement','qualifications','qualification',
  'about','years','year','plus','include','including','across',
  'work','working','worked','design','designed','develop','developed','maintain','maintained','support','supported','provide','provided',
  'good','great','excellent','strong','communication','experience','experienced','familiarity','knowledge','understanding'
])

// Never allow these as standalone keywords
const EXCLUDE_TOKENS = new Set([
  '.', '-', '–', '—',
  'balance','balances','accurate','accuracy','account','accounts',
  'corporate','office','corporate office',
  'key','addition','added','used','use','using','hands','handson','hands-on',
])

const GENERIC_SINGLE_WORDS = new Set([
  'customer','clients','stakeholders','users','business','product','services','applications','systems',
  'process','processes','tools','solutions','environment','projects','project','platform','platforms','framework'
])

const TLD_RE = /\b[a-z0-9-]+\.(com|net|org|io|in|co|ai|dev|tech|gov|edu)\b/i;
const NUMPLUS_RE = /^\d+\+$/;                   // 10+ , 3+ , etc.
const BAD_DOT_RE = /^[a-z0-9]+\.([a-z0-9]+)$/;  // venkat.n, tekskills.in (filtered later)

/* ------------------------------- synonyms ------------------------------- */
const SYNONYMS: Record<string, string[]> = {
  // languages & runtimes
  'javascript': ['js'],
  'typescript': ['ts'],
  'python': ['py'],
  'java': [],
  'c#': ['c sharp','c-sharp','csharp'],
  'c++': ['cpp'],
  '.net': ['dotnet','.net core','net core','net-core','dot net'],
  'node.js': ['node','nodejs'],
  // front-end
  'react': ['react.js','reactjs'],
  'next.js': ['nextjs'],
  'vue.js': ['vue','vuejs'],
  'angular': ['angularjs'],
  // back-end & apis
  'rest': ['rest api','restful'],
  'graphql': [],
  'microservices': ['micro-service','micro service'],
  // data
  'postgresql': ['postgres','psql'],
  'mysql': [],
  'mongodb': ['mongo'],
  'sqlite': [],
  'redis': [],
  'elasticsearch': ['elastic','es'],
  // cloud & devops
  'aws': ['amazon web services'],
  'gcp': ['google cloud'],
  'azure': ['microsoft azure'],
  'ci/cd': ['cicd','continuous integration','continuous delivery'],
  'docker': [],
  'kubernetes': ['k8s'],
  'terraform': [],
  // ml/ai
  'nlp': ['natural language processing'],
  'llm': ['large language model'],
  // healthcare
  'hipaa': ['hippa'],
  'icd-10': ['icd10','icd 10'],
  'cpt': [],
  'hcpcs': [],
  'ehr': ['electronic health record'],
  'epic': ['epic clarity'],
  'cerner': [],
  // office tools
  'microsoft excel': ['excel','ms excel'],
  'microsoft word': ['word'],
  // ats
  'applicant tracking system': ['ats'],
}

function variants(term: string): string[] {
  const t = normalize(term)
  const extra = SYNONYMS[t] || []
  return Array.from(new Set([t, ...extra.map(normalize)]))
}

function escapeReg(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

function containsExact(textNorm: string, term: string): boolean {
  return variants(term).some(v => new RegExp(`\\b${escapeReg(v)}\\b`, 'i').test(textNorm))
}

function fuzzyContains(textNorm: string, term: string): boolean {
  const v = normalize(term)
  if (!v) return false
  const toks = v.split(' ').filter(Boolean)
  if (!toks.length) return false
  let hit = 0
  for (const t of toks) {
    const base = t.replace(/(ing|ed|es|s)$/,'')
    const re = new RegExp(`\\b${escapeReg(base)}[a-z0-9]*\\b`, 'i')
    if (re.test(textNorm)) hit++
  }
  return (hit / toks.length) >= 0.6
}

function contains(textNorm: string, term: string): boolean {
  return containsExact(textNorm, term) || fuzzyContains(textNorm, term)
}

/* --------------------------- tokenization logic ------------------------- */
function isAllowedDotToken(tok: string): boolean {
  // keep .net and *.js only
  if (tok === '.net') return true
  if (tok.endsWith('.js')) return true
  return false
}

function isNoisyToken(tok: string): boolean {
  if (!tok) return true
  if (STOPWORDS.has(tok) || EXCLUDE_TOKENS.has(tok) || GENERIC_SINGLE_WORDS.has(tok)) return true
  if (tok.length > 24) return true
  if (NUMPLUS_RE.test(tok)) return true
  if (TLD_RE.test(tok)) return true // domains
  if (tok.includes('.')) return !isAllowedDotToken(tok)
  // tokens with + allowed: c++ only; otherwise drop letter+numplus like 10+
  if (tok.includes('+') && tok !== 'c++') return true
  // drop digit-only (but keep icd-10 which includes '-')
  if (/^\d+$/.test(tok)) return true
  return false
}

function tokenize(text: string): string[] {
  const t = normalize(text)
  const raw = t.split(' ').map(cleanEdgePunct)
  return raw.filter(tok => tok && !isNoisyToken(tok))
}

function bigrams(tokens: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = cleanEdgePunct(tokens[i])
    const b = cleanEdgePunct(tokens[i + 1])
    if (!a || !b) continue
    if (isNoisyToken(a) || isNoisyToken(b)) continue

    // keep bigram only if it looks skill-ish:
    // contains tech chars/digits OR either term matches a known synonym key
    const synSet = SYNONYMS_KEYS
    const skillish = /[+.#/0-9]/.test(`${a} ${b}`) || synSet.has(a) || synSet.has(b)
    if (!skillish) continue

    // filter generic pairs
    if (/^(corporate office|balances accurate|worked addition)$/i.test(`${a} ${b}`)) continue

    out.push(`${a} ${b}`)
  }
  return out
}

/* ---------------------------- ranking & buckets ------------------------- */
const SYNONYMS_KEYS = new Set(Object.keys(SYNONYMS))

const REQ_HEAD = /(requirement|must[-\s]?have|qualifications|you\s+will\s+need|what\s+you\s+need)/i
const PREF_HEAD = /(preferred|nice\s*to\s*have|good\s*to\s*have|bonus|plus)/i

type Buckets = { required: string; preferred: string; other: string }
function bucketizeJD(jd: string): Buckets {
  const lines = String(jd).split(/\r?\n/)
  let mode: keyof Buckets = 'other'
  const out: Buckets = { required: '', preferred: '', other: '' }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (REQ_HEAD.test(line)) { mode = 'required'; continue }
    if (PREF_HEAD.test(line)) { mode = 'preferred'; continue }
    out[mode] += (out[mode] ? '\n' : '') + line
  }
  return out
}

function rankKeywords(text: string, max = 30): string[] {
  const toks = tokenize(text)
  const bi = bigrams(toks)
  const all = [...toks, ...bi]

  const freq = new Map<string, number>()
  for (const t of all) freq.set(t, (freq.get(t) || 0) + 1)

  const sorted = Array.from(freq.entries())
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1))
    .map(([k]) => k)

  const prioritized = sorted.filter(k =>
    /[+.#/0-9]/.test(k) || SYNONYMS_KEYS.has(k) || k.includes(' ')
  ).concat(sorted)

  const uniq: string[] = []
  for (const k of prioritized) {
    const cleaned = k.trim()
    if (!cleaned || isNoisyToken(cleaned)) continue
    if (/^(corporate office|balances accurate|worked addition)$/i.test(cleaned)) continue
    uniq.push(cleaned)
    if (uniq.length >= max) break
  }
  return uniq
}

function extractSkillsBlock(resumeText: string): string {
  const lines = String(resumeText).split(/\r?\n/)
  let capture = false
  const picked: string[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (/^(skills|technical skills|tech skills|core skills)\b/i.test(line)) {
      capture = true; continue
    }
    if (capture && /^\*\*.*\*\*$/.test(line)) break // next heading **Title**
    if (capture && /^[-*•+]\s+/.test(line)) picked.push(line.replace(/^[-*•+]\s+/, ''))
    else if (capture && line) picked.push(line)
  }
  return picked.join(' ')
}

/* --------------------------------- API ---------------------------------- */
export async function POST(req: NextRequest) {
  try {
    const { resumeText = '', jdText = '' } = await req.json()
    if (!jdText) return NextResponse.json({ error: 'jdText is required' }, { status: 400 })

    const jd = bucketizeJD(jdText)

    // Keyword sets with caps to control denominator
    let required = rankKeywords(jd.required, 25)
    let preferred = rankKeywords(jd.preferred, 25)

    if (!required.length && !preferred.length) {
      const global = rankKeywords(jdText, 35)
      const mid = Math.min(15, Math.floor(global.length / 2))
      required = global.slice(0, mid)
      preferred = global.slice(mid, mid + 20)
    }

    if (required.length < 12) {
      const extra = rankKeywords(jd.other || jdText, 20).filter(t => !required.includes(t))
      required = required.concat(extra).slice(0, 15) // cap
    }
    preferred = preferred.filter(k => !new Set(required).has(k)).slice(0, 20)

    const resumeNorm = normalize(resumeText)
    const skillsBlockNorm = normalize(extractSkillsBlock(resumeText))

    const presentRequired: string[] = []
    const missingRequired: string[] = []
    for (const k of required) (contains(resumeNorm, k) ? presentRequired : missingRequired).push(k)

    const presentPreferred: string[] = []
    const missingPreferred: string[] = []
    for (const k of preferred) (contains(resumeNorm, k) ? presentPreferred : missingPreferred).push(k)

    // weights + skills bonus
    const W_REQ = 4, W_PREF = 1
    const BONUS_SKILLS_REQ = 1, BONUS_SKILLS_PREF = 0.5

    const totalWeight = Math.max(1, required.length * W_REQ + preferred.length * W_PREF)
    let gotWeight = presentRequired.length * W_REQ + presentPreferred.length * W_PREF

    for (const k of presentRequired) if (contains(skillsBlockNorm, k)) gotWeight += BONUS_SKILLS_REQ
    for (const k of presentPreferred) if (contains(skillsBlockNorm, k)) gotWeight += BONUS_SKILLS_PREF

    const raw = Math.round((gotWeight / totalWeight) * 100)
    // base score from keyword weighting
    const baseScore = Math.max(0, Math.min(100, raw))

    /*
     * ------------------------ Logistic regression model ------------------------
     *
     * To improve the match score, we train a tiny logistic‑regression model on
     * a handful of synthetic resume/JD pairs (see `train_match_model.py`).  The
     * model combines several simple text features:
     *   1. overlap_ratio    – share of JD tokens found in resume
     *   2. resume_coverage  – share of resume tokens found in JD
     *   3. length_diff      – normalised token length difference
     *   4. kw_ratio         – fraction of top JD keywords appearing in resume
     *
     * The learned weights and intercept below come directly from the Python
     * training script.  We compute the logistic probability p = 1/(1+e^-z)
     * and map it into a 0–100 scale.  Finally, we blend the model score
     * equally with the base keyword weighting to produce the final match
     * score.  Should you wish to adjust the blend, change the weights
     * accordingly.
     */
    function computeFeatures(resume: string, jd: string): number[] {
      const resTokens = tokenize(resume)
      const jdTokens = tokenize(jd)
      const resSet = new Set(resTokens)
      const jdSet = new Set(jdTokens)
      let commonCount = 0
      for (const tok of resSet) if (jdSet.has(tok)) commonCount++
      const overlap_ratio = commonCount / (jdSet.size || 1)
      const resume_coverage = commonCount / (resSet.size || 1)
      const length_diff = Math.abs(resTokens.length - jdTokens.length) / ((Math.max(resTokens.length, jdTokens.length)) || 1)
      const jdKeywords = rankKeywords(jd, 10)
      let kw_present = 0
      for (const kw of jdKeywords) if (resSet.has(kw)) kw_present++
      const kw_ratio = kw_present / (jdKeywords.length || 1)
      return [overlap_ratio, resume_coverage, length_diff, kw_ratio]
    }
    const LR_WEIGHTS = [2.64137283, 2.37778977, -0.18100524, 2.10916598]
    const LR_INTERCEPT = -2.288096774813138
    const feats = computeFeatures(resumeText, jdText)
    let z = LR_INTERCEPT
    for (let i = 0; i < feats.length; i++) z += feats[i] * LR_WEIGHTS[i]
    const logisticProb = 1 / (1 + Math.exp(-z))
    const modelScore = logisticProb * 100
    // Blend baseScore and modelScore equally for the final score
    const finalScore = Math.max(0, Math.min(100, Math.round((baseScore + modelScore) / 2)))

    return NextResponse.json({
      score: finalScore,
      required, preferred,
      presentRequired, missingRequired,
      presentPreferred, missingPreferred,
      baseScore,
      modelScore: Math.round(modelScore),
    })
  } catch (err: any) {
    console.error('score error:', err)
    return NextResponse.json({ error: err?.message || 'score failed' }, { status: 500 })
  }
}
