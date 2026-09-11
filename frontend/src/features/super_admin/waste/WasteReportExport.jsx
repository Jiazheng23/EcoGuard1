import { useState } from 'react'
import { createPortal } from 'react-dom'
import DownloadMenu from '../../../components/DownloadMenu'
import { recordWasteReportExport } from '../../../services/wasteService'
import { buildWasteCsv, buildWastePdfBytes, downloadWasteReport, wasteReportFilename } from '../../../utils/wasteReport'

export default function WasteReportExport({ location, collections, filters, summary, trend, onExported, downloadTarget, downloadMessageTarget }) {
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
    <>
      {downloadTarget && createPortal(<DownloadMenu
        disabled={!collections.length}
        loading={Boolean(exporting)}
        items={[
          { label: 'Download PDF', onClick: () => exportReport('pdf') },
          { label: 'Download CSV', onClick: () => exportReport('csv') },
        ]}
      />, downloadTarget)}
      {downloadMessageTarget && createPortal(<>
        {message && <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}
        {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      </>, downloadMessageTarget)}
    </>
  )
}
