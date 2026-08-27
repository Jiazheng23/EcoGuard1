import { useState } from 'react'
import { ArrowLeft, BarChart3, FileSpreadsheet, FileText, Route, X } from 'lucide-react'

const reportTypes = {
  environment: { label: 'Environmental Report', detail: 'Environmental snapshots, crowd, waste, air, water, and temperature data.', icon: BarChart3 },
  trips: { label: 'Trip Report', detail: 'Recorded routes, transport modes, distance, emissions, and Eco Points.', icon: Route },
}

export default function ReportDownloadDialog({ open, onClose, counts, onDownload }) {
  const [reportType, setReportType] = useState('')
  if (!open) return null

  function close() {
    setReportType('')
    onClose()
  }

  function download(format) {
    onDownload(reportType, format)
    close()
  }

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/45 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="report-download-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><h2 id="report-download-title" className="text-lg font-bold text-slate-900">Download Report</h2><p className="mt-1 text-sm text-slate-500">{reportType ? 'Choose the file format.' : 'Choose the report you want to generate.'}</p></div>
          <button type="button" onClick={close} aria-label="Close download dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={19} /></button>
        </div>

        {!reportType ? (
          <div className="mt-5 grid gap-3">
            {Object.entries(reportTypes).map(([id, item]) => {
              const Icon = item.icon
              const count = counts[id] || 0
              return <button key={id} type="button" disabled={!count} onClick={() => setReportType(id)} className="flex items-start gap-4 rounded-xl border border-slate-200 p-4 text-left transition hover:border-green-300 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-45"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-green-100 text-green-700"><Icon size={19} /></span><span><b className="text-sm text-slate-800">{item.label}</b><span className="mt-1 block text-xs leading-5 text-slate-500">{item.detail}</span><span className="mt-2 block text-xs font-semibold text-green-700">{count} matching record{count === 1 ? '' : 's'}</span></span></button>
            })}
          </div>
        ) : (
          <div className="mt-5">
            <button type="button" onClick={() => setReportType('')} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-green-700"><ArrowLeft size={14} /> Choose another report</button>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => download('pdf')} className="grid place-items-center rounded-xl border border-slate-200 p-5 text-slate-700 transition hover:border-green-300 hover:bg-green-50 hover:text-green-700"><FileText size={24} /><b className="mt-2 text-sm">PDF Report</b><span className="mt-1 text-center text-xs text-slate-400">Formatted summary and detailed rows</span></button>
              <button type="button" onClick={() => download('csv')} className="grid place-items-center rounded-xl border border-slate-200 p-5 text-slate-700 transition hover:border-green-300 hover:bg-green-50 hover:text-green-700"><FileSpreadsheet size={24} /><b className="mt-2 text-sm">CSV Data</b><span className="mt-1 text-center text-xs text-slate-400">Spreadsheet-ready detailed records</span></button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
