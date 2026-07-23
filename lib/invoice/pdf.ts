import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib'

interface InvoiceLineItem {
  activity_date: string
  activity_title: string
  worker_name: string
  start_time: string
  end_time: string
  duration_hours: number
  ndis_line_item_number: string
  ndis_description?: string
  charge_amount: number
}

interface InvoiceData {
  invoiceNumber: string
  providerName: string
  providerAddress?: string
  providerAbn?: string
  clientName: string
  clientAddress?: string
  clientEmail?: string
  periodStart: string
  periodEnd: string
  lineItems: InvoiceLineItem[]
  totalHours: number
  subtotalAmount: number
  gstRate: number
  gstAmount: number
  totalAmount: number
  totalWorkerCost: number
  sentDate: string
  dueDate?: string
  bankName?: string
  bankAccountName?: string
  bankBsb?: string
  bankAccountNumber?: string
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // A4 dimensions in points (72 points per inch)
  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 36
  const contentWidth = pageWidth - margin * 2

  let page = pdf.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  function drawText(text: string, x: number, yPos: number, options?: {
    font?: PDFFont, size?: number, color?: any
  }) {
    const f = options?.font || font
    const s = options?.size || 10
    page.drawText(text, { x, y: yPos, font: f, size: s, color: options?.color || rgb(0.13, 0.13, 0.13) })
  }

  // Right-aligns text so it ends exactly at `rightEdge` — used everywhere instead of
  // hand-computed x positions, which is what caused columns to visually overlap before.
  function drawRightText(text: string, rightEdge: number, yPos: number, options?: {
    font?: PDFFont, size?: number, color?: any
  }) {
    const f = options?.font || font
    const s = options?.size || 10
    drawText(text, rightEdge - f.widthOfTextAtSize(text, s), yPos, options)
  }

  function drawLine(x1: number, yPos: number, x2: number, color?: any) {
    page.drawLine({
      start: { x: x1, y: yPos },
      end: { x: x2, y: yPos },
      thickness: 0.5,
      color: color || rgb(0.85, 0.85, 0.85),
    })
  }

