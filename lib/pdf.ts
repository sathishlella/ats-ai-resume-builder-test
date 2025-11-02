import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib'

type DrawCtx = {
  x: number
  y: number
  maxWidth: number
  size: number
  font: PDFFont
  fontBold: PDFFont
  color: { r: number; g: number; b: number }
  page: any
}

/** Split into inline bold segments: [{text, bold}] */
function splitInlineBold(text: string): Array<{ text: string; bold: boolean }> {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return parts.map(p =>
    /^\*\*[^*]+\*\*$/.test(p)
      ? { text: p.slice(2, -2), bold: true }
      : { text: p, bold: false }
  )
}

/** Draw a single (possibly long) line with inline bold and wrapping */
function drawMarkdownLine(md: string, ctx: DrawCtx) {
  const { page, maxWidth, size, font, fontBold, color } = ctx
  let { x, y } = ctx

  // Build tokens as words with their bold flag
  const segments = splitInlineBold(md)
  const words: Array<{ w: string; f: PDFFont }> = []
  for (const seg of segments) {
    const f = seg.bold ? fontBold : font
    const split = seg.text.split(/(\s+)/).filter(Boolean) // keep spaces as tokens to avoid collapsing
    for (const token of split) words.push({ w: token, f })
  }

  let current = ''
  let currentFont: PDFFont | null = null
  const lineHeight = Math.round(size * 1.45)

  function flush() {
    if (!current) return
    page.drawText(current, { x, y, size, font: currentFont || font, color: rgb(color.r, color.g, color.b) })
    x += (currentFont || font).widthOfTextAtSize(current, size)
    current = ''
  }

  for (const { w, f } of words) {
    const test = current + w
    const width = (currentFont || f).widthOfTextAtSize(test, size)
    // If font changes mid-run, flush first
    if (current && currentFont !== f) {
      flush()
    }
    // Wrap if needed (only when adding a non-space token would exceed width)
    if (w.trim() && x + width > ctx.x + maxWidth) {
      flush()
      // new line
      y -= lineHeight
      x = ctx.x
      ctx.y = y
    }
    currentFont = f
    current += w
  }
  flush()
  // after drawing, move cursor to next line
  ctx.y = y - lineHeight
}

export async function buildPdf(content: string, title: string) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4
  const { width, height } = page.getSize()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const ctx: DrawCtx = {
    page,
    x: 60,
    y: height - 60,
    maxWidth: width - 120,
    size: 11,
    font,
    fontBold,
    color: { r: 0.1, g: 0.1, b: 0.15 }
  }

  // Title
  page.drawText(title, {
    x: ctx.x,
    y: ctx.y,
    size: 20,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.15)
  })
  ctx.y -= 28

  const lines = content.split(/\r?\n/).map(l => l.trim())

  for (const line of lines) {
    if (!line) {
      ctx.y -= 6
      continue
    }

    // Whole-line bold heading
    const heading = line.match(/^\*\*(.*?)\*\*$/)
    if (heading) {
      page.drawText(heading[1], {
        x: ctx.x,
        y: ctx.y,
        size: 14,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.15)
      })
      ctx.y -= 20
      continue
    }

    // Bullet: -, * or •
    if (/^[-*•]\s+/.test(line)) {
      const item = line.replace(/^[-*•]\s+/, '')
      // draw bullet prefix
      page.drawText('• ', {
        x: ctx.x,
        y: ctx.y,
        size: ctx.size,
        font,
        color: rgb(0.1, 0.1, 0.15)
      })
      // draw inline markdown after the bullet (wrapping)
      const startX = ctx.x + font.widthOfTextAtSize('• ', ctx.size)
      const savedX = ctx.x
      ctx.x = startX
      drawMarkdownLine(item, ctx)
      ctx.x = savedX
      continue
    }

    // Normal paragraph with inline **bold**
    drawMarkdownLine(line, ctx)
  }

  return await pdfDoc.save()
}
