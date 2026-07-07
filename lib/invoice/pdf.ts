import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib'

interface InvoiceLineItem {
  activity_date: string
  activity_title: string
  worker_name: string
  start_time: string
  end_time: string
  duration_hours: number
  ndis_line_item_number: string
  charge_amount: number
}

interface InvoiceData {
  invoiceNumber: string
  providerName: string
  providerAddress?: string
  providerAbn?: string
  clientName: string
  clientAddress?: string
  periodStart: string
  periodEnd: string
  lineItems: InvoiceLineItem[]
  totalHours: number
  totalAmount: number
  totalWorkerCost: number
  sentDate: string
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
  const margin = 50
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

  function drawLine(x1: number, yPos: number, x2: number, color?: any) {
    page.drawLine({
      start: { x: x1, y: yPos },
      end: { x: x2, y: yPos },
      thickness: 0.5,
      color: color || rgb(0.85, 0.85, 0.85),
    })
  }

  // Header
  page.drawRectangle({
    x: 0, y: pageHeight - 80, width: pageWidth, height: 80,
    color: rgb(0.145, 0.388, 0.921), // blue-600
  })
  drawText('CareTime', margin, pageHeight - 35, { font: fontBold, size: 22, color: rgb(1, 1, 1) })
  drawText('TAX INVOICE', margin, pageHeight - 55, { font: font, size: 10, color: rgb(0.8, 0.88, 1) })
  drawText(data.invoiceNumber, pageWidth - margin - fontBold.widthOfTextAtSize(data.invoiceNumber, 14), pageHeight - 38, {
    font: fontBold, size: 14, color: rgb(1, 1, 1)
  })

  y = pageHeight - 110

  // From / To section
  const colWidth = contentWidth / 2

  drawText('FROM', margin, y, { font: fontBold, size: 8, color: rgb(0.5, 0.5, 0.5) })
  drawText('TO', margin + colWidth, y, { font: fontBold, size: 8, color: rgb(0.5, 0.5, 0.5) })
  y -= 16

  drawText(data.providerName, margin, y, { font: fontBold, size: 11 })
  drawText(data.clientName, margin + colWidth, y, { font: fontBold, size: 11 })
  y -= 14

  if (data.providerAddress) {
    drawText(data.providerAddress, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) })
    y -= 12
  }
  if (data.providerAbn) {
    drawText(`ABN: ${data.providerAbn}`, margin, y, { size: 9, color: rgb(0.4, 0.4, 0.4) })
    y -= 12
  }
  if (data.clientAddress) {
    drawText(data.clientAddress, margin + colWidth, y + (data.providerAddress ? 12 : 0) + (data.providerAbn ? 12 : 0), {
      size: 9, color: rgb(0.4, 0.4, 0.4)
    })
  }

  y -= 10

  // Invoice details
  drawLine(margin, y, pageWidth - margin)
  y -= 18

  const details = [
    ['Invoice Date:', formatDate(data.sentDate)],
    ['Period:', `${formatDate(data.periodStart)} – ${formatDate(data.periodEnd)}`],
  ]
  for (const [label, value] of details) {
    drawText(label, margin, y, { font: fontBold, size: 9, color: rgb(0.4, 0.4, 0.4) })
    drawText(value, margin + 80, y, { size: 9 })
    y -= 14
  }

  y -= 10
  drawLine(margin, y, pageWidth - margin)
  y -= 20

  // Table header
  const cols = [
    { label: 'Date', x: margin, width: 70 },
    { label: 'Activity', x: margin + 70, width: 120 },
    { label: 'Worker', x: margin + 190, width: 90 },
    { label: 'Time', x: margin + 280, width: 90 },
    { label: 'NDIS Item', x: margin + 370, width: 80 },
    { label: 'Hours', x: margin + 450, width: 40, right: true },
    { label: 'Amount', x: pageWidth - margin - 55, width: 55, right: true },
  ]

  // Header background
  page.drawRectangle({
    x: margin, y: y - 4, width: contentWidth, height: 18,
    color: rgb(0.96, 0.96, 0.96),
  })

  for (const col of cols) {
    const textWidth = col.right ? fontBold.widthOfTextAtSize(col.label, 8) : 0
    drawText(col.label,
      col.right ? col.x + col.width - textWidth : col.x,
      y, { font: fontBold, size: 8, color: rgb(0.4, 0.4, 0.4) }
    )
  }
  y -= 20

  // Table rows
  for (const item of data.lineItems) {
    if (y < margin + 60) {
      // New page
      page = pdf.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }

    const row = [
      formatDate(item.activity_date),
      item.activity_title.length > 20 ? item.activity_title.slice(0, 18) + '…' : item.activity_title,
      item.worker_name.length > 14 ? item.worker_name.slice(0, 12) + '…' : item.worker_name,
      `${formatTime(item.start_time)} – ${formatTime(item.end_time)}`,
      item.ndis_line_item_number || '—',
      `${item.duration_hours}h`,
      `$${item.charge_amount.toFixed(2)}`,
    ]

    for (let i = 0; i < cols.length; i++) {
      const col = cols[i]
      const text = row[i]
      const textWidth = col.right ? font.widthOfTextAtSize(text, 9) : 0
      drawText(text,
        col.right ? col.x + col.width - textWidth : col.x,
        y, { size: 9, color: rgb(0.25, 0.25, 0.25) }
      )
    }

    y -= 16
    drawLine(margin, y + 4, pageWidth - margin, rgb(0.93, 0.93, 0.93))
  }

  // Total row
  y -= 6
  page.drawRectangle({
    x: margin, y: y - 4, width: contentWidth, height: 22,
    color: rgb(0.96, 0.96, 0.96),
  })

  drawText('TOTAL', margin, y, { font: fontBold, size: 10 })

  const hoursStr = `${data.totalHours}h`
  const totalStr = `$${data.totalAmount.toFixed(2)}`
  const hoursCol = cols[5]
  const amountCol = cols[6]

  drawText(hoursStr,
    hoursCol.x + hoursCol.width - fontBold.widthOfTextAtSize(hoursStr, 10),
    y, { font: fontBold, size: 10 }
  )
  drawText(totalStr,
    amountCol.x + amountCol.width - fontBold.widthOfTextAtSize(totalStr, 10),
    y, { font: fontBold, size: 10 }
  )

  // Footer
  y -= 40
  drawText('This is a computer-generated invoice from CareTime.', margin, y, {
    size: 8, color: rgb(0.6, 0.6, 0.6)
  })

  return pdf.save()
}
