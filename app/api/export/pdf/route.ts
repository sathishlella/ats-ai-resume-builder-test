// app/api/export/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib'

export const runtime = 'nodejs'

type Segment = { text: string; bold: boolean }

// --- helpers ---------------------------------------------------------------

function splitInlineBold(text: string): Segment[] {
  // keep **bold** inline; everything else normal
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return parts.map((p) =>
    /^\*\*[^*]+\*\*$/.test(p)
      ? { text: p.slice(2, -2), bold: true }
      : { text: p, bold: false }
  )
}

function measure(font: PDFFont, text: string, size: number) {
  return font.widthOfTextAtSize(text, size)
}

function addNewPage(pdfDoc: PDFDocument, margin: number) {
  const page = pdfDoc.addPage([595.28, 841.89]) // A4
  const { width, height } = page.getSize()
  return { page, width, height, maxWidth: width - margin * 2, y: height - margin }
}

function headingSize(level: number) {
  // H1 largest → H6 smallest
  switch (level) {
    case 1: return 20
    case 2: return 16
    case 3: return 13.5
    case 4: return 12.5
    case 5: return 12
    default: return 11.5
  }
}

function lineH(size: number) {
  return Math.round(size * 1.35)
}

function normalize(md: string) {
  // remove code fences (keep inner text)
  md = md.replace(/```[\s\S]*?\n([\s\S]*?)```/g, '$1')
  // strip stray CRs
  md = md.replace(/\r/g, '')
  // ignore horizontal rules
  md = md.replace(/^\s*[-*_]{3,}\s*$/gm, '')
  return md
}

// --- route -----------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json()
    if (!content) {
      return NextResponse.json({ error: 'Missing content' }, { status: 400 })
    }

    const input = normalize(String(content))

    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const margin = 50
    let { page, width, height, maxWidth, y } = addNewPage(pdfDoc, margin)

    const baseSize = 11
    const baseLH = lineH(baseSize)

    const ensureSpace = (needed: number) => {
      if (y - needed < margin) {
        const np = addNewPage(pdfDoc, margin)
        page = np.page
        width = np.width
        height = np.height
        maxWidth = np.maxWidth
        y = np.y
      }
    }

    // wrapped text drawer with inline **bold**
    const drawWrapped = (text: string, indentX = 0, size = baseSize) => {
      const segs = splitInlineBold(text)
      const tokens: Array<{ t: string; f: PDFFont }> = []
      for (const seg of segs) {
        const f = seg.bold ? fontBold : font
        for (const tok of seg.text.split(/(\s+)/).filter(Boolean)) {
          tokens.push({ t: tok, f })
        }
      }

      let x = margin + indentX
      let current = ''
      let currentFont: PDFFont | null = null

      const flush = () => {
        if (!current) return
        page.drawText(current, {
          x,
          y,
          size,
          font: currentFont || font,
          color: rgb(0.1, 0.1, 0.15),
        })
        x += measure(currentFont || font, current, size)
        current = ''
      }

      for (const { t, f } of tokens) {
        const changing = current && currentFont !== f
        const tentative = changing ? t : current + t
        const w = measure(changing ? f : (currentFont || f), tentative, size)
        if (t.trim() && x + w > margin + indentX + maxWidth) {
          flush()
          const lh = lineH(size)
          ensureSpace(lh)
          y -= lh
          x = margin + indentX
        }
        if (changing) flush()
        currentFont = f
        current += t
      }
      flush()
      const lh = lineH(size)
      ensureSpace(lh)
      y -= lh
    }

    // headings get their own drawer (full bold with size)
    const drawHeading = (text: string, level: number) => {
      const size = headingSize(level)
      const lh = lineH(size)
      ensureSpace(lh + 6)
      // simple wrap for long headings (single font)
      let x = margin
      let remaining = text.trim()
      while (remaining.length) {
        // naive word wrap
        const words = remaining.split(/\s+/)
        let line = ''
        for (let i = 0; i < words.length; i++) {
          const candidate = (line ? line + ' ' : '') + words[i]
          const w = measure(fontBold, candidate, size)
          if (margin + w > margin + maxWidth) break
          line = candidate
        }
        if (!line) {
          // single very long word - force draw and break
          line = words.shift() as string
        } else {
          remaining = remaining.slice(line.length).trim()
        }

        page.drawText(line, {
          x,
          y,
          size,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.15),
        })
        y -= lh
        ensureSpace(lh)
        x = margin
      }
      y -= 4 // small spacing after heading
    }

    const lines = input.split('\n')

    for (const raw of lines) {
      // keep leading spaces for bullet detection but trim right
      const line = raw.replace(/\s+$/, '')
      if (!line.trim()) {
        ensureSpace(Math.round(baseLH / 2))
        y -= Math.round(baseLH / 2)
        continue
      }

      // ATX heading: # .. ###### ..
      const h = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/)
      if (h) {
        const level = Math.min(6, Math.max(1, h[1].length))
        const text = h[2].trim()
        drawHeading(text, level)
        continue
      }

      // whole-line bold heading: **Summary**
      const wholeBold = line.match(/^\s*\*\*(.*?)\*\*\s*$/)
      if (wholeBold) {
        drawHeading(wholeBold[1], 3) // treat as H3
        continue
      }

      // Bullets: -, *, •, or +
      const bullet = line.match(/^\s{0,3}([-*+•])\s+(.+)$/)
      if (bullet) {
        const item = bullet[2].trim()
        ensureSpace(baseLH)
        page.drawText('•', { x: margin, y, size: baseSize, font, color: rgb(0.1, 0.1, 0.15) })
        drawWrapped(item, 14, baseSize)
        continue
      }

      // Normal paragraph
      drawWrapped(line.trim(), 0, baseSize)
    }

    const pdfBytes = await pdfDoc.save()
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="resume.pdf"',
      },
    })
  } catch (err: any) {
    console.error('PDF Export Error:', err)
    return NextResponse.json({ error: err?.message || 'PDF generation failed' }, { status: 500 })
  }
}
