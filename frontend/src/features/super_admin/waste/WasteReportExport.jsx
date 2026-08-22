import { useState } from 'react'
import { CheckCircle2, Download, FileSpreadsheet, LoaderCircle } from 'lucide-react'
import { recordWasteReportExport } from '../../../services/wasteService'
import { buildWasteCsv, buildWastePdfBytes, downloadWasteReport, wasteReportFilename } from '../../../utils/wasteReport'
import { wasteFilterDescription } from '../../../utils/wasteAnalytics'

export default function WasteReportExport({ location, collections, filters, summary, trend, exportAudits, onExported }) {
  const [exporting, setExporting] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function exportReport(format) {
    if (!collections.length || !location) return
    const generatedAt = new Date()
    setExporting(format)
    setMessage('')
    setError('')

    try {
      let reportData
      let mimeType
      if (format === 'csv') {
        const csv = buildWasteCsv(collections, { locationName: location.name })
        reportData = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
        mimeType = 'text/csv;charset=utf-8'
      } else {
        reportData = buildWastePdfBytes(collections, {
          locationName: location.name,
          filters,
          summary,
          trend,
          generatedAt,
        })
        mimeType = 'application/pdf'
      }

      await recordWasteReportExport({
        locationId: location.id,
        format,
        periodStart: filters.from ? `${filters.from}T00:00:00` : null,
        periodEnd: filters.to ? `${filters.to}T23:59:59.999` : null,
        recordCount: collections.length,
        filters,
      })
      downloadWasteReport(reportData, mimeType, wasteReportFilename(location.name, format, generatedAt))
      await onExported?.()
      setMessage(`${format.toUpperCase()} report generated and its audit record was saved.`)
    } catch (exportError) {
      setError(exportError.message || `Unable to export the ${format.toUpperCase()} report.`)
    } finally {
      setExporting('')
    }
  }

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h3 className="font-bold text-slate-800">Waste history reports</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">Both formats use the active collection filters. PDF includes summary statistics, trend bars, source disclosure, and detailed history; CSV contains the detailed filtered rows.</p></div>
        <div className="flex gap-2">
          <button type="button" onClick={() => exportReport('csv')} disabled={!collections.length || Boolean(exporting)} className="inline-flex items-center gap-2 rounded-xl border border-green-200 px-4 py-2.5 text-sm font-semibold text-green-700 disabled:cursor-not-allowed disabled:opacity-40">{exporting === 'csv' ? <LoaderCircle size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}CSV</button>
          <button type="button" onClick={() => exportReport('pdf')} disabled={!collections.length || Boolean(exporting)} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{exporting === 'pdf' ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}PDF</button>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500"><b className="text-slate-700">Report scope:</b> {wasteFilterDescription(filters)} - {collections.length} matching record{collections.length === 1 ? '' : 's'}.</div>
      {!collections.length && <p className="mt-3 text-sm text-amber-600">No records match the active filters. Export is disabled to avoid creating an empty report.</p>}
      {message && <p className="mt-3 flex items-center gap-2 text-sm text-green-600"><CheckCircle2 size={16} />{message}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Recent export audit</h4>
        <div className="mt-2 space-y-2">
          {exportAudits.slice(0, 5).map((audit) => (
            <div key={audit.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500"><span><b className="uppercase text-slate-700">{audit.export_format}</b> - {audit.record_count} record{audit.record_count === 1 ? '' : 's'}</span><span>{formatDate(audit.generated_at)}</span></div>
          ))}
          {!exportAudits.length && <p className="text-xs text-slate-400">No report export has been audited for this location yet.</p>}
        </div>
      </div>
    </section>
  )
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