  function newPageIfNeeded(minY: number) {
    if (y < minY) {
      page = pdf.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  // Header
  page.drawRectangle({
    x: 0, y: pageHeight - 80, width: pageWidth, height: 80,
    color: rgb(0.145, 0.388, 0.921), // blue-600
  })
  drawText('CareTime', margin, pageHeight - 35, { font: fontBold, size: 22, color: rgb(1, 1, 1) })
  drawText('TAX INVOICE', margin, pageHeight - 55, { font: font, size: 10, color: rgb(0.8, 0.88, 1) })
  drawRightText(data.invoiceNumber, pageWidth - margin, pageHeight - 38, { font: fontBold, size: 14, color: rgb(1, 1, 1) })

  y = pageHeight - 110

  // From / To section
  const colWidth = contentWidth / 2

  drawText('FROM', margin, y, { font: fontBold, size: 8, color: rgb(0.5, 0.5, 0.5) })
  drawText('TO', margin + colWidth, y, { font: fontBold, size: 8, color: rgb(0.5, 0.5, 0.5) })
  y -= 16

  drawText(data.providerName, margin, y, { font: fontBold, size: 11 })
  drawText(data.clientName, margin + colWidth, y, { font: fontBold, size: 11 })

  // FROM and TO grow independently (a Provider's address+ABN and a Client's
  // address+email are different lengths), so track each side's own cursor and
  // resume from whichever ran longer.
  let yFrom = y - 14
  let yTo = y - 14

  if (data.providerAddress) {
    drawText(data.providerAddress, margin, yFrom, { size: 9, color: rgb(0.4, 0.4, 0.4) })
    yFrom -= 12
  }
  if (data.providerAbn) {
    drawText(`ABN: ${data.providerAbn}`, margin, yFrom, { size: 9, color: rgb(0.4, 0.4, 0.4) })
    yFrom -= 12
  }
  if (data.clientAddress) {
    drawText(data.clientAddress, margin + colWidth, yTo, { size: 9, color: rgb(0.4, 0.4, 0.4) })
    yTo -= 12
  }
  if (data.clientEmail) {
    drawText(data.clientEmail, margin + colWidth, yTo, { size: 9, color: rgb(0.4, 0.4, 0.4) })
    yTo -= 12
  }

  y = Math.min(yFrom, yTo) - 8

  // Invoice details
  drawLine(margin, y, pageWidth - margin)
  y -= 18

  const details: [string, string][] = [
    ['Invoice Date:', formatDate(data.sentDate)],
    ['Period:', `${formatDate(data.periodStart)} – ${formatDate(data.periodEnd)}`],
  ]
  if (data.dueDate) details.push(['Payment Due:', formatDate(data.dueDate)])

  for (const [label, value] of details) {
    drawText(label, margin, y, { font: fontBold, size: 9, color: rgb(0.4, 0.4, 0.4) })
    drawText(value, margin + 80, y, { size: 9 })
    y -= 14
  }

  y -= 6
  drawLine(margin, y, pageWidth - margin)
  y -= 20

  // Line item columns — cumulative, non-overlapping x positions (each column's
  // right edge is exactly the next column's left edge)
  const colDate = { x: margin, width: 60 }
  const colStart = { x: colDate.x + colDate.width, width: 44 }
  const colEnd = { x: colStart.x + colStart.width, width: 44 }
  const colWorker = { x: colEnd.x + colEnd.width, width: 120 }
  const colHoursRight = colWorker.x + colWorker.width + 42
  const colRateRight = colHoursRight + 62
  const colCostRight = pageWidth - margin

  // Table header
  page.drawRectangle({ x: margin, y: y - 4, width: contentWidth, height: 18, color: rgb(0.96, 0.96, 0.96) })
  const headerOpts = { font: fontBold, size: 8, color: rgb(0.4, 0.4, 0.4) }
  drawText('Date', colDate.x, y, headerOpts)
  drawText('Start', colStart.x, y, headerOpts)
  drawText('End', colEnd.x, y, headerOpts)
  drawText('Worker', colWorker.x, y, headerOpts)
  drawRightText('Hours', colHoursRight, y, headerOpts)
  drawRightText('Rate', colRateRight, y, headerOpts)
  drawRightText('Cost', colCostRight, y, headerOpts)
  y -= 20

  // Table rows — each activity gets two lines: the main details, then the NDIS
  // item code/description indented under the Worker column
  for (const item of data.lineItems) {
    newPageIfNeeded(margin + 100)

    drawText(formatDate(item.activity_date), colDate.x, y, { size: 9, color: rgb(0.25, 0.25, 0.25) })
    drawText(formatTime(item.start_time), colStart.x, y, { size: 9, color: rgb(0.25, 0.25, 0.25) })
    drawText(formatTime(item.end_time), colEnd.x, y, { size: 9, color: rgb(0.25, 0.25, 0.25) })

    const workerName = item.worker_name.length > 18 ? item.worker_name.slice(0, 16) + '…' : item.worker_name
    drawText(workerName, colWorker.x, y, { size: 9, font: fontBold, color: rgb(0.15, 0.15, 0.15) })

    const hourlyRate = item.duration_hours > 0 ? item.charge_amount / item.duration_hours : 0
    drawRightText(`${item.duration_hours}h`, colHoursRight, y, { size: 9, color: rgb(0.25, 0.25, 0.25) })
    drawRightText(`$${hourlyRate.toFixed(2)}`, colRateRight, y, { size: 9, color: rgb(0.25, 0.25, 0.25) })
    drawRightText(`$${item.charge_amount.toFixed(2)}`, colCostRight, y, { size: 9, font: fontBold, color: rgb(0.15, 0.15, 0.15) })

    y -= 12

    const ndisLine = [item.ndis_line_item_number, item.ndis_description].filter(Boolean).join(' — ')
    if (ndisLine) {
      const truncated = ndisLine.length > 60 ? ndisLine.slice(0, 59) + '…' : ndisLine
      drawText(truncated, colWorker.x, y, { size: 7.5, color: rgb(0.55, 0.55, 0.55) })
    }

    y -= 14
    drawLine(margin, y + 4, pageWidth - margin, rgb(0.93, 0.93, 0.93))
  }

  // Totals — Subtotal, GST, then the bold Total
  newPageIfNeeded(margin + 220)
  y -= 6
  const totalsLabelX = pageWidth - margin - 180

  function totalRow(label: string, value: string, opts?: { bold?: boolean; bg?: boolean; size?: number }) {
    const size = opts?.size ?? (opts?.bold ? 11 : 9)
    if (opts?.bg) {
      page.drawRectangle({ x: margin, y: y - 5, width: contentWidth, height: 22, color: rgb(0.96, 0.96, 0.96) })
    }
    const f = opts?.bold ? fontBold : font
    const color = opts?.bold ? rgb(0.1, 0.1, 0.1) : rgb(0.4, 0.4, 0.4)
    drawText(label, totalsLabelX, y, { font: f, size, color })
    drawRightText(value, colCostRight, y, { font: f, size, color: opts?.bold ? color : rgb(0.25, 0.25, 0.25) })
    y -= opts?.bold ? 24 : 16
  }

  totalRow('Subtotal', `$${data.subtotalAmount.toFixed(2)}`)
  totalRow(`GST (${data.gstRate}%)`, `$${data.gstAmount.toFixed(2)}`)
  totalRow('TOTAL', `$${data.totalAmount.toFixed(2)}`, { bold: true, bg: true })

  // Payment Details + footer — pinned to the bottom of the page instead of
  // wherever the content cursor happens to land, so they sit in the same
  // spot regardless of line-item count or address lengths.
  const hasBankDetails = data.bankName || data.bankAccountName || data.bankBsb || data.bankAccountNumber
  const bankRows: [string, string][] = []
  if (data.bankName) bankRows.push(['Bank:', data.bankName])
  if (data.bankAccountName) bankRows.push(['Account Name:', data.bankAccountName])
  if (data.bankBsb) bankRows.push(['BSB:', data.bankBsb])
  if (data.bankAccountNumber) bankRows.push(['Account No:', data.bankAccountNumber])

  const paymentBlockHeight = hasBankDetails ? 14 + bankRows.length * 13 : 0
  const footerHeight = 20
  const bottomZoneTop = margin + footerHeight + paymentBlockHeight

  // If the totals block already ran past where the bottom zone needs to
  // start, push it onto a fresh page instead of overlapping the table/totals.
  if (y < bottomZoneTop) {
    page = pdf.addPage([pageWidth, pageHeight])
  }
  y = bottomZoneTop

  if (hasBankDetails) {
    drawText('PAYMENT DETAILS', margin, y, { font: fontBold, size: 8, color: rgb(0.5, 0.5, 0.5) })
    y -= 14
    for (const [label, value] of bankRows) {
      drawText(label, margin, y, { font: fontBold, size: 9, color: rgb(0.4, 0.4, 0.4) })
      drawText(value, margin + 85, y, { size: 9 })
      y -= 13
    }
  }

  drawText('This is a computer-generated invoice from CareTime.', margin, margin, {
    size: 8, color: rgb(0.6, 0.6, 0.6)
  })

  return pdf.save()
}
