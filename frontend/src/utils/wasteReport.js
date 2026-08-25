import { getWasteTrendSeries, summarizeWasteCollections, wasteFilterDescription } from './wasteAnalytics.js'

export function buildWasteCsv(collections = [], { locationName = 'EcoGuard location' } = {}) {
  const headers = [
    'Location',
    'Collected At',
    'Schedule Reference',
    'Waste Type',
    'Total (kg)',
    'Recycled (kg)',
    'Landfill (kg)',
    'Data Source',
    'Status',
    'Notes',
  ]
  const rows = collections.map((record) => [
    locationName,
    new Date(record.collected_at).toISOString(),
    record.schedule_id ? `Schedule #${record.schedule_id}` : 'Unscheduled',
    record.waste_type,
    fixedNumber(record.total_kg),
    fixedNumber(record.recycled_kg),
    fixedNumber(record.landfill_kg ?? Number(record.total_kg) - Number(record.recycled_kg)),
    record.source === 'simulated_sensor' ? 'SIMULATED SENSOR DATA' : 'Manual entry',
    record.status,
    record.notes || '',
  ])
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function buildWastePdfBytes(collections = [], context = {}) {
  const generatedAt = context.generatedAt instanceof Date ? context.generatedAt : new Date(context.generatedAt || Date.now())
  const locationName = context.locationName || 'EcoGuard location'
  const filters = context.filters || {}
  const summary = context.summary || summarizeWasteCollections(collections)
  const trend = context.trend || getWasteTrendSeries(collections)
  const pages = [buildSummaryPage({ locationName, filters, summary, trend, generatedAt })]

  if (collections.length) {
    const rowsPerPage = 23
    for (let index = 0; index < collections.length; index += rowsPerPage) {
      pages.push(buildTablePage(collections.slice(index, index + rowsPerPage), locationName, pages.length + 1))
    }
  }

  return encodePdf(pages)
}

export function wasteReportFilename(locationName, format, generatedAt = new Date()) {
  const locationPart = String(locationName || 'location')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'location'
  const datePart = generatedAt.toISOString().slice(0, 10)
  return `ecoguard-waste-${locationPart}-${datePart}.${format}`
}

export function downloadWasteReport(data, mimeType, filename) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function buildSummaryPage({ locationName, filters, summary, trend, generatedAt }) {
  const commands = []
  fillRect(commands, 0, 770, 595, 72, [0.05, 0.35, 0.28])
  text(commands, 'EcoGuard Waste Management Report', 42, 806, 20, 'F2', [1, 1, 1])
  text(commands, 'Persisted collection analytics and history', 42, 787, 9, 'F1', [0.85, 1, 0.93])
  text(commands, `Location: ${locationName}`, 42, 744, 12, 'F2')
  text(commands, `Generated: ${formatDateTime(generatedAt)}`, 42, 727, 9)
  text(commands, `Scope: ${wasteFilterDescription(filters)}`, 42, 711, 9)

  text(commands, 'Summary', 42, 680, 14, 'F2')
  const cards = [
    ['Total collected', `${fixedNumber(summary.totalKg)} kg`],
    ['Total recycled', `${fixedNumber(summary.recycledKg)} kg`],
    ['Landfill', `${fixedNumber(summary.landfillKg)} kg`],
    ['Recycling rate', `${Number(summary.recyclingRate || 0).toFixed(1)}%`],
    ['Successful records', String(summary.successfulCount || 0)],
    ['Missed records', String(summary.missedCount || 0)],
    ['Average collection', `${fixedNumber(summary.averageKg)} kg`],
    ['Peak period', summary.peakPeriod ? `${summary.peakPeriod} (${fixedNumber(summary.peakKg)} kg)` : 'Not available'],
  ]
  cards.forEach(([label, value], index) => {
    const column = index % 2
    const row = Math.floor(index / 2)
    const x = 42 + column * 255
    const y = 650 - row * 38
    fillRect(commands, x, y - 22, 238, 31, [0.96, 0.97, 0.98])
    text(commands, label, x + 8, y - 3, 8, 'F1', [0.35, 0.4, 0.48])
    text(commands, value, x + 8, y - 16, 10, 'F2')
  })

  text(commands, 'Collected waste trend', 42, 475, 13, 'F2')
  if (summary.hasTrend && trend.length) {
    drawTrendChart(commands, trend.slice(-9), 42, 300, 510, 145)
  } else {
    fillRect(commands, 42, 326, 510, 100, [1, 0.98, 0.92])
    text(commands, 'Insufficient data for trend analysis.', 58, 388, 11, 'F2', [0.55, 0.35, 0.05])
    text(commands, 'At least two completed or partial records are required.', 58, 369, 9, 'F1', [0.55, 0.35, 0.05])
  }

  fillRect(commands, 42, 214, 510, 60, [0.96, 0.94, 1])
  text(commands, 'SIMULATED DATA DISCLOSURE', 55, 254, 10, 'F2', [0.35, 0.18, 0.65])
  wrapText(commands, 'Rows labelled SIMULATED SENSOR are student-assignment estimates and are not readings from a physical smart bin or IoT device.', 55, 237, 475, 9, 13, [0.35, 0.18, 0.65])

  text(commands, `Detailed history: ${summary.recordCount || 0} filtered record(s)`, 42, 180, 11, 'F2')
  text(commands, collectionsNotice(summary.recordCount), 42, 163, 9, 'F1', [0.35, 0.4, 0.48])
  text(commands, 'Generated by EcoGuard for educational demonstration.', 42, 48, 8, 'F1', [0.5, 0.55, 0.62])
  return commands.join('\n')
}

function buildTablePage(records, locationName, pageNumber) {
  const commands = []
  text(commands, 'EcoGuard Waste Collection History', 36, 806, 15, 'F2')
  text(commands, `${locationName} - page ${pageNumber}`, 36, 789, 8, 'F1', [0.4, 0.45, 0.52])
  fillRect(commands, 34, 754, 527, 22, [0.1, 0.45, 0.35])
  const columns = [36, 122, 178, 226, 274, 326, 410, 505]
  const headers = ['Date', 'Type', 'Total', 'Recycle', 'Landfill', 'Source', 'Status', 'Ref']
  headers.forEach((header, index) => text(commands, header, columns[index], 762, 7, 'F2', [1, 1, 1]))

  records.forEach((record, index) => {
    const y = 735 - index * 29
    if (index % 2 === 0) fillRect(commands, 34, y - 8, 527, 25, [0.97, 0.98, 0.98])
    const values = [
      shortDate(record.collected_at),
      titleCase(record.waste_type).slice(0, 10),
      fixedNumber(record.total_kg),
      fixedNumber(record.recycled_kg),
      fixedNumber(record.landfill_kg ?? Number(record.total_kg) - Number(record.recycled_kg)),
      record.source === 'simulated_sensor' ? 'SIMULATED' : 'Manual',
      titleCase(record.status),
      record.schedule_id ? `#${record.schedule_id}` : 'None',
    ]
    values.forEach((value, columnIndex) => text(commands, value, columns[columnIndex], y, 7, columnIndex === 5 && record.source === 'simulated_sensor' ? 'F2' : 'F1', columnIndex === 5 && record.source === 'simulated_sensor' ? [0.35, 0.18, 0.65] : [0.12, 0.16, 0.22]))
    if (record.notes) text(commands, `Note: ${String(record.notes).slice(0, 92)}`, 36, y - 10, 6, 'F1', [0.45, 0.5, 0.56])
  })

  text(commands, 'Collection records are immutable. SIMULATED rows are labelled student-assignment data.', 36, 42, 7, 'F1', [0.45, 0.5, 0.56])
  return commands.join('\n')
}

function drawTrendChart(commands, series, x, y, width, height) {
  const max = Math.max(...series.map((item) => item.totalKg), 1)
  const gap = 9
  const barWidth = Math.max(12, (width - gap * (series.length - 1)) / series.length)
  line(commands, x, y, x + width, y, [0.75, 0.78, 0.82])

  series.forEach((item, index) => {
    const barHeight = Math.max(2, (item.totalKg / max) * (height - 28))
    const recycledHeight = item.totalKg > 0 ? barHeight * (item.recycledKg / item.totalKg) : 0
    const barX = x + index * (barWidth + gap)
    fillRect(commands, barX, y, barWidth, barHeight, [0.96, 0.45, 0.09])
    if (recycledHeight > 0) fillRect(commands, barX, y, barWidth, recycledHeight, [0.13, 0.7, 0.36])
    text(commands, item.label, barX, y - 13, 6, 'F1', [0.4, 0.45, 0.52])
    text(commands, fixedNumber(item.totalKg), barX, y + barHeight + 5, 6, 'F2', [0.3, 0.34, 0.4])
  })
  text(commands, 'Orange: total collected   Green: recycled portion', x, y + height + 4, 7, 'F1', [0.4, 0.45, 0.52])
}

export function encodePdf(pageStreams) {
  const objects = []
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
  const pageIds = []

  pageStreams.forEach((stream, index) => {
    const pageId = 5 + index * 2
    const contentId = pageId + 1
    pageIds.push(pageId)
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`
    objects[contentId] = `<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`
  })
  objects[2] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`

  let output = '%PDF-1.4\n%ECGD\n'
  const offsets = [0]
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = byteLength(output)
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`
  }
  const xrefOffset = byteLength(output)
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let id = 1; id < objects.length; id += 1) {
    output += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  }
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return new TextEncoder().encode(output)
}

export function text(commands, value, x, y, size = 9, font = 'F1', color = [0.12, 0.16, 0.22]) {
  commands.push(`${color.join(' ')} rg BT /${font} ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET`)
}

function wrapText(commands, value, x, y, width, size, lineHeight, color) {
  const maxChars = Math.max(20, Math.floor(width / (size * 0.52)))
  const words = String(value).split(/\s+/)
  const lines = []
  let current = ''
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else current = next
  })
  if (current) lines.push(current)
  lines.forEach((lineText, index) => text(commands, lineText, x, y - index * lineHeight, size, 'F1', color))
}

export function fillRect(commands, x, y, width, height, color) {
  commands.push(`${color.join(' ')} rg ${x} ${y} ${width} ${height} re f`)
}

function line(commands, x1, y1, x2, y2, color) {
  commands.push(`${color.join(' ')} RG 0.6 w ${x1} ${y1} m ${x2} ${y2} l S`)
}

function pdfText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function csvCell(value) {
  const stringValue = String(value ?? '')
  return `"${stringValue.replaceAll('"', '""')}"`
}

function fixedNumber(value) {
  return Number(value || 0).toFixed(2)
}

function titleCase(value = '') {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function shortDate(value) {
  return new Intl.DateTimeFormat('en-MY', { day: '2-digit', month: 'short', year: '2-digit' }).format(new Date(value))
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(value)
}

function collectionsNotice(recordCount) {
  return recordCount ? 'Detail rows continue on the following page(s).' : 'No records matched the selected report filters.'
}

function byteLength(value) {
  return new TextEncoder().encode(value).length
}
