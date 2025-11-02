// lib/templates.ts
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'

const H = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
} as const

// tolerate BOM/ZWSP/odd leading spaces
const ZW = /^[\uFEFF\u200B\u200C\u200D\s]{0,3}/

function runsFromInline(md: string): TextRun[] {
  const parts = md.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return parts.map((p) =>
    /^\*\*[^*]+\*\*$/.test(p)
      ? new TextRun({ text: p.slice(2, -2), bold: true })
      : new TextRun({ text: p })
  )
}

function normalize(md: string) {
  return md
    .replace(/\r/g, '')
    .replace(/```[\s\S]*?\n([\s\S]*?)```/g, '$1') // strip code fences
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')           // strip hr
    .trim()
}

function detectHeading(line: string): { level: 1|2|3|4|5|6; text: string } | null {
  const cleaned = line.replace(ZW, '')
  let m = cleaned.match(/^(#{1,6})\s+(.+)$/)
  if (m) {
    const level = Math.min(6, Math.max(1, m[1].length)) as 1|2|3|4|5|6
    return { level, text: m[2].trim() }
  }
  m = cleaned.match(/^\*\*(.*?)\*\*$/) // whole-line **bold** as heading
  if (m) return { level: 3, text: m[1].trim() }
  return null
}

export async function buildDocx(markdown: string, title = 'Document'): Promise<Uint8Array> {
  const children: Paragraph[] = []
  const lines = normalize(markdown).split('\n')

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim()) {
      // skip blank lines; spacing is handled by styles
      continue
    }

    const heading = detectHeading(line)
    if (heading) {
      children.push(
        new Paragraph({
          heading: H[heading.level],
          children: runsFromInline(heading.text),
          spacing: { before: 40, after: 24 }, // tighter
        })
      )
      continue
    }

    const bullet = line.replace(ZW, '').match(/^\s{0,3}[-*+•]\s+(.+)$/)
    if (bullet) {
      children.push(
        new Paragraph({
          children: runsFromInline(bullet[1].trim()),
          bullet: { level: 0 },
          spacing: { before: 0, after: 20 }, // tight bullets
        })
      )
      continue
    }

    // Normal paragraph (tight)
    children.push(
      new Paragraph({
        children: runsFromInline(line.replace(ZW, '')),
        spacing: { before: 0, after: 40 }, // 40 twips ≈ 2pt
      })
    )
  }

  const doc = new Document({
    title,
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },           // 11pt
          paragraph: { spacing: { line: 240, before: 0, after: 40 } }, // single line, tight after
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { bold: true, size: 40 }, // 20pt
          paragraph: { spacing: { before: 60, after: 30 } }, // still compact
        },
      ],
    },
    sections: [{ properties: {}, children }],
  })

  const buf = await Packer.toBuffer(doc)
  return new Uint8Array(buf)
}
